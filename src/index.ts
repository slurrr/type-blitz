import readline from 'node:readline';
import { Command } from 'commander';
import { Passage, GameState, GameConfig } from './types.js';
import { navigationKey, MENU_ACTIONS } from './navigation.js';
import { DailyClient } from './daily/client.js';
import { DailyDeck, dailyDay, dailyDirectory, dailyStatus } from './daily/session.js';
import { renderDailyWaitingView } from './renderer/dailyView.js';
import { LITERARY_PASSAGES, getRandomPassage, getPassageById } from './passages/passages.js';
import { GameEngine } from './engine/gameEngine.js';
import { ANSI, Palette, getTerminalDimensions, renderTerminalFrame } from './renderer/ansi.js';
import { renderHeader, renderFooter } from './renderer/retroHeader.js';
import { renderStreamView } from './renderer/streamView.js';
import { TypingEffects, EFFECT_FPS } from './renderer/typingEffects.js';
import { KittyEffects, FLAME_ROW_OFFSET } from './renderer/kittyEffects.js';
import { normalizeFramedLines } from './renderer/displayWidth.js';
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
  stopMusic,
  stopAllAudio
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
  private effects = new TypingEffects();
  private graphics = new KittyEffects();
  private animationTimer?: ReturnType<typeof setInterval>;
  private previousFrame: string[] = [];
  private daily: DailyClient;
  private dailyDeck?: DailyDeck;

  private initialsInput: string[] = ['A', 'A', 'A'];
  private activeInitialsSlot: number = 0;

  constructor(private options: { passage?: string; daily?: boolean; dailyDir?: string; sound?: boolean } = {}) {
    const selected = options.passage ? getPassageById(options.passage) : undefined;
    this.currentPassage = selected || getRandomPassage();
    this.config.soundEnabled = options.sound !== false;
    this.engine = new GameEngine(this.currentPassage, this.config);
    this.daily = new DailyClient(options.dailyDir, () => {
      if (this.state === 'MENU' || this.state === 'DAILY_WAIT') this.render();
    });
  }

  public async start(): Promise<void> {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.resume();

    process.stdout.write(ANSI.hideCursor);

    process.stdout.on('resize', () => {
      this.graphics.invalidateSize();
      this.render();
    });
    this.animationTimer = setInterval(() => {
      // Drop animation frames rather than queueing stale graphics behind a slow PTY.
      if (this.state === 'PLAYING' && process.stdout.writableLength === 0) this.render(true);
    }, 1000 / EFFECT_FPS);
    process.stdin.on('keypress', (str: string | undefined, key: readline.Key) => this.handleKeypress(str, key));

    process.on('SIGINT', () => this.cleanupAndExit());
    process.on('SIGTERM', () => this.cleanupAndExit());
    process.on('SIGHUP', () => this.cleanupAndExit());

    // Start background chill menu music loop
    startMenuMusic(this.config.soundEnabled);

    this.render();
    if (this.options.daily === false) void this.daily.load();
    else void this.daily.run();
    if (this.options.passage && getPassageById(this.options.passage)) void this.startCountdownAndGame();
  }

  private cleanupAndExit(): void {
    this.daily.dispose();
    stopAllAudio();
    clearInterval(this.animationTimer);
    process.stdout.write(this.graphics.clear() + ANSI.showCursor);
    process.stdout.write(ANSI.reset + '\n');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }

  private render(animationOnly = false): void {
    if (this.isCountingDown) return;

    // Music control per state
    if (!animationOnly && this.state === 'PLAYING') {
      startGameplayMusic(this.config.soundEnabled);
    } else if (!animationOnly && (this.state === 'MENU' || this.state === 'PASSAGE_SELECT' || this.state === 'HIGH_SCORES' || this.state === 'INITIALS_ENTRY' || this.state === 'CUSTOM_INPUT' || this.state === 'DAILY_WAIT')) {
      startMenuMusic(this.config.soundEnabled);
    }

    const frameLines: string[] = [];

    const headerLines = renderHeader(
      this.state === 'PLAYING' || this.state === 'COUNTDOWN' || this.state === 'SUMMARY' || this.state === 'INITIALS_ENTRY'
        ? this.passageTitle()
        : undefined,
      this.currentPassage.author
    );
    frameLines.push(...headerLines);
    const now = performance.now();
    const { cols, rows } = getTerminalDimensions();
    const cells = this.state === 'PLAYING' ? this.effects.sample(this.engine, cols, now) : [];
    const useKitty = this.graphics.enabled && rows >= headerLines.length + 12;

    switch (this.state) {
      case 'MENU':
        frameLines.push(...renderMenuView(this.menuSelectedIndex, this.config.soundEnabled,
          this.daily.message + (this.daily.busy ? '...' : ''), this.dailyDetail()));
        break;

      case 'DAILY_WAIT':
        frameLines.push(...renderDailyWaitingView(this.daily.message, this.dailyDetail(), this.daily.error));
        break;

      case 'PASSAGE_SELECT':
        frameLines.push(...renderPassageSelectView(this.passageSelectedIndex));
        break;

      case 'HIGH_SCORES':
        const scores = loadHighScores();
        const maxVisible = Math.max(5, getTerminalDimensions().rows - 14);
        frameLines.push(...renderHighScoresView(scores, this.highScoreScrollOffset, maxVisible));
        break;

      case 'PLAYING':
        frameLines.push(...renderStreamView(this.engine, { cells, kitty: useKitty, now }));
        break;

      case 'SUMMARY':
        frameLines.push(...renderSummaryView(this.engine, this.isNewHighScore));
        break;

      case 'INITIALS_ENTRY':
        frameLines.push(
          ...renderInitialsEntryView(
            this.initialsInput,
            this.activeInitialsSlot,
            this.engine.getStats().wpm
          )
        );
        break;

      case 'CUSTOM_INPUT':
        frameLines.push(...this.renderCustomInputView());
        break;
    }

    let helpStr = 'TYPE-BLITZ 1984 | 80S RETRO SYNTHWAVE TYPING ENGINE';
    if (this.state === 'PLAYING') {
      helpStr = (this.dailyDeck ? `DAILY ${this.dailyDeck.pack.day} ${this.dailyDeck.position}/8` : 'TYPE THE TEXT AS IT STREAMS') + ' | [ESC] MENU | [CTRL+R] RESTART';
    } else if (this.state === 'MENU') {
      helpStr = '[J/K] MOVE | [L/ENTER] SELECT | [R] REFRESH DAILY | [Q] QUIT';
    } else if (this.state === 'DAILY_WAIT') {
      helpStr = '[L/ENTER] PLAY SAVED | [R] REFRESH DAILY | [H/ESC] BACK';
    } else if (this.state === 'PASSAGE_SELECT') {
      helpStr = '[J/K, ↑/↓] MOVE | [L/ENTER] START | [H/ESC] BACK';
    } else if (this.state === 'INITIALS_ENTRY') {
      helpStr = 'ENTER INITIALS | [UP/DOWN] CHANGE | [LEFT/RIGHT] SLOT | [ENTER] SAVE';
    } else if (this.state === 'CUSTOM_INPUT') {
      helpStr = 'TYPE/PASTE YOUR TEXT | [ENTER] START GAME | [ESC] CANCEL';
    }

    frameLines.push(...renderFooter(helpStr));

    let output = '';
    if (animationOnly && this.previousFrame.length === frameLines.length) {
      // Leave the banner and other unchanged text alone on animation ticks.
      frameLines.forEach((line, index) => {
        if (line !== this.previousFrame[index]) output += ANSI.moveTo(index + 1, 1) + line;
      });
    } else {
      output = renderTerminalFrame(frameLines);
    }
    this.previousFrame = frameLines;
    output += this.state === 'PLAYING' && useKitty
      ? this.graphics.draw(cells, Math.floor(Math.max(0, cols - 2) / 2), headerLines.length + FLAME_ROW_OFFSET + 1, now)
      : this.graphics.clear();
    if (output) process.stdout.write(output);
  }

  private dailyDetail(): string {
    const pack = this.daily.pack;
    const saved = pack ? `${pack.day}${pack.day !== dailyDay() ? ' (OLDER PACK)' : ''} | ${pack.entries.length} passages | Sol 6.1 low` : 'No saved pack yet | Sol 6.1 low';
    return saved + (this.daily.error ? ' | ' + this.daily.error : '');
  }

  private passageTitle(): string {
    return this.dailyDeck ? `DAILY ${this.dailyDeck.position}/8 | ${this.currentPassage.title}` : this.currentPassage.title;
  }

  private startDaily(): void {
    if (!this.daily.pack) {
      this.state = 'DAILY_WAIT';
      this.render();
      return;
    }
    if (this.dailyDeck?.pack.id !== this.daily.pack.id) this.dailyDeck = new DailyDeck(this.daily.pack);
    this.currentPassage = this.dailyDeck.current().passage;
    void this.startCountdownAndGame();
  }

  private nextPassage(): void {
    this.currentPassage = this.dailyDeck ? this.dailyDeck.next().passage : getRandomPassage();
    void this.startCountdownAndGame();
  }

  private renderCustomInputView(): string[] {
    const { cols } = getTerminalDimensions();
    const innerWidth = Math.max(20, cols - 4);
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
    result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

    return normalizeFramedLines(result, cols);
  }

  private async startCountdownAndGame(): Promise<void> {
    process.stdout.write(this.graphics.clear());
    this.effects.reset();
    this.previousFrame = [];
    this.state = 'COUNTDOWN';
    this.isCountingDown = true;
    this.engine = new GameEngine(this.currentPassage, this.config);

    startGameplayMusic(this.config.soundEnabled);

    await runCountdownSequence((countdownLines) => {
      playCountdownBeep(this.config.soundEnabled);
      const headerLines = renderHeader(this.passageTitle(), this.currentPassage.author);
      const footerLines = renderFooter('GET READY TO TYPE!');

      const fullScreen = [...headerLines, ...countdownLines, ...footerLines];
      process.stdout.write(renderTerminalFrame(fullScreen));
    }, false); // Audio handled in loop callback

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
    key = navigationKey(this.state, key);

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

      case 'DAILY_WAIT':
        if (key.name === 'escape') { this.state = 'MENU'; this.render(); }
        else if (key.name === 'r') void this.daily.run(true);
        else if (key.name === 'return' || key.name === 'space') this.startDaily();
        break;
    }
  }

  private handleHighScoresInput(key: readline.Key): void {
    const scores = loadHighScores();
    const maxVisible = Math.max(5, getTerminalDimensions().rows - 14);
    const maxOffset = Math.max(0, scores.length - maxVisible);

    if (key.name === 'up') {
      this.highScoreScrollOffset = Math.max(0, this.highScoreScrollOffset - 1);
      this.render();
    } else if (key.name === 'down') {
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
      this.menuSelectedIndex = (this.menuSelectedIndex - 1 + MENU_ACTIONS.length) % MENU_ACTIONS.length;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'down') {
      this.menuSelectedIndex = (this.menuSelectedIndex + 1) % MENU_ACTIONS.length;
      playKeypressSound(this.config.soundEnabled);
      this.render();
    } else if (key.name === 'return' || key.name === 'space') {
      this.executeMenuAction(this.menuSelectedIndex);
    } else if (key.name && key.name >= '1' && key.name <= String(MENU_ACTIONS.length)) {
      const idx = parseInt(key.name, 10) - 1;
      this.executeMenuAction(idx);
    } else if (key.name === 'r') {
      void this.daily.run(true);
    } else if (key.name === 'q') {
      this.cleanupAndExit();
    }
  }

  private executeMenuAction(index: number): void {
    switch (MENU_ACTIONS[index]) {
      case 'daily':
        this.startDaily();
        break;

      case 'classic':
        this.dailyDeck = undefined;
        this.currentPassage = getRandomPassage();
        this.startCountdownAndGame();
        break;

      case 'select':
        this.state = 'PASSAGE_SELECT';
        this.render();
        break;

      case 'custom':
        this.customTextInput = '';
        this.state = 'CUSTOM_INPUT';
        this.render();
        break;

      case 'scores':
        this.highScoreScrollOffset = 0;
        this.state = 'HIGH_SCORES';
        this.render();
        break;

      case 'sound':
        this.config.soundEnabled = !this.config.soundEnabled;
        if (this.config.soundEnabled) {
          startMenuMusic(true);
        } else {
          stopMusic();
        }
        this.render();
        break;

      case 'exit':
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
      this.dailyDeck = undefined;
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
        this.dailyDeck = undefined;
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
      const result = this.engine.handleBackspace();
      if (result === 'blocked') playBeep(this.config.soundEnabled);
      if (result === 'erased') this.effects.rewind(this.engine.typedInput.length);
      this.render();
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      const index = this.engine.typedInput.length;
      const { isError, completed } = this.engine.handleKey(str);
      this.effects.record(index);

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
      // #1 Top Score Victory Fanfare & Cheer!
      playTop1Cheer(this.config.soundEnabled);
    } else if (this.scoreRank >= 2 && this.scoreRank <= 10) {
      // Top 10 High Score Level-Clear Applause!
      playTop10Applause(this.config.soundEnabled);
    } else {
      // No high score -> Chill synthwave loop while looking at stats
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
        this.nextPassage();
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

      if (this.dailyDeck) this.nextPassage();
      else {
        this.state = 'HIGH_SCORES';
        startMenuMusic(this.config.soundEnabled);
        this.render();
      }
    }
  }
}

