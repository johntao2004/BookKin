#!/usr/bin/env python3
"""Read-only release checks. Never creates accounts or changes library data."""
import argparse
import json
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

parser = argparse.ArgumentParser()
parser.add_argument('base_url')
parser.add_argument('--routes', required=True)
args = parser.parse_args()
base = args.base_url.rstrip('/')
paths = json.load(open(args.routes))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(path):
    try:
        with opener.open(base + path, timeout=15) as r:
            return r.status, r.headers.get('Content-Type', ''), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Content-Type', ''), e.read()

def page(path):
    code, mime, body = get(path)
    if code != 200 or 'text/html' not in mime or b'id="root"' not in body:
        raise RuntimeError(f'{path}: expected SPA HTML, got {code} {mime}')
    return body.decode()

pages = list(ThreadPoolExecutor(max_workers=4).map(page, paths))
# Check every JS/CSS chunk referenced by the entry and its imports, not just index.html.
assets = set()
queue = set(re.findall(r'(?:src|href)="(/assets/[^"?#]+)', pages[0]))
while queue:
    path = queue.pop()
    if path in assets:
        continue
    code, mime, body = get(path)
    if code != 200 or 'text/html' in mime:
        raise RuntimeError(f'{path}: missing or incorrect asset ({code} {mime})')
    assets.add(path)
    if path.endswith('.js'):
        content = body.decode()
        for asset in re.findall(r'["\'](?:\./|/assets/|assets/)?([A-Za-z0-9_.-]+\.(?:js|css))["\']', content):
            queue.add('/assets/' + asset)
for path in ['/api/v1/books', '/api/v1/users', '/api/v1/library-roots', '/api/v1/annotations']:
    code, _, _ = get(path)
    if code not in (401, 403):
        raise RuntimeError(f'{path}: unauthenticated request was not denied ({code})')
code, _, body = get('/actuator/health/readiness')
if code != 200 or json.loads(body).get('status') != 'UP':
    raise RuntimeError('readiness is not UP')
print(f'PASS: {len(paths)} page routes, {len(assets)} JS/CSS assets, 4 private API boundaries, readiness UP')
