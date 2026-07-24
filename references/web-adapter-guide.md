# Type-Blitz Web Adapter & TUI Architecture Reference Guide

This document captures all technical patterns, Unicode symbol standards, xterm.js setup parameters, storage abstraction layers, and CDP visual verification scripts discovered during the web wrapper integration.

---

## 1. Monospaced 1-Cell Retro Glyphs & Cell-Width Math

To ensure frame alignment across modern GPU terminals (Ghostty, Alacritty, Kitty) and web canvas renderers (`xterm.js`), use **strictly 1-cell CP437 / Unicode Miscellaneous Symbols** instead of 2-cell full-width color emojis.

| Action / Option | Retro Glyph | Unicode Point | Cell Width |
| :--- | :---: | :---: | :---: |
| **Quick Play** | `⚡` | `\u26A1` | 1 Cell |
| **Passage Select** | `◆` | `\u25C6` | 1 Cell |
| **Custom Text** | `▶` | `\u25B6` | 1 Cell |
| **High Scores** | `★` | `\u2605` | 1 Cell |
| **Sound / Audio** | `♫` | `\u266B` | 1 Cell |
| **Exit / Shutdown** | `■` | `\u25A0` | 1 Cell |

### Cell-Width Calculation Rule
In `visibleLength(str)`:
* ANSI escape sequences (`\x1b[...m`) = **0 width**.
* CP437 & Miscellaneous Symbols (`\u2000` - `\u2BFF`) = **1 cell width**.
* Surrogate-pair color emojis (`\u{1F300}` - `\u{1F9FF}`) = **2 cell width**.

---

## 2. xterm.js Canvas Configuration

For crisp, aligned TUI rendering inside the browser:

```typescript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export class WebTerminalAdapter {
  private term: Terminal;
  private fitAddon: FitAddon;

  constructor(container: HTMLElement) {
    this.term = new Terminal({
      cursorBlink: false,
      cursorStyle: 'bar',
      cursorWidth: 1,
      cols: 80,
      rows: 25,
      convertEol: true,
      customGlyphs: true,
      fontFamily: "'Fira Code', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#050014',
        foreground: '#00f0ff',
        cursor: '#050014', // Match background so block artifacts don't protrude at frame end
        selectionBackground: '#ff00b433'
      }
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(container);
  }

  public writeFrame(lines: string[]): void {
    // Hide cursor (\x1b[?25l) + clear screen + home position
    this.term.write('\x1b[?25l\x1b[2J\x1b[3J\x1b[H');
    this.term.write(lines.join('\r\n'));
  }
}
```

---

## 3. Storage Abstraction Pattern (`ScoreStorageAdapter`)

Keep Node file system storage (`fs`/`path`/`os`) completely decoupled from browser client code:

```typescript
export interface ScoreStorageAdapter {
  loadHighScores(maxCount?: number): HighScoreRecord[];
  saveHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>, maxCount?: number): HighScoreRecord;
  getScoreRank(wpm: number): number;
}
```

* **Node CLI:** Uses `NodeStorageAdapter` reading/writing `~/.config/type-blitz/highscores.json`.
* **Browser Wrapper:** Uses `BrowserLocalStorageAdapter` reading/writing `window.localStorage`.
* **Future Auth/API:** Plugs in `ApiStorageAdapter` targeting REST / JWT backend without touching the core game engine.

---

## 4. CDP Visual Verification Automation

To capture headless Chrome screenshots and evaluate console/DOM exceptions automatically:

```javascript
// scripts/inspect-web-render.js
import http from 'node:http';
import fs from 'node:fs';
import { WebSocket } from 'ws';

async function capture() {
  const list = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json/list', r => {
      let data = '';
      r.on('data', chunk => data += chunk);
      r.on('end', () => res(JSON.parse(data)));
    }).on('error', rej);
  });

  const target = list.find(t => t.url.includes('localhost:5173'));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise(r => {
    const id = Math.floor(Math.random() * 100000);
    ws.on('message', function handler(msg) {
      const res = JSON.parse(msg.toString());
      if (res.id === id) {
        ws.off('message', handler);
        r(res.result);
      }
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 1000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/type-blitz-render.png', Buffer.from(shot.data, 'base64'));
  ws.close();
}
capture();
```

---

## 5. Architectural Separation Principle

The native TUI (`src/`) must remain a **pure, zero-dependency Node CLI application**:
* Never import Node built-ins (`node:fs`, `node:child_process`) at the top level in shared storage files.
* Web wrappers must import core game engines as pure TypeScript libraries and adapt output streams externally inside `src/web/`.
