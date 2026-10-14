// Close only this job's unique temporary browser profiles after a failed Windows launcher handoff.
import { readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
for (const name of readdirSync(tmpdir()).filter((n) => n.startsWith('p04-r2-'))) {
  let endpoint;
  try {
    const [port, path] = readFileSync(join(tmpdir(), name, 'DevToolsActivePort'), 'utf8')
      .trim()
      .split(/\r?\n/);
    await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
    endpoint = `ws://127.0.0.1:${port}${path}`;
  } catch {
    continue;
  }
  const ws = new WebSocket(endpoint);
  await new Promise((done) => {
    const timer = setTimeout(() => {
      ws.close();
      done();
    }, 2500);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })));
    ws.addEventListener('close', () => {
      clearTimeout(timer);
      done();
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      done();
    });
  });
  console.log(`Closed ${name}`);
}
