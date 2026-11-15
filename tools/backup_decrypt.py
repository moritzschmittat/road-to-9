"""Open a Road to 9 backup (.r9b) made by the "backup" server function.

    python3 backup_decrypt.py > /dev/null                 # just check the newest .r9b in Downloads opens
    python3 backup_decrypt.py > backup.json               # write it out (keep it private, delete it after)
    python3 backup_decrypt.py some-file.r9b > backup.json # a particular file

Asks for BACKUP_KEY (from the password manager). Needs: pip install cryptography
The JSON holds users, progress (each student's planner) and invites. Keep it private and delete
it when you're done: it contains every student's planner.
"""
import getpass, glob, gzip, hashlib, json, os, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

if len(sys.argv) > 1:
    path = sys.argv[1]
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
print(json.dumps(backup, ensure_ascii=False, indent=1))
print('users %(users)s, planners %(progress)s, invites %(invites)s' % backup['counts'], file=sys.stderr)
