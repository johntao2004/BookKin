#!/usr/bin/env python3
"""Initialize persistent deployment secrets. Never print or rotate an existing key."""
import os
from pathlib import Path
import re
import secrets
import sys
import tempfile


def initialize(path, encrypted=False):
    path = Path(path)
    text = path.read_text() if path.exists() else ''
    pattern = r'^BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY\s*=(.*)$'
    entries = re.findall(pattern, text, re.M)
    if any(value.strip().strip('\"\'') for value in entries):
        os.chmod(path, 0o600)
        return False
    if encrypted:
        raise RuntimeError('Existing encrypted AI credentials require restoring the original encryption key.')
    text = re.sub(pattern, '', text, flags=re.M).rstrip() + '\n'
    text += 'BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY=' + secrets.token_hex(32) + '\n'
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.env-')
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True


if __name__ == '__main__':
    initialize(sys.argv[1], len(sys.argv) > 2 and sys.argv[2] != '0')
    print('Persistent AI encryption key ready.')
