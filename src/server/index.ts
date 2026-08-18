import { initDb } from './db/db';
import { initBackupService } from './services/backup.service';
import { initSequenceCounters } from './services/auth.service';
import { logger } from './logger';
import { startServer } from './app';
import { getSetting } from './services/settings.service';

process.on('uncaughtException', (err) => {
  logger.fatal('process', 'Excepción no capturada', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('process', 'Promesa rechazada no capturada', { reason: String(reason) });
});

const PORT = Number(process.env.PORT || 4100);

async function main() {
  await initDb();
  await initSequenceCounters();
  const backup = initBackupService();

  // Backup automático al iniciar
  try {
    if ((await getSetting('auto_backup')) === '1') {
      await backup.createBackup(null);
    }
  } catch (e) {
    logger.warn('backup', 'No se pudo crear backup inicial', e);
  }

  // Backup diario automático
  setInterval(async () => {
    try {
      if ((await getSetting('auto_backup')) === '1') {
        await backup.createBackup(null);
        logger.info('backup', 'Backup diario automático realizado');
      }
    } catch (e) {
      logger.error('backup', 'Error en backup automático diario', e);
    }
  }, 24 * 60 * 60 * 1000);

  startServer(PORT);
}

main().catch((e) => {
  logger.fatal('process', 'Error al iniciar el servidor', e);
  process.exit(1);
});