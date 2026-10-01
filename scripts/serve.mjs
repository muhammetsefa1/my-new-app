// Finds a free local port (never touches processes already listening) and starts Vite on it.
import net from 'node:net';
import { spawn } from 'node:child_process';

const isFree = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });

const start = Number(process.env.PORT || 5173);
let port = start;
while (!(await isFree(port))) port++;

const mode = process.argv[2] === 'preview' ? 'preview' : 'dev';
const args = mode === 'preview' ? ['vite', 'preview', '--port', String(port), '--strictPort', '--host'] : ['vite', '--port', String(port), '--strictPort', '--host'];
console.log(`\n  Vela → http://localhost:${port}/\n`);
spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
