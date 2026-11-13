"""Build the site: src/app.html + data/curriculum.json + config.json  ->  index.html

    python3 tools/build.py

config.json holds only public values (the Supabase project URL and its anon/publishable key).
Never put the service_role / secret key anywhere in this repository.
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
app = (root / 'src' / 'app.html').read_text(encoding='utf-8')
cur = json.loads((root / 'data' / 'curriculum.json').read_text(encoding='utf-8'))
cfg_path = root / 'config.json'
cfg = json.loads(cfg_path.read_text(encoding='utf-8')) if cfg_path.exists() else {}

url = cfg.get('supabase_url', '')
key = cfg.get('supabase_key', '')
if key and (key.startswith('sb_secret_') or 'service_role' in key):
    raise SystemExit('Refusing to build: that is a secret key. Use the anon / publishable key.')
if key.startswith('eyJ'):   # legacy JWT keys: make sure it is the anon role
    import base64
    payload = key.split('.')[1]
    payload += '=' * (-len(payload) % 4)
    if json.loads(base64.urlsafe_b64decode(payload)).get('role') != 'anon':
        raise SystemExit('Refusing to build: that key is not the anon key.')

# no personal data may ship in the public page
for s in cur:
    for c in s['cards']:
        assert 'r0' not in c, c['id']
        for p in c['p']:
            assert 's' not in p, c['id']

out = app.replace('/*CURRICULUM*/[]', json.dumps(cur, ensure_ascii=False, separators=(',', ':')), 1)
if url and key:
    out = out.replace('%%SUPABASE_URL%%', url).replace('%%SUPABASE_KEY%%', key)
assert '/*CURRICULUM*/' not in out
(root / 'index.html').write_text(out, encoding='utf-8')
print('index.html', len(out) // 1024, 'KB', '(connected)' if url and key else '(no Supabase config yet)')
