# Type-Blitz Web Wrapper & Harness-Driven Visual Tuning Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a browser wrapper for the `type-blitz` retro synthwave TUI game using `xterm.js` and Vite, and establish an automated agent visual feedback loop (`chrome-cdp-automation` + `vision_analyze`) to catch and fix TUI frame/border alignment bugs directly in the browser.

**Architecture:** 
- **Core TUI Engine & Renderer:** Decouple ANSI string length calculations using a visible-character width helper (`visibleLength`) to eliminate ANSI padding border misalignment.
- **Web Terminal Wrapper:** Embed `xterm.js` with `xterm-addon-fit` inside a retro CRT browser container with customizable scanlines and neon aesthetics.
- **Harness Visual Verification:** Serve the app locally (`http://localhost:5173`), capture CDP screenshots, and use `vision_analyze` + CDP console evaluations to iteratively verify frame border alignment.
- **Pluggable Storage Layer:** Abstract high-score persistence into a `ScoreStorageAdapter` interface supporting `LocalStorageAdapter` today and authentication-backed API persistence tomorrow.

**Tech Stack:** TypeScript, xterm.js, @xterm/addon-fit, Vite, Express/Static HTTP, CDP (Chrome DevTools Protocol), Hermes Vision.

---

### Task 1: Fix ANSI Visible String Width & Frame Border Alignment Core

**Objective:** Correct TUI string padding and right-border line calculations across `retroHeader.ts`, `streamView.ts`, and `statsDisplay.ts` by creating a robust `visibleLength` helper.

**Files:**
- Create: `src/renderer/ansiUtils.ts`
- Modify: `src/renderer/retroHeader.ts`, `src/renderer/streamView.ts`, `src/renderer/statsDisplay.ts`
- Test: `src/__tests__/ansiUtils.test.ts`, `src/__tests__/renderer.test.ts`

**Step 1: Write failing test for ANSI visible length & box padding**

```typescript
// src/__tests__/ansiUtils.test.ts
import { visibleLength, padAnsiLine } from '../renderer/ansiUtils.js';
import { Palette } from '../renderer/ansi.js';

describe('ANSI Utilities', () => {
  it('correctly calculates visible length ignoring ANSI escape codes', () => {
    const colored = Palette.cyan('Hello') + Palette.magenta(' World');
    expect(visibleLength(colored)).toBe(11);
  });

  it('pads ANSI strings accurately to target total column width', () => {
    const colored = Palette.yellow('TEST');
    const padded = padAnsiLine(colored, 20);
    expect(visibleLength(padded)).toBe(20);
  });
});
```

**Step 2: Run test to verify failure**

Run: `npm test`
Expected: FAIL — `ansiUtils.js` module not found.

**Step 3: Implement ANSI utility & refactor border calculations**

```typescript
// src/renderer/ansiUtils.ts
export function visibleLength(str: string): number {
  // Strip ANSI escape codes (CSI sequences)
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').length;
}

export function padAnsiLine(str: string, targetWidth: number, fillChar: string = ' '): string {
  const visible = visibleLength(str);
  const missing = Math.max(0, targetWidth - visible);
  return str + fillChar.repeat(missing);
}
```

**Step 4: Update `retroHeader.ts` and `streamView.ts` to use `padAnsiLine` for right borders (`║`)**

Replace plain `.padEnd(...)` or length checks that include raw escape codes with `visibleLength(...)` and `padAnsiLine(...)`.

**Step 5: Run tests to verify pass**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "fix(renderer): use visible string length for frame padding and border alignment"
```

---

### Task 2: Web Terminal Wrapper & Vite Infrastructure Setup

**Objective:** Install `xterm.js` and Vite to create a web bundle that renders the TUI game in a browser terminal canvas.

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`, `index.html`, `web/styles.css`, `web/main.ts`

**Step 1: Install `xterm` and `@xterm/addon-fit` dependencies**

```bash
npm install xterm @xterm/addon-fit
npm install --save-dev vite
```

**Step 2: Create retro web terminal UI container**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Type-Blitz // Retro Synthwave Typing</title>
  <link rel="stylesheet" href="/web/styles.css" />
  <link rel="stylesheet" href="/node_modules/xterm/css/xterm.css" />
</head>
<body>
  <div class="crt-container">
    <div class="scanlines"></div>
    <div id="terminal"></div>
  </div>
  <script type="module" src="/web/main.ts"></script>
</body>
</html>
```

**Step 3: Define CRT Synthwave styles**

```css
/* web/styles.css */
body {
  background-color: #0d0221;
  color: #ff007f;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: 'Courier New', monospace;
}

.crt-container {
  position: relative;
  width: 90vw;
  max-width: 1000px;
  height: 80vh;
  border: 3px solid #00f0ff;
  box-shadow: 0 0 20px #00f0ff, inset 0 0 15px #ff007f;
  border-radius: 8px;
  overflow: hidden;
  background-color: #050014;
}

