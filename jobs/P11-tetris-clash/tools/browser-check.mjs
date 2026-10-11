// One isolated headless browser for original-play inspection and this game's static captures.
// All browser processes started here are closed in finally; no dependencies or desktop profile.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';

const scratch = resolve(tmpdir(), 'r11-block-clash-browser');
mkdirSync(scratch, { recursive: true });
const executable =
  process.env.BLOCK_CLASH_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(
  executable,
  [
    '--headless',
    '--disable-gpu',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=47111',
    `--user-data-dir=${scratch}/profile`,
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let socket;
let input;
let call;
let nextId = 1;
const pending = new Map();
try {
  let tabs;
  for (let i = 0; i < 100; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:47111/json/list')).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const target = tabs?.find((tab) => tab.type === 'page');
  if (!target) throw new Error('Headless browser did not expose a page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    socket.onopen = ok;
    socket.onerror = fail;
  });
  socket.onmessage = ({ data }) => {
    const response = JSON.parse(data);
    if (!response.id) return;
    const p = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) p?.reject(response.error);
    else p?.resolve(response.result);
  };
  socket.onclose = () => {
    for (const request of pending.values()) request.reject(new Error('Browser connection closed'));
    pending.clear();
  };
  call = (method, params = {}) =>
    new Promise((resolveCall, reject) => {
      const id = nextId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 10_000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolveCall(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await call('Page.enable');
  console.log(JSON.stringify({ ready: true, scratch }));
  input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    const command = JSON.parse(line);
    if (command.quit) break;
    try {
      if (command.capture) {
        const png = await call('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
        writeFileSync(resolve(command.capture), Buffer.from(png.data, 'base64'));
        console.log(JSON.stringify({ saved: command.capture }));
      } else if (command.eval) {
        const result = await call('Runtime.evaluate', {
          expression: command.eval,
          returnByValue: true,
          awaitPromise: true,
        });
        console.log(
          JSON.stringify({ value: result.result?.value, error: result.exceptionDetails?.text }),
        );
      } else console.log(JSON.stringify(await call(command.method, command.params)));
    } catch (error) {
      console.log(JSON.stringify({ error: String(error) }));
    }
  }
} finally {
  input?.close();
  process.stdin.pause();
  // Chrome can relaunch itself on Windows; close the browser through CDP before
  // killing the original spawned process, which may already have exited.
  if (socket?.readyState === WebSocket.OPEN) {
    await Promise.race([
      call('Browser.close').catch(() => {}),
      new Promise((ok) => setTimeout(ok, 2000)),
    ]);
  }
  socket?.close();
  if (browser.exitCode === null) {
    browser.kill();
    await new Promise((ok) => {
      browser.once('exit', ok);
      setTimeout(ok, 5000);
    });
  }
}
