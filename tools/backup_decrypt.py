"""Open a Road to 9 backup (.r9b) made by the "backup" server function.

    python3 tools/backup_decrypt.py road-to-9-2026-11-14.r9b > backup.json

Asks for BACKUP_KEY (from the password manager). Needs: pip install cryptography
The JSON holds users, progress (each student's planner) and invites. Keep it private and delete
it when you're done: it contains every student's planner.
"""
import getpass, gzip, hashlib, json, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

data = open(sys.argv[1], 'rb').read()
if data[:4] != b'R9B1':
    sys.exit('Not a Road to 9 backup file.')
salt, iv, sealed = data[4:20], data[20:32], data[32:]
key = hashlib.pbkdf2_hmac('sha256', getpass.getpass('BACKUP_KEY: ').encode(), salt, 210000, 32)
try:
    plain = gzip.decompress(AESGCM(key).decrypt(iv, sealed, None))
except Exception:
    sys.exit('Wrong key, or the file is damaged.')
backup = json.loads(plain)
print(json.dumps(backup, ensure_ascii=False, indent=1))
print('users %(users)s, planners %(progress)s, invites %(invites)s' % backup['counts'], file=sys.stderr)
