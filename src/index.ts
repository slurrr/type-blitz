import readline from 'node:readline';
import { Command } from 'commander';
import { Passage, GameState, GameConfig } from './types.js';
import { LITERARY_PASSAGES, getRandomPassage, getPassageById } from './passages/passages.js';
import { GameEngine } from './engine/gameEngine.js';
import { ANSI, Palette, getTerminalDimensions } from './renderer/ansi.js';
import { renderHeader, renderFooter } from './renderer/retroHeader.js';
import { renderStreamView } from './renderer/streamView.js';
import { runCountdownSequence } from './renderer/countdown.js';
import {
  renderMenuView,
  renderSummaryView,
  renderPassageSelectView,
  renderHighScoresView,
  renderInitialsEntryView,
  calculateGrade
} from './renderer/statsDisplay.js';
import { loadHighScores, saveHighScore, getScoreRank } from './storage/highScores.js';
import {
  playBeep,
  playKeypressSound,
  playCountdownBeep,
  playTop1Cheer,
  playTop10Applause,
  startMenuMusic,
  startGameplayMusic,
  stopMusic
} from './sound/audio.js';

class TypeBlitzApp {
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
  private scoreRank: number = 0;
  private isCountingDown: boolean = false;
  private highScoreScrollOffset: number = 0;

  private initialsInput: string[] = ['A', 'A', 'A'];
  private activeInitialsSlot: number = 0;

  constructor(initialPassageId?: string) {
    const selected = initialPassageId ? getPassageById(initialPassageId) : undefined;
    this.currentPassage = selected || getRandomPassage();
    this.engine = new GameEngine(this.currentPassage, this.config);
  }

  public async start(): Promise<void> {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.resume();

    process.stdout.write(ANSI.hideCursor);

    process.stdout.on('resize', () => this.render());
    process.stdin.on('keypress', (str: string | undefined, key: readline.Key) => this.handleKeypress(str, key));

    process.on('SIGINT', () => this.cleanupAndExit());
    process.on('SIGTERM', () => this.cleanupAndExit());

    // Start background chill menu music loop
    startMenuMusic(this.config.soundEnabled);

    this.render();
  }

  private cleanupAndExit(): void {
    stopMusic();
    process.stdout.write(ANSI.showCursor);
    process.stdout.write(ANSI.reset + '\n');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }

  private render(): void {
    if (this.isCountingDown) return;

    // Music control per state
    if (this.state === 'PLAYING') {
      startGameplayMusic(this.config.soundEnabled);
    } else if (this.state === 'MENU' || this.state === 'PASSAGE_SELECT' || this.state === 'HIGH_SCORES' || this.state === 'INITIALS_ENTRY' || this.state === 'CUSTOM_INPUT') {
      startMenuMusic(this.config.soundEnabled);
    }

    const { cols } = getTerminalDimensions();
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
        const maxVisible = Math.max(5, getTerminalDimensions().rows - 14);
        frameLines.push(...renderHighScoresView(scores, this.highScoreScrollOffset, maxVisible, cols));
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
      helpStr = '[UP/DOWN] NAVIGATE | [ENTER/SPACE] SELECT | [Q] QUIT';
    } else if (this.state === 'PASSAGE_SELECT') {
      helpStr = '[UP/DOWN] NAVIGATE | [ENTER] CHOOSE PASSAGE | [ESC] BACK';
    } else if (this.state === 'INITIALS_ENTRY') {
      helpStr = 'ENTER INITIALS | [UP/DOWN] CHANGE | [LEFT/RIGHT] SLOT | [ENTER] SAVE';
    } else if (this.state === 'CUSTOM_INPUT') {
      helpStr = 'TYPE/PASTE YOUR TEXT | [ENTER] START GAME | [ESC] CANCEL';
    }

    frameLines.push(...renderFooter(helpStr, cols));

