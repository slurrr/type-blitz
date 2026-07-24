import figlet from 'figlet';
import { Palette, getTerminalDimensions } from './ansi.js';
import { visibleLength, formatFramedLine } from './ansiUtils.js';
import { playBeep } from '../sound/audio.js';

export function renderCountdownFrame(count: number | string): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  let bigText = '';
  try {
    bigText = figlet.textSync(count.toString(), { font: 'Standard' });
  } catch {
    bigText = `\n   ===  ${count}  ===   \n`;
  }

  const lines = bigText.split('\n').filter(l => l.trim().length > 0);

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  for (const line of lines) {
    const plainLength = line.length;
    const margin = Math.max(0, Math.floor((innerWidth - plainLength) / 2));

    let coloredLine = '';
    if (count === 'GET READY!') {
      coloredLine = Palette.yellow(line);
    } else if (count === '3') {
      coloredLine = Palette.magenta(line);
    } else if (count === '2') {
      coloredLine = Palette.cyan(line);
    } else if (count === '1') {
      coloredLine = Palette.neonOrangeFg(line);
    } else {
      coloredLine = Palette.green(line);
    }

    const content = ' '.repeat(margin) + coloredLine;
    result.push(formatFramedLine(Palette.neonBorder('║'), content, Palette.neonBorder('║'), cols));
  }

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  return result;
}

export async function runCountdownSequence(
  renderCallback: (frameLines: string[]) => void,
  soundEnabled: boolean = true
): Promise<void> {
  const steps = ['GET READY!', '3', '2', '1', 'GO!'];
  for (const step of steps) {
    playBeep(soundEnabled);
    const frame = renderCountdownFrame(step);
    renderCallback(frame);
    await new Promise(resolve => setTimeout(resolve, step === 'GO!' ? 400 : 700));
  }
}
