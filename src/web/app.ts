import { Passage, GameState, GameConfig } from '../types.js';
import { LITERARY_PASSAGES, getRandomPassage } from '../passages/passages.js';
import { GameEngine } from '../engine/gameEngine.js';
import { Palette } from '../renderer/ansi.js';
import { renderHeader, renderFooter } from '../renderer/retroHeader.js';
import { renderStreamView } from '../renderer/streamView.js';
import {
  renderMenuView,
  renderSummaryView,
  renderPassageSelectView,
  renderHighScoresView,
  renderInitialsEntryView,
  calculateGrade
} from '../renderer/statsDisplay.js';
import { loadHighScores, saveHighScore, qualifiesForHighScore } from '../storage/highScores.js';
import { WebTerminalAdapter } from './WebAdapter.js';
import { formatFramedLine } from '../renderer/ansiUtils.js';

export class TypeBlitzWebApp {
  private adapter: WebTerminalAdapter;
  private state: GameState = 'MENU';
  private currentPassage: Passage;
  private engine: GameEngine;
  private config: GameConfig = {
    soundEnabled: true,
    retroGrid: true,
    showScanlines: true
  };

  private menuSelectedIndex: number = 0;
  private passageSelectedIndex: number = 0;
  private customTextInput: string = '';
  private isNewHighScore: boolean = false;
  private isCountingDown: boolean = false;
  private highScoreScrollOffset: number = 0;

  private initialsInput: string[] = ['A', 'A', 'A'];
  private activeInitialsSlot: number = 0;

  constructor(container: HTMLElement) {
    this.currentPassage = getRandomPassage();
    this.engine = new GameEngine(this.currentPassage, this.config);

    this.adapter = new WebTerminalAdapter(container, () => {
      this.render();
    });

    this.adapter.onKey((keyStr, keyEvent) => this.handleInput(keyStr, keyEvent));
    this.render();
  }

  public render(): void {
    if (this.isCountingDown) return;

    const { cols } = this.adapter.getDimensions();
    const frameLines: string[] = [];

    const headerLines = renderHeader(
      this.state === 'PLAYING' || this.state === 'COUNTDOWN' || this.state === 'SUMMARY' || this.state === 'INITIALS_ENTRY'
        ? this.currentPassage.title
        : undefined,
      this.currentPassage.author,
      cols
    );
    frameLines.push(...headerLines);

    switch (this.state) {
      case 'MENU':
        frameLines.push(...renderMenuView(this.menuSelectedIndex, this.config.soundEnabled, cols));
        break;

      case 'PASSAGE_SELECT':
        frameLines.push(...renderPassageSelectView(this.passageSelectedIndex, cols));
        break;

      case 'HIGH_SCORES':
        const scores = loadHighScores();
        frameLines.push(...renderHighScoresView(scores, this.highScoreScrollOffset, 10, cols));
        break;

      case 'PLAYING':
        frameLines.push(...renderStreamView(this.engine, cols));
        break;

      case 'SUMMARY':
        frameLines.push(...renderSummaryView(this.engine, this.isNewHighScore, cols));
        break;

      case 'INITIALS_ENTRY':
        frameLines.push(
          ...renderInitialsEntryView(
            this.initialsInput,
            this.activeInitialsSlot,
            this.engine.getStats().wpm,
            cols
          )
        );
        break;

      case 'CUSTOM_INPUT':
        frameLines.push(...this.renderCustomInputView(cols));
        break;
    }

    let helpStr = 'TYPE-BLITZ 1984 | 80S RETRO SYNTHWAVE TYPING ENGINE';
    if (this.state === 'PLAYING') {
      helpStr = 'TYPE THE TEXT AS IT STREAMS | [ESC] PAUSE / MENU | [CTRL+R] RESTART';
    } else if (this.state === 'MENU') {
      helpStr = '[UP/DOWN] NAVIGATE | [ENTER/SPACE] SELECT';
    } else if (this.state === 'PASSAGE_SELECT') {
      helpStr = '[UP/DOWN] NAVIGATE | [ENTER] CHOOSE PASSAGE | [ESC] BACK';
    } else if (this.state === 'INITIALS_ENTRY') {
      helpStr = 'ENTER INITIALS | [UP/DOWN] CHANGE | [LEFT/RIGHT] SLOT | [ENTER] SAVE';
    } else if (this.state === 'CUSTOM_INPUT') {
      helpStr = 'TYPE YOUR TEXT | [ENTER] START GAME | [ESC] CANCEL';
    }

    frameLines.push(...renderFooter(helpStr, cols));
    this.adapter.writeFrame(frameLines);
  }

