import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export class WebTerminalAdapter {
  private term: Terminal;
  private fitAddon: FitAddon;

  constructor(container: HTMLElement, onReady?: () => void) {
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
        cursor: '#050014', // Invisible cursor so it doesn't leave a pink block artifact at end of frame line
        selectionBackground: '#ff00b433',
        black: '#000000',
        red: '#ff2846',
        green: '#00ff66',
        yellow: '#ffe600',
        blue: '#00f0ff',
        magenta: '#ff00b4',
        cyan: '#00f0ff',
        white: '#ffffff',
        brightBlack: '#606080',
        brightRed: '#ff5070',
        brightGreen: '#50ff90',
        brightYellow: '#ffff60',
        brightBlue: '#50f0ff',
        brightMagenta: '#ff50d0',
        brightCyan: '#50f0ff',
        brightWhite: '#ffffff'
      }
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(container);

    const fitAndFocus = () => {
      try {
        this.fitAddon.fit();
      } catch {
        // Fallback
      }
      this.term.focus();
    };

    setTimeout(() => {
      fitAndFocus();
      if (onReady) onReady();
    }, 100);

    container.addEventListener('click', () => {
      this.term.focus();
    });

    window.addEventListener('resize', () => {
      fitAndFocus();
    });
  }

  public writeFrame(lines: string[]): void {
    // Hide cursor (\x1b[?25l) + clear screen + home position
    this.term.write('\x1b[?25l\x1b[2J\x1b[3J\x1b[H');
    this.term.write(lines.join('\r\n'));
  }

  public onKey(callback: (keyStr: string, keyEvent: { name?: string; ctrl?: boolean }) => void): void {
    this.term.onData(data => {
      if (data === '\r') {
        callback('\r', { name: 'return' });
      } else if (data === '\x7f' || data === '\x08') {
        callback('\x7f', { name: 'backspace' });
      } else if (data === '\x1b[A') {
        callback(data, { name: 'up' });
      } else if (data === '\x1b[B') {
        callback(data, { name: 'down' });
      } else if (data === '\x1b[C') {
        callback(data, { name: 'right' });
      } else if (data === '\x1b[D') {
        callback(data, { name: 'left' });
      } else if (data === '\x1b') {
        callback(data, { name: 'escape' });
      } else {
        callback(data, { name: undefined });
      }
    });
  }

  public getDimensions(): { cols: number; rows: number } {
    return { cols: Math.max(80, this.term.cols || 80), rows: Math.max(25, this.term.rows || 25) };
  }
}
