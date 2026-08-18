import postgres from 'postgres';

const TZ = process.env.EVENTOS_TZ || 'America/Argentina/Buenos_Aires';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('❌  Falta DATABASE_URL. Ejecutá:');
    console.log('   $env:DATABASE_URL="postgresql://..." ; npx tsx scripts/diag.ts');
    return;
  }

  const m = url.match(/^[^:]+:\/\/[^:]+:([^@]*)@([^:]+):(\d+)\/([^?]+)/);
  console.log('📋  URL parseada:');
  console.log(`   host: ${m ? m[2] : '???'}  port: ${m ? m[3] : '???'}  db: ${m ? m[4] : '???'}  password: ${m && m[1] ? '✓ seteada' : '✗ VACÍA/INVÁLIDA'}`);
  console.log(`   timezone: ${TZ}`);

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    console.log('\n🔌  Conectando a Postgres...');
    sql = postgres(url, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      connection: {
        application_name: 'eventos-pos-diag',
        options: `-c timezone=${TZ}`,
      },
      connect_timeout: 10,
      onnotice: () => {},
      onparameter: () => {},
    });

    const one = await sql.unsafe<{ one: number }[]>('SELECT 1 AS one');
    console.log(`✅  Conexión OK. SELECT 1 → ${one[0]?.one}`);

    const tables = ['users', 'events', 'boxes', 'categories', 'products', 'ticket_types', 'sales', 'sale_items', 'sale_tickets', 'tickets', 'closes', 'voids', 'audit_log', 'app_logs', 'settings', 'seq'];
    console.log('\n🗂️  Verificando tablas:');
    let missing = 0;
    for (const t of tables) {
      const r = await sql.unsafe<{ reg: unknown }[]>(`SELECT to_regclass('public.${t}') AS reg`);
      const ok = r[0]?.reg != null;
      if (!ok) missing++;
      console.log(`   ${ok ? '✅' : '❌'} ${t}`);
    }

    const users = await sql.unsafe<{ c: number }[]>('SELECT COUNT(*) AS c FROM users');
    console.log(`\n👤  users: ${users[0]?.c} registros`);
    if (Number(users[0]?.c) === 0) console.log('   → falta crear el superadmin (primer alta en la app)');

    console.log(missing === 0 ? '\n🎉  Todo listo en Supabase.' : `\n⚠️  Faltan ${missing} tabla(s): ejecutá cloud/schema.sql en Supabase → SQL Editor.`);
  } catch (e) {
    const err = e as Error;
    console.log('\n❌  ERROR de conexión:');
    console.log('   ' + err.message);
    console.log('\nPosibles causas:');
    console.log('   - URL mal copiada (debe ser Transaction pooler, puerto 6543)');
    console.log('   - Contraseña de la base incorrecta (no la service_role)');
    console.log('   - El proyecto Supabase está en pausa');
  } finally {
    if (sql) {
      try {
        await sql.end({ timeout: 2 });
      } catch {
        /* noop */
      }
    }
  }
}

main();