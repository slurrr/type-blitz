import http from 'node:http';
import { WebSocket } from 'ws';

async function evalPage() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.url.includes('localhost:5173') || t.title.includes('Type-Blitz'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let id = 1;
  const send = (method, params = {}) => new Promise(r => {
    const reqId = id++;
    const handler = (msg) => {
      const res = JSON.parse(msg.toString());
      if (res.id === reqId) {
        ws.off('message', handler);
        r(res.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.method === 'Console.messageAdded' || data.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE LOG:', data.params);
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', JSON.stringify(data.params, null, 2));
    }
  });

  await send('Console.enable');
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });

  await new Promise(r => setTimeout(r, 1500));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('terminal-container');
      const termEl = container ? container.querySelector('.xterm') : null;
      return {
        containerWidth: container ? container.clientWidth : 0,
        containerHeight: container ? container.clientHeight : 0,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM STATE:', JSON.stringify(evalRes, null, 2));
  ws.close();
}

evalPage();
