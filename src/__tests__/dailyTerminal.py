"""Offline PTY smoke: fixture passages only, isolated scores, no sound/network."""
import fcntl
import json
import os
import pty
import select
import struct
import subprocess
import sys
import termios
import time

root = sys.argv[1]
with open(os.path.join(root, 'current.json')) as f:
    pack = json.load(f)
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
env = dict(os.environ, TERM='xterm-256color', TYPE_BLITZ_EFFECTS='ansi',
           TYPE_BLITZ_SCORES_FILE=os.path.join(root, 'pty-scores.json'))
child = subprocess.Popen(['node', '--import', 'tsx', 'src/index.ts', '--no-daily', '--no-sound',
                          '--daily-dir', root], stdin=slave, stdout=slave, stderr=slave, env=env)
os.close(slave)
output = ''


def expect(text, timeout=10):
    global output
    end = time.monotonic() + timeout
    while text not in output and time.monotonic() < end:
        if select.select([master], [], [], 0.1)[0]:
            try:
                data = os.read(master, 65536)
            except OSError:
                break
            if not data:
                break
            output += data.decode('utf8', errors='replace')
    assert text in output, 'Missing ' + repr(text) + '\nTerminal tail:\n' + output[-5000:]


def send(text):
    global output
    output = ''
    os.write(master, text.encode())


try:
    expect('QUICK PLAY (DAILY GEN AI)')
    expect('Saved daily pack ready')
    assert output.index('QUICK PLAY (DAILY GEN AI)') < output.index('QUICK PLAY (RANDOM CLASSIC')
    send('l')
    expect('DAILY 1/8')
    expect('[CTRL+R] RESTART')
    send(pack['entries'][0]['passage']['text'])
    expect('RUN COMPLETED')
    send('l')
    expect('ENTER ARCADE INITIALS')
    send('hjkl')
    time.sleep(0.1)
    send('\r')
    expect('DAILY 2/8')
    expect('[CTRL+R] RESTART')
    send('\x12')  # Ctrl+R restarts this daily passage; it must not advance to the next one.
    expect('DAILY 2/8')
    expect('[CTRL+R] RESTART')
    send('\x1b')
    expect('QUICK PLAY (DAILY GEN AI)')
    send('3')
    expect('SELECT LITERATURE PASSAGE')
    send('h')
    expect('QUICK PLAY (DAILY GEN AI)')
    send('4')
    expect('TYPE OR PASTE YOUR CUSTOM PASSAGE')
    send('hjkl')
    expect('> hjkl')
    send('\x1b')
    expect('QUICK PLAY (DAILY GEN AI)')
    send('2')
    expect('TYPE THE TEXT AS IT STREAMS')
    assert 'DAILY 2/8' not in output, 'classic round must clear the daily deck'
    send('\x1b')
    expect('QUICK PLAY (DAILY GEN AI)')
    send('q')
    child.wait(timeout=5)
    assert child.returncode == 0
    with open(os.path.join(root, 'pty-scores.json')) as f:
        scores = json.load(f)
    assert scores[0]['initials'] == 'HJL', 'hjkl remain ordinary initials entry'
    print('Daily terminal smoke passed: menu, typing, scores, next, restart, HJKL, classic/custom isolation.')
finally:
    if child.poll() is None:
        child.terminate()
        child.wait(timeout=5)
    os.close(master)
