#!/usr/bin/env python3
"""Manage local-only preview credentials without putting passwords in arguments."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import tempfile

root = Path(__file__).resolve().parents[1]
directory = root / '.local' / 'preview-access'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('command', choices=['init', 'show', 'set'])
parser.add_argument('--local-short-password', action='store_true', help='Allow 4–9 characters for loopback-only testing; blocked in production.')
args = parser.parse_args()
os.umask(0o077)
directory.mkdir(parents=True, exist_ok=True)
credential_directory = directory / 'auth'
credential_directory.mkdir(exist_ok=True)
credential_file = credential_directory / 'credentials.json'
legacy_file = directory / 'credentials.json'
if not credential_file.exists() and legacy_file.exists():
    legacy_file.replace(credential_file)
login_file = directory / 'local-login.txt'

if args.command == 'show':
    if not login_file.exists():
        raise SystemExit('No generated login note exists. Use the credentials you chose, or run set to replace them.')
    print(login_file.read_text())
elif args.command == 'init' and credential_file.exists():
    print('Existing local preview credentials retained.')
else:
    if args.command == 'init':
        username, password = 'dev', secrets.token_urlsafe(24)
    else:
        username = input('Dev username: ').strip()
        password = getpass.getpass('New local test password (4–9 characters): ' if args.local_short_password else 'New preview password (at least 16 characters): ')
        if password != getpass.getpass('Confirm password: '):
            raise SystemExit('Passwords did not match. Nothing changed.')
    minimum, maximum = (4, 9) if args.local_short_password else (16, 256)
    if not re.fullmatch(r'[a-zA-Z0-9._-]{2,64}', username) or not minimum <= len(password) <= maximum:
        raise SystemExit(f'Use a 2–64 character username (letters, digits, . _ -) and a {minimum}–{maximum} character password.')
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64, maxmem=64*1024*1024).hex()
    handle, temporary = tempfile.mkstemp(prefix='credentials-', dir=credential_directory)
    with os.fdopen(handle, 'w') as stream:
        json.dump({'username': username, 'salt': salt, 'digest': digest, 'localOnly': args.local_short_password}, stream)
    os.replace(temporary, credential_file)
    if args.command == 'init':
        login_file.write_text(f'LOCAL TEST ONLY — do not reuse for an internet preview.\nURL: http://127.0.0.1:5180\nUsername: {username}\nPassword: {password}\n')
    elif login_file.exists():
        login_file.unlink()
    print('Local preview credential hash saved. Password was not printed.')
    print('Restart preview-auth after replacing credentials; existing sessions will be invalidated.')
