#!/usr/bin/env python3
"""Production frontend prepare/switch/rollback. Invoked manually with sudo."""
import argparse
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import time

PROJECT = Path('/opt/sarva')
CONFIG = Path('/etc/nginx/conf.d/sarva.conf')
STATE = Path('/var/lib/sarva-frontend-deploy/state.json')
UPSTREAM = re.compile(r'(proxy_pass\s+http://127\.0\.0\.1:)(8090|8091)(\s*;)')

def active_port(text):
    matches = list(UPSTREAM.finditer(text))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one SARVA frontend proxy on port 8090 or 8091')
    return int(matches[0].group(2))

def switched_config(text, port):
    active_port(text)
    if port not in (8090, 8091):
        raise ValueError('Invalid frontend port')
    return UPSTREAM.sub(lambda m: m[1] + str(port) + m[3], text)

def run(*args, capture=False):
    return subprocess.run(args, cwd=PROJECT, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout

def container_for(port):
    return 'sarva-frontend' if port == 8090 else 'sarva-frontend-green'

def probe(url, hostname=None):
    args = ['curl', '--fail', '--silent', '--show-error', '--connect-timeout', '3', '--max-time', '5', '-o', '/dev/null']
    if hostname:
        args += ['--resolve', hostname + ':443:127.0.0.1']
    return subprocess.run(args + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

def ready(port):
    for _ in range(30):
        if all(probe(f'http://127.0.0.1:{port}{path}') for path in ('/', '/api/health')):
            return
        time.sleep(2)
    raise RuntimeError('Candidate frontend did not pass homepage/API readiness checks; live proxy unchanged')

def write_config(text):
    # Atomic replace in the same directory, preserving owner/mode.
    fd, path = tempfile.mkstemp(prefix='.sarva-bluegreen-', dir=CONFIG.parent)
    try:
        with os.fdopen(fd, 'w') as handle:
            handle.write(text)
        shutil.copystat(CONFIG, path)
        stat = CONFIG.stat()
        os.chown(path, stat.st_uid, stat.st_gid)
        os.replace(path, CONFIG)
    finally:
        if os.path.exists(path):
            os.unlink(path)

def save_state(data):
    with STATE.open('w') as handle:
        json.dump(data, handle, indent=2)
    STATE.chmod(0o600)

def prepare():
    original = CONFIG.read_text()
    old = active_port(original)
    new = 8091 if old == 8090 else 8090
    run('nginx', '-t')
    ready(old)
    run('docker', 'compose', 'config', '--quiet')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
    backup = Path('/var/backups/sarva-frontend-bluegreen') / stamp
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(CONFIG, backup / 'sarva.conf')
    old_id = run('docker', 'inspect', container_for(old), '--format', '{{.Image}}', capture=True).strip()
    rollback_tag = 'sarva-frontend:rollback-bluegreen-' + stamp
    run('docker', 'tag', old_id, rollback_tag)
    (backup / 'rollback-image.txt').write_text(rollback_tag + '\n')
    if new == 8091:
        # Never touch the active slot. Refuse a foreign listener on the inactive port.
        inspect = subprocess.run(['docker', 'inspect', container_for(new)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        if inspect.returncode == 0:
            item = json.loads(inspect.stdout)[0]
            if item['Config'].get('Labels', {}).get('com.docker.compose.service') != 'frontend':
                raise RuntimeError('Inactive green name belongs to another service')
            run('docker', 'rm', '-f', container_for(new))
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', new))
        run('docker', 'compose', 'run', '-d', '--no-deps', '--name', container_for(new),
            '--publish', f'127.0.0.1:{new}:80', 'frontend')
        run('docker', 'update', '--restart', 'unless-stopped', container_for(new))
    else:
        run('docker', 'compose', 'up', '-d', '--no-deps', 'frontend')
    # Preserve previous hashed assets for open tabs and lazy-loaded routes.
    with tempfile.TemporaryDirectory(prefix='sarva-previous-assets-') as directory:
        run('docker', 'cp', container_for(old) + ':/usr/share/nginx/html/assets', directory)
        run('docker', 'cp', directory + '/assets/.', container_for(new) + ':/usr/share/nginx/html/assets')
    ready(new)
    data = dict(status='prepared', old_port=old, new_port=new, original=original,
                backup=str(backup), rollback_tag=rollback_tag,
                candidate_id=run('docker', 'inspect', container_for(new), '--format', '{{.Id}}', capture=True).strip())
    save_state(data)
    print(f'PREPARED port {new}; live still uses {old}. Backup: {backup}')
    print('Next: sudo python3 scripts/deploy-frontend-bluegreen.py switch')

def switch(data):
    original = CONFIG.read_text()
    if data['status'] != 'prepared' or original != data['original']:
        raise RuntimeError('Prepared state or Nginx configuration changed; prepare again')
    candidate = run('docker', 'inspect', container_for(data['new_port']), '--format', '{{.Id}}', capture=True).strip()
    if candidate != data['candidate_id']:
        raise RuntimeError('Candidate container changed; prepare again')
    ready(data['new_port'])
    replacement = switched_config(original, data['new_port'])
    try:
        write_config(replacement)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        for host, path in [('sarva.saeon.ac.za', '/'), ('sarva.saeon.ac.za', '/api/health'), ('ds-lab.saeon.ac.za', '/')]:
            if not probe('https://' + host + path, host):
                raise RuntimeError('Post-switch HTTPS check failed: ' + host + path)
    except BaseException:
        write_config(original)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        raise
    data.update(status='switched', switched=replacement)
    save_state(data)
    print(f'SWITCHED to {data["new_port"]}; previous container on {data["old_port"]} retained.')

def rollback(data):
    if data['status'] != 'switched' or CONFIG.read_text() != data['switched']:
        raise RuntimeError('Configuration changed since switch; refusing to overwrite it')
    ready(data['old_port'])
    current = CONFIG.read_text()
    try:
        write_config(data['original'])
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        if not probe('https://sarva.saeon.ac.za/', 'sarva.saeon.ac.za'):
            raise RuntimeError('Rollback HTTPS check failed')
    except BaseException:
        write_config(current)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        raise
    data['status'] = 'rolled-back'
    save_state(data)
    print('ROLLED BACK; both frontend containers retained.')

def deployment_notice(active):
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = dict(active=active, startedAt=now.isoformat(), expiresAt=(now + datetime.timedelta(minutes=45)).isoformat())
    # The same backend serves this public, non-sensitive marker to both slots.
    # Atomic write, no secrets or internal deployment state exposed.
    javascript = "const fs=require('fs');const p='/app/public/deployment-status.json';let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>{JSON.parse(data);fs.writeFileSync(p+'.tmp',data,{mode:0o644});fs.renameSync(p+'.tmp',p);});"
    subprocess.run(['docker','exec','-i','sarva-backend','node','-e',javascript],
                   cwd=PROJECT, input=json.dumps(payload), text=True, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['build', 'prepare', 'switch', 'rollback', 'status', 'notice-on', 'notice-off'])
    args = parser.parse_args()
    if os.geteuid() != 0 or socket.gethostname().split('.')[0].lower() != 'ulwsarvadsl01':
        raise SystemExit('Run with sudo on ULWSARVADSL01 only')
    STATE.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    with (STATE.parent / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.action in ('build', 'prepare'):
            deployment_notice(True)
            try:
                if args.action == 'build':
                    run('docker', 'compose', 'build', 'frontend')
                else:
                    prepare()
            except BaseException:
                deployment_notice(False)
                raise
        elif args.action in ('notice-on', 'notice-off'):
            deployment_notice(args.action == 'notice-on')
        elif args.action == 'status':
            print('Nginx frontend port:', active_port(CONFIG.read_text()))
            if STATE.exists():
                data = json.loads(STATE.read_text())
                print(json.dumps({key: value for key, value in data.items() if key not in ('original', 'switched')}, indent=2))
        else:
            data = json.loads(STATE.read_text())
            try:
                (switch if args.action == 'switch' else rollback)(data)
            finally:
                deployment_notice(False)

if __name__ == '__main__':
    main()
