const { spawn } = require('child_process');
const fs = require('fs');

const log = fs.createWriteStream('/home/z/my-project/dev.log', { flags: 'w' });

function startServer() {
  const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  
  child.on('exit', (code, signal) => {
    const msg = `\n[${new Date().toISOString()}] Server exited code=${code} signal=${signal}, restarting in 3s...\n`;
    log.write(msg);
    setTimeout(startServer, 3000);
  });
  
  child.on('error', (err) => {
    log.write(`\n[${new Date().toISOString()}] Error: ${err.message}\n`);
    setTimeout(startServer, 3000);
  });
}

startServer();
