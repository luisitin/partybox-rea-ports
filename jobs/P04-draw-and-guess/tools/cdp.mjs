// Bounded local CDP transport; a failed check must still reach browser cleanup.
export function createCDP() {
  let nextId = 0;
  const pending = new Map();
  function rpc(ws, method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timed out: ${method}`));
      }, 15000);
      pending.set(id, { ws, timer, resolve, reject });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }
  async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('CDP connection timed out'));
      }, 15000);
      ws.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      ws.addEventListener(
        'error',
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
        { once: true },
      );
    });
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    });
    ws.addEventListener('close', () => {
      for (const [id, item] of pending) {
        if (item.ws !== ws) continue;
        clearTimeout(item.timer);
        pending.delete(id);
        item.reject(new Error('Browser connection closed'));
      }
    });
    return ws;
  }
  return { rpc, connect };
}
