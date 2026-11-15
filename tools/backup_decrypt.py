"""Open a Road to 9 backup (.r9b) made by the "backup" server function.

    python3 backup_decrypt.py --check                     # check the newest .r9b in Downloads (counts only, no personal data)
    python3 backup_decrypt.py > backup.json               # write it out (keep it private, delete it after)
    python3 backup_decrypt.py some-file.r9b > backup.json # a particular file

Asks for BACKUP_KEY (from the password manager). Needs: pip install cryptography
The JSON holds users, progress (each student's planner) and invites. Keep it private and delete
it when you're done: it contains every student's planner.
"""
import getpass, glob, gzip, hashlib, json, os, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

check = '--check' in sys.argv
args = [a for a in sys.argv[1:] if a != '--check']
if args:
    path = args[0]
else:   # no file named: take the newest .r9b in Downloads
    downloads = os.path.expanduser('~/Downloads')
    found = sorted(glob.glob(os.path.join(downloads, '*.r9b')), key=os.path.getmtime)
    if not found:
        sys.exit('No .r9b file in Downloads. Download the newest one from "Road to 9 backups" on Google Drive first.')
    path = found[-1]
print('Opening ' + os.path.basename(path), file=sys.stderr)
data = open(path, 'rb').read()
if data[:4] != b'R9B1':
    sys.exit('Not a Road to 9 backup file.')
salt, iv, sealed = data[4:20], data[20:32], data[32:]
typed = getpass.getpass('BACKUP_KEY: ')
plain = None
for k in dict.fromkeys([typed, typed.strip()]):   # also forgive a stray space or line break from pasting
    try:
        key = hashlib.pbkdf2_hmac('sha256', k.encode(), salt, 210000, 32)
        plain = gzip.decompress(AESGCM(key).decrypt(iv, sealed, None))
        break
    except Exception:
        pass
if plain is None:
    sys.exit('Wrong key, or the file is damaged. Is this file newer than your last key change in Supabase?')
backup = json.loads(plain)
if check:
    # Is everything there that a restore needs? Prints counts only: no names, emails or planner text.
    problems = []
    for k in ('users', 'progress', 'invites', 'groups', 'group_members'):
        if not isinstance(backup.get(k), list): problems.append('missing: ' + k)
    if 'messages' not in backup:
        print('note: this backup is from before 15 Nov 2026, so it has no students\' messages (newer ones do)', file=sys.stderr)
    ids = {u.get('id') for u in backup.get('users', [])}
    print('made', backup.get('made_at', '?'), file=sys.stderr)
    for i, p in enumerate(backup.get('progress', []), 1):
        doc = p.get('doc') or {}
        st, cards, log = doc.get('settings') or {}, doc.get('cards') or {}, doc.get('log') or []
        if p.get('user_id') not in ids: problems.append('planner %d has no account' % i)
        if not st or not isinstance(cards, dict) or not isinstance(log, list): problems.append('planner %d is incomplete' % i)
        mins = sum((l['mins'] if l.get('mins') is not None else 45 if l.get('t') in ('learn', 'paper') else 8 * len(l.get('c') or [])) for l in log if isinstance(l, dict))
        print('planner %d: %d subjects, %d topics rated, %d sessions, %d min studied, last saved %s' % (
            i, len(st.get('subjects') or []), len(cards), len(log), mins, (p.get('updated_at') or '?')[:10]), file=sys.stderr)
    print('OK: everything a restore needs is there.' if not problems else 'PROBLEMS: ' + '; '.join(problems), file=sys.stderr)
else:
    print(json.dumps(backup, ensure_ascii=False, indent=1))
print('users %d, planners %d, invites %d, groups %d, messages %s' % (len(backup.get('users', [])), len(backup.get('progress', [])),
      len(backup.get('invites', [])), len(backup.get('groups', [])), len(backup['messages']) if 'messages' in backup else 'not in this backup'), file=sys.stderr)