    process.stdout.write(ANSI.clearScreen);
    process.stdout.write(frameLines.join('\n'));
  }

  private renderCustomInputView(cols: number): string[] {
    const innerWidth = Math.max(20, cols - 2);
    const result: string[] = [];

    result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
    const headerStr = '  === TYPE OR PASTE YOUR CUSTOM PASSAGE ===';
    result.push(Palette.neonBorder('║') + Palette.yellow(headerStr.padEnd(innerWidth)) + Palette.neonBorder('║'));
    result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

    const displayInput = this.customTextInput ? `> ${this.customTextInput}` : '> (Type here...)';
    const plainLen = displayInput.length;
    const paddedInput = displayInput + ' '.repeat(Math.max(0, innerWidth - plainLen - 2));
    result.push(Palette.neonBorder('║') + '  ' + Palette.brightWhite(paddedInput.slice(0, innerWidth - 2)) + Palette.neonBorder('║'));

    result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

    return result;
  }

  private async startCountdownAndGame(): Promise<void> {
    this.state = 'COUNTDOWN';
    this.isCountingDown = true;
    this.engine = new GameEngine(this.currentPassage, this.config);

    startGameplayMusic(this.config.soundEnabled);

    await runCountdownSequence((countdownLines) => {
      playCountdownBeep(this.config.soundEnabled);
      const { cols } = getTerminalDimensions();
      const headerLines = renderHeader(this.currentPassage.title, this.currentPassage.author, cols);
      const footerLines = renderFooter('GET READY TO TYPE!', cols);

      const fullScreen = [...headerLines, ...countdownLines, ...footerLines];
      process.stdout.write(ANSI.clearScreen);
      process.stdout.write(fullScreen.join('\n'));
    }, false);

    this.isCountingDown = false;
    this.state = 'PLAYING';
    this.engine.start();
    this.render();
  }

  private handleKeypress(str: string | undefined, key: readline.Key): void {
    if (key.ctrl && key.name === 'c') {
      this.cleanupAndExit();
      return;
    }

    if (this.isCountingDown) return;

    switch (this.state) {
      case 'MENU':
        this.handleMenuInput(key);
        break;

      case 'PASSAGE_SELECT':
        this.handlePassageSelectInput(key);
        break;

      case 'HIGH_SCORES':
        this.handleHighScoresInput(key);
        break;

      case 'PLAYING':
        this.handlePlayingInput(str, key);
        break;

      case 'SUMMARY':
        this.handleSummaryInput(key);
        break;

      case 'INITIALS_ENTRY':
        this.handleInitialsInput(str, key);
        break;

      case 'CUSTOM_INPUT':
        this.handleCustomTextInput(str, key);
        break;
    }
  }

  private handleHighScoresInput(key: readline.Key): void {
    const scores = loadHighScores();
    const maxVisible = Math.max(5, getTerminalDimensions().rows - 14);
    const maxOffset = Math.max(0, scores.length - maxVisible);

    if (key.name === 'up' || key.name === 'k') {
      this.highScoreScrollOffset = Math.max(0, this.highScoreScrollOffset - 1);
      this.render();
    } else if (key.name === 'down' || key.name === 'j') {
      this.highScoreScrollOffset = Math.min(maxOffset, this.highScoreScrollOffset + 1);
      this.render();
    } else if (key.name === 'pageup') {
      this.highScoreScrollOffset = Math.max(0, this.highScoreScrollOffset - maxVisible);
      this.render();
    } else if (key.name === 'pagedown') {
      this.highScoreScrollOffset = Math.min(maxOffset, this.highScoreScrollOffset + maxVisible);
      this.render();
    } else if (key.name === 'home') {
      this.highScoreScrollOffset = 0;
      this.render();
    } else if (key.name === 'end') {
      this.highScoreScrollOffset = maxOffset;
      this.render();
    } else if (key.name === 'escape' || key.name === 'm' || key.name === 'return') {
      this.state = 'MENU';
      this.render();
    }
  }

  private handleMenuInput(key: readline.Key): void {
    if (key.name === 'up') {
      this.menuSelectedIndex = (this.menuSelectedIndex - 1 + 6) % 6;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'down') {
      this.menuSelectedIndex = (this.menuSelectedIndex + 1) % 6;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'return' || key.name === 'space') {
      this.executeMenuAction(this.menuSelectedIndex);
    } else if (key.name && key.name >= '1' && key.name <= '6') {
      const idx = parseInt(key.name, 10) - 1;
      this.executeMenuAction(idx);
    } else if (key.name === 'q') {
      this.cleanupAndExit();
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
        this.render();
        break;

      case 2:
        this.customTextInput = '';
        this.state = 'CUSTOM_INPUT';
        this.render();
        break;

      case 3:
        this.highScoreScrollOffset = 0;
        this.state = 'HIGH_SCORES';
        this.render();
        break;

      case 4:
        this.config.soundEnabled = !this.config.soundEnabled;
        if (this.config.soundEnabled) {
          startMenuMusic(true);
        } else {
          stopMusic();
        }
        this.render();
        break;

      case 5:
        this.cleanupAndExit();
        break;
    }
  }

  private handlePassageSelectInput(key: readline.Key): void {
    const total = LITERARY_PASSAGES.length;
    if (key.name === 'up') {
      this.passageSelectedIndex = (this.passageSelectedIndex - 1 + total) % total;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'down') {
      this.passageSelectedIndex = (this.passageSelectedIndex + 1) % total;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'return' || key.name === 'space') {
      this.currentPassage = LITERARY_PASSAGES[this.passageSelectedIndex];
      this.startCountdownAndGame();
    } else if (key.name === 'escape') {
      this.state = 'MENU';
      this.render();
    }
  }

  private handleCustomTextInput(str: string | undefined, key: readline.Key): void {
    if (key.name === 'escape') {
      this.state = 'MENU';
      this.render();
    } else if (key.name === 'return') {
      if (this.customTextInput.trim().length > 0) {
        this.currentPassage = {
          id: 'custom',
          title: 'Custom Passage',
          author: 'User Author',
          year: new Date().getFullYear(),
          genre: 'Custom Text',
          text: this.customTextInput.trim()
        };
        this.startCountdownAndGame();
      }
    } else if (key.name === 'backspace') {
      this.customTextInput = this.customTextInput.slice(0, -1);
      this.render();
    } else if (str && str.length === 1 && str >= ' ') {
      this.customTextInput += str;
      this.render();
    }
  }

  private handlePlayingInput(str: string | undefined, key: readline.Key): void {
    if (key.name === 'escape') {
      this.state = 'MENU';
      startMenuMusic(this.config.soundEnabled);
      this.render();
      return;
    }

    if (key.ctrl && key.name === 'r') {
      this.startCountdownAndGame();
      return;
    }

    if (key.name === 'backspace') {
      this.engine.handleBackspace();
      this.render();
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      const { isError, completed } = this.engine.handleKey(str);

      if (isError) {
        playBeep(this.config.soundEnabled);
      } else {
        playKeypressSound(this.config.soundEnabled);
      }

      if (completed) {
        this.onGameCompleted();
      } else {
        this.render();
      }
    }
  }

  private onGameCompleted(): void {
    this.state = 'SUMMARY';
    const stats = this.engine.getStats();

    this.scoreRank = getScoreRank(stats.wpm);
    this.isNewHighScore = this.scoreRank > 0;

    stopMusic();

    if (this.scoreRank === 1) {
      playTop1Cheer(this.config.soundEnabled);
    } else if (this.scoreRank >= 2 && this.scoreRank <= 10) {
      playTop10Applause(this.config.soundEnabled);
    } else {
      startMenuMusic(this.config.soundEnabled);
    }

    this.render();
  }

  private handleSummaryInput(key: readline.Key): void {
    if (key.name === 'space' || key.name === 'return') {
      if (this.isNewHighScore) {
        this.initialsInput = ['A', 'A', 'A'];
        this.activeInitialsSlot = 0;
        this.state = 'INITIALS_ENTRY';
        this.render();
      } else {
        this.currentPassage = getRandomPassage();
        this.startCountdownAndGame();
      }
    } else if (key.name === 'r') {
      this.startCountdownAndGame();
    } else if (key.name === 'm' || key.name === 'escape') {
      this.state = 'MENU';
      this.render();
    } else if (key.name === 'q') {
      this.cleanupAndExit();
    }
  }

  private handleInitialsInput(str: string | undefined, key: readline.Key): void {
    if (key.name === 'left') {
      this.activeInitialsSlot = (this.activeInitialsSlot - 1 + 3) % 3;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'right') {
      this.activeInitialsSlot = (this.activeInitialsSlot + 1) % 3;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'up') {
      const charCode = this.initialsInput[this.activeInitialsSlot].charCodeAt(0);
      const nextChar = charCode === 90 ? 'A' : String.fromCharCode(charCode + 1);
      this.initialsInput[this.activeInitialsSlot] = nextChar;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'down') {
      const charCode = this.initialsInput[this.activeInitialsSlot].charCodeAt(0);
      const prevChar = charCode === 65 ? 'Z' : String.fromCharCode(charCode - 1);
      this.initialsInput[this.activeInitialsSlot] = prevChar;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'backspace') {
      this.activeInitialsSlot = Math.max(0, this.activeInitialsSlot - 1);
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (str && /^[a-zA-Z]$/.test(str)) {
      this.initialsInput[this.activeInitialsSlot] = str.toUpperCase();
      this.activeInitialsSlot = Math.min(2, this.activeInitialsSlot + 1);
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'return' || key.name === 'space') {
      const stats = this.engine.getStats();
      const gradeInfo = calculateGrade(stats.wpm, stats.accuracy);

      saveHighScore({
        initials: this.initialsInput.join(''),
        passageTitle: this.currentPassage.title,
        author: this.currentPassage.author,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        grade: gradeInfo.grade
      });
      this.state = 'HIGH_SCORES';
      this.render();
    }
  }
}

const program = new Command();
program
  .name('type-blitz')
  .description('80s Retro Synthwave Terminal Typing Game with Literature Streaming')
  .version('1.0.0')
  .option('-p, --passage <id>', 'Start directly with specific passage ID')
  .parse(process.argv);

const options = program.opts();
const app = new TypeBlitzApp(options.passage);
app.start().catch((err) => {
  console.error('Fatal Type-Blitz error:', err);
  process.exit(1);
});