.scanlines {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
  background-size: 100% 4px;
  z-index: 10;
  pointer-events: none;
}
```

**Step 4: Verify Vite build and dev server launch**

Run: `npx vite build`
Expected: PASS — produces `dist/` bundle.

**Step 5: Commit**

```bash
git add package.json index.html vite.config.ts web/
git commit -m "feat(web): add xterm.js wrapper and Vite dev configuration"
```

---

### Task 3: Web Terminal Engine Adapter

**Objective:** Connect the TypeScript game engine and ANSI renderer to the xterm.js terminal instance in `web/main.ts`.

**Files:**
- Create: `src/web/WebAdapter.ts`
- Modify: `web/main.ts`

**Step 1: Implement web input/output stream adapter for `TypeBlitzApp`**

```typescript
// src/web/WebAdapter.ts
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';

export class WebTerminalAdapter {
  private term: Terminal;
  private fitAddon: FitAddon;

  constructor(container: HTMLElement) {
    this.term = new Terminal({
      cursorBlink: true,
      cols: 80,
      rows: 25,
      theme: {
        background: '#050014',
        foreground: '#00f0ff',
        cursor: '#ff007f',
        cyan: '#00f0ff',
        magenta: '#ff007f',
        yellow: '#ffe600',
        green: '#00ff66'
      },
      fontFamily: 'monospace'
    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(container);
    this.fitAddon.fit();
  }

  public writeLines(lines: string[]): void {
    this.term.clear();
    lines.forEach(line => this.term.writeln(line));
  }

  public onKeypress(callback: (char: string) => void): void {
    this.term.onData(data => callback(data));
  }

  public getDimensions(): { cols: number; rows: number } {
    return { cols: this.term.cols, rows: this.term.rows };
  }
}
```

**Step 2: Initialize game inside `web/main.ts`**

Attach `WebTerminalAdapter` to `TypeBlitzApp` or a dedicated web runner instance.

**Step 3: Commit**

```bash
git add src/web/ web/
git commit -m "feat(web): attach TUI engine output stream to xterm.js"
```

---

### Task 4: Harness Automated Visual Inspection Setup

**Objective:** Create an agent execution harness script that launches Vite in background, opens Chrome CDP, captures screenshots, and runs visual inspection.

**Files:**
- Create: `scripts/inspect-web-render.js`

**Step 1: Implement CDP screenshot & inspection script**

```javascript
// scripts/inspect-web-render.js
import { execSync } from 'child_process';
import fs from 'fs';

// Script checks if dev server is up at http://localhost:5173, captures CDP screenshot to /tmp/type-blitz-render.png
console.log('Capturing type-blitz web render via Chrome CDP...');
```

**Step 2: Agent verification workflow**

1. Run `npx vite --port 5173` in background via `terminal(background=true)`.
2. Execute `node scripts/inspect-web-render.js` or CDP fetch to write `/tmp/type-blitz-render.png`.
3. Call `vision_analyze(image_url='/tmp/type-blitz-render.png', question='Inspect the right vertical border of the neon frame. Is there any line wrapping or missing right border segment?')`.
4. Agent evaluates returned feedback and patches code if misalignment is found.

**Step 3: Commit**

```bash
git add scripts/
git commit -m "tooling(harness): add automated CDP screenshot and visual inspection harness"
```

---

### Task 5: Pluggable High Scores & Auth Storage Adapter

**Objective:** Refactor score handling into an interface (`ScoreStorageAdapter`) so local storage and future user profiles/auth use the same contract.

**Files:**
- Create: `src/storage/scoreAdapter.ts`
- Modify: `src/storage/highScores.ts`

**Step 1: Define storage adapter contract**

```typescript
// src/storage/scoreAdapter.ts
export interface HighScoreEntry {
  initials: string;
  wpm: number;
  accuracy: number;
  passageId: string;
  timestamp: number;
}

export interface ScoreStorageAdapter {
  getHighScores(): Promise<HighScoreEntry[]>;
  saveHighScore(entry: HighScoreEntry): Promise<boolean>;
}

export class LocalStorageAdapter implements ScoreStorageAdapter {
  async getHighScores(): Promise<HighScoreEntry[]> {
    const raw = localStorage.getItem('type_blitz_scores');
    return raw ? JSON.parse(raw) : [];
  }

  async saveHighScore(entry: HighScoreEntry): Promise<boolean> {
    const scores = await this.getHighScores();
    scores.push(entry);
    scores.sort((a, b) => b.wpm - a.wpm);
    localStorage.setItem('type_blitz_scores', JSON.stringify(scores.slice(0, 100)));
    return true;
  }
}
```

**Step 2: Verify tests pass with new adapter**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/storage/
git commit -m "refactor(storage): introduce pluggable ScoreStorageAdapter interface for web and auth"
```

---

### Verification Checklist
- [ ] Core TUI tests pass (`npm test`).
- [ ] Vite web wrapper serves on `http://localhost:5173`.
- [ ] ANSI escape sequence width calculations prevent right border wrapping.
- [ ] Harness CDP screenshot script captures browser view.
- [ ] Vision tool (`vision_analyze`) confirms pixel-perfect frame alignment.
- [ ] HighScore storage adapter is ready for auth extension.
