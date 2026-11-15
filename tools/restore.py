"""Put a Road to 9 backup back into a Supabase project (see RESTORE.md first).

    python3 restore.py backup.json --dry-run    # shows what it would do, changes nothing
    python3 restore.py backup.json              # restores

Asks for the project's URL and its secret key (Supabase → Project Settings → API keys → secret key).
Both are typed in, never saved or printed. Needs only Python 3, nothing to install.

What it does, in this order (so every link between tables holds):
  1. accounts, with the SAME ids as before (planners, invites and groups point at those ids);
     no passwords exist, people just sign in with their email again
  2. planners   3. invite links   4. study groups and who is in them   5. students' messages
Anything already there is left alone: an account or invite code that exists is skipped, a planner that
exists is kept (use --overwrite-planners to replace them with the backup's copy).
"""
import getpass, json, sys, urllib.error, urllib.request

args = [a for a in sys.argv[1:] if not a.startswith('--')]
DRY = '--dry-run' in sys.argv
OVERWRITE = '--overwrite-planners' in sys.argv
if not args:
    sys.exit(__doc__)
backup = json.load(open(args[0]))
if backup.get('app') != 'road-to-9':
    sys.exit('That is not a Road to 9 backup.')

url = (input('Supabase project URL (https://….supabase.co): ').strip().rstrip('/'))
key = getpass.getpass('Secret key (sb_secret_… or service_role): ').strip()
if not url.startswith('https://') or len(key) < 20:
    sys.exit('That URL or key does not look right.')


def call(method, path, body=None, prefer=None, want_headers=False):
    """One request to the project; returns (status, parsed body) (plus headers if asked)."""
    req = urllib.request.Request(url + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header('apikey', key)
    req.add_header('Authorization', 'Bearer ' + key)
    req.add_header('Content-Type', 'application/json')
    if prefer:
        req.add_header('Prefer', prefer)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            out = (r.status, json.loads(raw) if raw else None)
            return out + (r.headers,) if want_headers else out
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            out = (e.code, json.loads(raw))
        except Exception:
            out = (e.code, raw.decode(errors='replace'))
        return out + (e.headers,) if want_headers else out


def say(*a):
    print(*a, file=sys.stderr)


rows = {k: backup.get(k) or [] for k in ('users', 'progress', 'invites', 'groups', 'group_members', 'messages')}
say('Backup made %s: %s' % (backup.get('made_at', '?'), ', '.join('%d %s' % (len(v), k) for k, v in rows.items())))
if DRY:
    say('Dry run: nothing was changed.')
    sys.exit(0)

# 0. Can we reach the project with this key?
st, _ = call('GET', '/auth/v1/admin/users?per_page=1')
if st != 200:
    sys.exit('Could not sign in to the project with that key (HTTP %s). Check the URL and the secret key.' % st)

# 1. Accounts, same ids
made = skipped = 0
for u in rows['users']:
    st, res = call('POST', '/auth/v1/admin/users', {
        'id': u['id'], 'email': u['email'],
        'email_confirm': bool(u.get('email_confirmed_at')),
        'user_metadata': u.get('user_metadata') or {},
    })
    if st in (200, 201):
        made += 1
    elif st == 422 or 'already' in json.dumps(res).lower():
        skipped += 1
    else:
        sys.exit('Account %s failed (HTTP %s): %s' % (u['id'], st, res))
say('Accounts: %d restored, %d were already there' % (made, skipped))


def put(table, items, conflict, overwrite=False, drop=()):
    if not items:
        say('%s: nothing to restore' % table.capitalize())
        return
    clean = [{k: v for k, v in r.items() if k not in drop} for r in items]
    prefer = 'resolution=%s,return=minimal' % ('merge-duplicates' if overwrite else 'ignore-duplicates')
    for i in range(0, len(clean), 200):
        st, res = call('POST', '/rest/v1/%s?on_conflict=%s' % (table, conflict), clean[i:i + 200], prefer)
        if st not in (200, 201, 204):
            sys.exit('%s failed (HTTP %s): %s' % (table, st, res))
    say('%s: %d sent' % (table.capitalize(), len(clean)))


put('progress', rows['progress'], 'user_id', overwrite=OVERWRITE)          # 2. planners
put('invites', rows['invites'], 'code', drop=('id',))                       # 3. invite links (ids are made new)
put('groups', rows['groups'], 'id')                                         # 4. groups...
put('group_members', rows['group_members'], 'group_id,user_id')             #    ...and who is in them
# 5. messages (ids are made new). A message already there (same student, same time) is not sent twice.
st, have = call('GET', '/rest/v1/messages?select=user_id,created_at')
if st != 200:
    sys.exit('Could not read messages (HTTP %s): %s' % (st, have))
seen = {(m['user_id'], m['created_at'][:19]) for m in have or []}
new = [m for m in rows['messages'] if (m.get('user_id'), (m.get('created_at') or '')[:19]) not in seen]
if new:
    st, res = call('POST', '/rest/v1/messages', [{k: v for k, v in m.items() if k != 'id'} for m in new], 'return=minimal')
    if st not in (200, 201, 204):
        sys.exit('Messages failed (HTTP %s): %s' % (st, res))
say('Messages: %d restored, %d were already there' % (len(new), len(rows['messages']) - len(new)))

# Check: the project should now hold at least what the backup holds.
st, res = call('GET', '/auth/v1/admin/users?per_page=1000')
ids = {u['id'] for u in (res or {}).get('users', [])} if st == 200 else set()
missing = [u for u in rows['users'] if u['id'] not in ids]
ok = not missing
say('Check:  accounts %d of %d' % (len(rows['users']) - len(missing), len(rows['users'])))
for table in ('progress', 'invites', 'groups', 'group_members', 'messages'):
    st, res, h = call('GET', '/rest/v1/%s?select=*&limit=1' % table, prefer='count=exact', want_headers=True)
    n = int((h.get('Content-Range') or '*/0').split('/')[-1] or 0) if st in (200, 206) else -1
    good = n >= len(rows[table])
    ok = ok and good
    say('        %s %s of %d%s' % (table.replace('_', ' '), n, len(rows[table]), '' if good else '  <- fewer than the backup'))
say('ALL BACK. Sign in on roadto9.com with a student account to check its planner is there.' if ok else
    'SOMETHING IS MISSING (see above). Running the script again is safe.')
sys.exit(0 if ok else 1)