const program = new Command();
program
  .name('type-blitz')
  .description('80s Retro Synthwave Terminal Typing Game with Classic Literature Streaming')
  .version('1.0.0')
  .option('-p, --passage <id>', 'Start directly with specific passage ID')
  .option('-l, --list', 'List all available literature passages')
  .option('--daily-refresh', 'Collect fresh sources and generate a daily pack, then exit')
  .option('--daily-status', 'Show saved daily pack/status without any network calls')
  .option('--daily-dir <path>', 'Daily game runtime directory (separate from voice previews)', dailyDirectory())
  .option('--no-daily', 'Skip automatic generation; saved daily packs remain playable')
  .option('--no-sound', 'Start with sound disabled')
  .action(async (options) => {
    if (options.list) {
      console.log('\n📚 AVAILABLE LITERATURE PASSAGES:\n');
      LITERARY_PASSAGES.forEach((p) => {
        console.log(`  • [${p.id}] "${p.title}" by ${p.author} (${p.year}) - ${p.genre}`);
      });
      console.log('');
      process.exit(0);
    }

    if (options.dailyStatus) {
      console.log(JSON.stringify(await dailyStatus(options.dailyDir), null, 2));
      return;
    }
    if (options.dailyRefresh) {
      const client = new DailyClient(options.dailyDir, () => console.log(client.message));
      process.once('SIGINT', () => client.dispose());
      process.once('SIGTERM', () => client.dispose());
      const result = await client.run(true);
      if (result.pack) console.log(`Daily pack available: ${result.pack.day}, ${result.pack.entries.length} passages in ${options.dailyDir}${result.error ? ' (previous pack retained)' : ''}`);
      if (result.error) { console.error(result.error); process.exitCode = 1; }
      return;
    }
    const app = new TypeBlitzApp(options);
    app.start().catch((err) => {
      console.error('Fatal Error:', err);
      process.exit(1);
    });
  });

program.parseAsync(process.argv).catch(error => { console.error(error.message); process.exitCode = 1; });
