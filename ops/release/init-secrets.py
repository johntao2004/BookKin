#!/usr/bin/env python3
# 保留已有 AI 设置加密密钥，或在允许初始化时原子写入新密钥；已有加密数据时拒绝缺钥重建。
# Preserves an existing AI-settings encryption key or atomically initializes one when allowed; refuses replacement when encrypted data already exists.
# 初始化持久化部署密钥；不打印或轮换已有密钥。
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
