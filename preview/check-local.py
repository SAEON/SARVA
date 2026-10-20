"""Exercise the local gateway without printing credentials or session cookies."""
import http.cookiejar
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

base = 'http://127.0.0.1:5180'
note = (Path(__file__).resolve().parents[1] / '.local/preview-access/local-login.txt').read_text()
username = re.search(r'^Username: (.+)$', note, re.M).group(1)
password = re.search(r'^Password: (.+)$', note, re.M).group(1)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)
anonymous = urllib.request.build_opener(NoRedirect)

def request(path, fields=None, headers=None, opener=client):
    data = urllib.parse.urlencode(fields).encode() if fields is not None else None
    req = urllib.request.Request(base + path, data=data, headers=headers or {})
    if data is not None:
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        response = opener.open(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    return response.code, response.headers, response.read()

protected = ['/', '/api/health', '/api/data-health', '/api/fire-detections', '/api/disaster-events', '/tiles/municipal_boundaries/5/18/18', '/public/test', '/assets/test.js', '/@vite/client']
for path in protected:
    assert request(path, opener=anonymous)[0] == 401, f'Anonymous access must fail: {path}'
code, headers, _ = request('/', headers={'Accept': 'text/html'}, opener=anonymous)
assert code == 303 and headers['Location'] == '/__preview/login', 'Login redirects must retain the browser port/host'
assert request('/__preview/check', opener=anonymous)[0] == 404
assert request('/__preview/login', opener=anonymous)[0] == 200
assert request('/__preview/login.css', opener=anonymous)[0] == 200
fields = {'username': username, 'password': password}
assert request('/__preview/login', fields, {'Origin': 'https://other.example'})[0] == 403
assert request('/__preview/login', {'username': username, 'password': 'incorrect'}, {'Origin': base})[0] == 401
code, headers, _ = request('/__preview/login', fields, {'Origin': base})
assert code == 303
cookie = headers['Set-Cookie'].split(';')[0]
assert 'HttpOnly' in headers['Set-Cookie'] and 'SameSite=Lax' in headers['Set-Cookie']
code, headers, body = request('/')
assert code == 200 and b'/@vite/client' in body
assert headers['Cache-Control'] == 'private, no-store'
assert request('/@vite/client')[0] == 200
code, _, body = request('/api/health', headers={'Authorization': 'Bearer preserved-test-header'})
assert code == 200 and json.loads(body)['db'] is True
assert request('/api/data-health')[0] == 403, 'Preview login must not grant SARVA admin access'
code, _, body = request('/tiles/municipal_boundaries/5/18/18')
assert code == 200 and len(body) > 0
assert request('/__preview/logout', {}, {'Origin': 'https://other.example'})[0] == 403
assert request('/api/health')[0] == 200
assert request('/__preview/logout', {}, {'Origin': base})[0] == 303
assert request('/api/health')[0] == 401
assert request('/api/health', headers={'Cookie': cookie}, opener=anonymous)[0] == 401, 'Logged-out tokens must not be reusable'
assert request('/api/health', headers={'Cookie': 'sarva_preview_local=forged'}, opener=anonymous)[0] == 401
print('PASS anonymous pages, APIs, assets and tiles blocked; login CSS available; direct auth check hidden')
print('PASS correct login, wrong password, origin checks, no-store responses, SARVA permission separation and sample map tile')
print('PASS logout, cookie replay rejection and forged-cookie rejection; credentials and cookies were not printed')