  private renderCustomInputView(cols: number): string[] {
    const innerWidth = Math.max(20, cols - 2);
    const result: string[] = [];

    result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
    const headerStr = '  === TYPE OR PASTE YOUR CUSTOM PASSAGE ===';
    result.push(formatFramedLine(Palette.neonBorder('║'), Palette.yellow(headerStr), Palette.neonBorder('║'), cols));
    result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

    const displayInput = this.customTextInput ? `> ${this.customTextInput}` : '> (Type here...)';
    result.push(formatFramedLine(Palette.neonBorder('║'), '  ' + Palette.brightWhite(displayInput), Palette.neonBorder('║'), cols));

    result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
    result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

    return result;
  }

  private handleInput(keyStr: string, keyEvent: { name?: string; ctrl?: boolean }): void {
    if (this.isCountingDown) return;

    switch (this.state) {
      case 'MENU':
        if (keyEvent.name === 'up') {
          this.menuSelectedIndex = (this.menuSelectedIndex - 1 + 6) % 6;
          this.render();
        } else if (keyEvent.name === 'down') {
          this.menuSelectedIndex = (this.menuSelectedIndex + 1) % 6;
          this.render();
        } else if (keyEvent.name === 'return' || keyStr === ' ') {
          this.executeMenuAction(this.menuSelectedIndex);
        } else if (keyStr >= '1' && keyStr <= '6') {
          this.executeMenuAction(parseInt(keyStr, 10) - 1);
        }
        break;

      case 'PASSAGE_SELECT':
        if (keyEvent.name === 'up') {
          this.passageSelectedIndex = (this.passageSelectedIndex - 1 + LITERARY_PASSAGES.length) % LITERARY_PASSAGES.length;
          this.render();
        } else if (keyEvent.name === 'down') {
          this.passageSelectedIndex = (this.passageSelectedIndex + 1) % LITERARY_PASSAGES.length;
          this.render();
        } else if (keyEvent.name === 'return' || keyStr === ' ') {
          this.currentPassage = LITERARY_PASSAGES[this.passageSelectedIndex];
          this.startCountdownAndGame();
        } else if (keyEvent.name === 'escape') {
          this.state = 'MENU';
          this.render();
        }
        break;

      case 'HIGH_SCORES':
        if (keyEvent.name === 'up') {
          this.highScoreScrollOffset = Math.max(0, this.highScoreScrollOffset - 1);
          this.render();
        } else if (keyEvent.name === 'down') {
          this.highScoreScrollOffset = Math.min(100, this.highScoreScrollOffset + 1);
          this.render();
        } else if (keyEvent.name === 'escape' || keyEvent.name === 'return' || keyStr.toLowerCase() === 'm') {
          this.state = 'MENU';
          this.render();
        }
        break;

      case 'PLAYING':
        if (keyEvent.name === 'escape') {
          this.state = 'MENU';
          this.render();
          return;
        }

        if (keyEvent.name === 'backspace' || keyStr === '\x7f' || keyStr === '\x08') {
          this.engine.handleBackspace();
          this.render();
          return;
        }

        if (keyStr && keyStr.length === 1 && keyStr >= ' ' && keyStr <= '~') {
          const res = this.engine.handleKey(keyStr);
          this.render();

          if (res.completed) {
            const stats = this.engine.getStats();
            this.isNewHighScore = qualifiesForHighScore(stats.wpm);
            this.state = 'SUMMARY';
            this.render();
          }
        }
        break;

      case 'SUMMARY':
        if (this.isNewHighScore && (keyEvent.name === 'return' || keyStr === ' ')) {
          this.state = 'INITIALS_ENTRY';
          this.initialsInput = ['A', 'A', 'A'];
          this.activeInitialsSlot = 0;
          this.render();
        } else if (keyStr.toLowerCase() === 'r') {
          this.startCountdownAndGame();
        } else if (keyStr === ' ' || keyEvent.name === 'return') {
          this.currentPassage = getRandomPassage();
          this.startCountdownAndGame();
        } else if (keyEvent.name === 'escape' || keyStr.toLowerCase() === 'm') {
          this.state = 'MENU';
          this.render();
        }
        break;

      case 'INITIALS_ENTRY':
        if (keyEvent.name === 'left') {
          this.activeInitialsSlot = (this.activeInitialsSlot - 1 + 3) % 3;
          this.render();
        } else if (keyEvent.name === 'right') {
          this.activeInitialsSlot = (this.activeInitialsSlot + 1) % 3;
          this.render();
        } else if (keyEvent.name === 'up') {
          const charCode = this.initialsInput[this.activeInitialsSlot].charCodeAt(0);
          const nextChar = charCode === 90 ? 'A' : String.fromCharCode(charCode + 1);
          this.initialsInput[this.activeInitialsSlot] = nextChar;
          this.render();
        } else if (keyEvent.name === 'down') {
          const charCode = this.initialsInput[this.activeInitialsSlot].charCodeAt(0);
          const prevChar = charCode === 65 ? 'Z' : String.fromCharCode(charCode - 1);
          this.initialsInput[this.activeInitialsSlot] = prevChar;
          this.render();
        } else if (keyEvent.name === 'return') {
          const stats = this.engine.getStats();
          saveHighScore({
            initials: this.initialsInput.join(''),
            passageTitle: this.currentPassage.title,
            author: this.currentPassage.author,
            wpm: stats.wpm,
            accuracy: stats.accuracy,
            grade: calculateGrade(stats.wpm, stats.accuracy).grade
          });
          this.state = 'HIGH_SCORES';
          this.render();
        } else if (keyStr && keyStr.length === 1 && /[a-zA-Z]/.test(keyStr)) {
          this.initialsInput[this.activeInitialsSlot] = keyStr.toUpperCase();
          if (this.activeInitialsSlot < 2) {
            this.activeInitialsSlot++;
          }
          this.render();
        }
        break;

      case 'CUSTOM_INPUT':
        if (keyEvent.name === 'return') {
          if (this.customTextInput.trim().length > 0) {
            this.currentPassage = {
              id: 'custom-' + Date.now(),
              title: 'CUSTOM USER PASSAGE',
              author: 'ANONYMOUS',
              year: 1984,
              genre: 'CUSTOM',
              text: this.customTextInput.trim()
            };
            this.startCountdownAndGame();
          }
        } else if (keyEvent.name === 'backspace' || keyStr === '\x7f' || keyStr === '\x08') {
          this.customTextInput = this.customTextInput.slice(0, -1);
          this.render();
        } else if (keyEvent.name === 'escape') {
          this.state = 'MENU';
          this.render();
        } else if (keyStr && keyStr.length === 1 && keyStr >= ' ' && keyStr <= '~') {
          this.customTextInput += keyStr;
          this.render();
        }
        break;
    }
  }

  private executeMenuAction(index: number): void {
    switch (index) {
      case 0:
        this.currentPassage = getRandomPassage();
        this.startCountdownAndGame();
        break;
      case 1:
        this.state = 'PASSAGE_SELECT';
        this.passageSelectedIndex = 0;
        this.render();
        break;
      case 2:
        this.state = 'CUSTOM_INPUT';
        this.customTextInput = '';
        this.render();
        break;
      case 3:
        this.state = 'HIGH_SCORES';
        this.highScoreScrollOffset = 0;
        this.render();
        break;
      case 4:
        this.config.soundEnabled = !this.config.soundEnabled;
        this.render();
        break;
      case 5:
        this.adapter.writeFrame(['\r\n  [ GAME EXITED - REFRESH PAGE TO PLAY AGAIN ]\r\n']);
        break;
    }
  }

  private startCountdownAndGame(): void {
    this.state = 'PLAYING';
    this.engine = new GameEngine(this.currentPassage, this.config);
    this.engine.start();
    this.render();
  }
}
