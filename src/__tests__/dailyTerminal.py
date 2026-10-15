"""Offline PTY smoke: fixture passages only, isolated scores, no sound/network."""
import fcntl
import json
import os
import pty
import re
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
    expect('NEON REFLEXES READY')
    time.sleep(0.25)  # Cached input loads asynchronously; no status panel is rendered.
    assert 'Sol 6.1' not in output and 'passages' not in output
    assert output.index('QUICK PLAY (DAILY GEN AI)') < output.index('QUICK PLAY (RANDOM CLASSIC')
    send('l')
    expect('[CTRL+R] RESTART')
    send(pack['entries'][0]['passage']['text'])
    expect('RUN COMPLETED')
    send('l')
    expect('ENTER ARCADE INITIALS')
    send('hjkl')
    time.sleep(0.1)
    send('\r')
    expect('RANK | TAG')  # Same initials -> high scores flow as Classic.
    assert 'GET READY TO TYPE' not in output
    send('h')
    expect('QUICK PLAY (DAILY GEN AI)')
    # Keep later fixture rounds out of the top 100 to exercise ordinary Next Passage.
    score_file = os.path.join(root, 'pty-scores.json')
    with open(score_file) as f:
        saved = json.load(f)
    assert saved[0]['initials'] == 'HJL'
    with open(score_file, 'w') as f:
        json.dump([dict(saved[0], id=str(i), wpm=1000000) for i in range(100)], f)
    send('l')
    expect('TYPE THE TEXT AS IT STREAMS')
    expect('[CTRL+R] RESTART')
    plain = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', output)
    header_match = re.search(r'╔[^\r\n]*?SYNTHWAVE \|[^\r\n]*?╗', plain)
    assert header_match is not None
    header = header_match.group()
    assert not re.search(r'DAILY \d+/', plain)
    assert 'Sol 6.1' not in plain and pack['day'] not in plain
    send('\x12')  # Ctrl+R keeps this exact randomly chosen passage.
    expect('[CTRL+R] RESTART')
    assert header in re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', output), 'restart must preserve the selected passage header'
    send(pack['entries'][0]['passage']['text'])
    expect('RUN COMPLETED')
    expect('Next Passage')
    send('l')
    expect('[CTRL+R] RESTART')
    plain = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', output)
    assert any(e['passage']['title'][:30].upper() in plain for e in pack['entries']), 'Next stays in daily pool'
    assert not re.search(r'DAILY \d+/', plain)
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
    assert 'DAILY ' not in output, 'no mode-specific banner decorations'
    send('\x1b')
    expect('QUICK PLAY (DAILY GEN AI)')
    send('q')
    child.wait(timeout=5)
    assert child.returncode == 0
    with open(os.path.join(root, 'pty-scores.json')) as f:
        scores = json.load(f)
    assert len(scores) == 100 and scores[0]['initials'] == 'HJL', 'ordinary Next must not save an extra high score'
    print('Daily terminal smoke passed: menu, typing, scores, next, restart, HJKL, classic/custom isolation.')
finally:
    if child.poll() is None:
        child.terminate()
        child.wait(timeout=5)
    os.close(master)
