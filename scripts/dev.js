const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'watch', 'src/server/index.ts'], { stdio: 'inherit', shell: true });
const ui = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  server.kill();
  ui.kill();
  process.exit(0);
});