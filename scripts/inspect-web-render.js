import http from 'node:http';
import fs from 'node:fs';
import { WebSocket } from 'ws';

async function captureWebRender() {
  const keysToSend = process.argv.slice(2); // e.g. "1" or "Enter" or "Space"

  // 1. Fetch active target page from Chrome CDP endpoint
  const targets = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.url.includes('localhost:5173') || t.title.includes('Type-Blitz'));
  if (!page) {
    console.error('Could not find Type-Blitz tab in Chrome CDP.');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const reqId = id++;
    const handler = (msg) => {
      const res = JSON.parse(msg.toString());
      if (res.id === reqId) {
        ws.off('message', handler);
        resolve(res.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });

  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 1000));

  // If key arguments passed, dispatch key events
  for (const key of keysToSend) {
    console.log(`Dispatching CDP key event: ${key}`);
    if (key === 'Enter') {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    } else {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: key, text: key });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: key });
    }
    // Wait for frame render
    await new Promise(r => setTimeout(r, 200));
  }

  // Brief pause to settle animation/render
  await new Promise(r => setTimeout(r, 300));

  // Capture Screenshot
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  const outputPath = '/tmp/type-blitz-render.png';
  fs.writeFileSync(outputPath, buffer);

  console.log(`Screenshot saved to ${outputPath} (${buffer.length} bytes)`);
  ws.close();
}

captureWebRender().catch(err => {
  console.error('Failed to capture CDP screenshot:', err);
  process.exit(1);
});
