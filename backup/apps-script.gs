// Road to 9 · nightly backup into Google Drive (Google Apps Script, runs as you).
// Setup, once:
//   1. Project Settings → Script properties → add BACKUP_TOKEN (the same value as in Supabase).
//   2. Run setUpDailyTrigger and allow access when Google asks.
//   3. Run backupRoadTo9 once to check a file appears in "Road to 9 backups".
// Files are encrypted; only BACKUP_KEY (in your password manager) opens them.

const BACKUP_URL = 'https://aabzydfrevhufprmmjnq.supabase.co/functions/v1/backup';
const PUBLIC_KEY = 'sb_publishable_U0bYmsiwR1jI5bGwYPbVUA_JmyayzZS'; // public key, safe to keep here
const FOLDER_NAME = 'Road to 9 backups';
const KEEP_DAYS = 30;

function backupRoadTo9() {
  const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
  if (!token) throw new Error('Add BACKUP_TOKEN under Project Settings → Script properties first.');
  const res = UrlFetchApp.fetch(BACKUP_URL, {
    method: 'post',
    headers: { 'x-backup-token': token, apikey: PUBLIC_KEY },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Road to 9 backup failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  }
  const folder = backupFolder_();
  const name = 'road-to-9-' + Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd') + '.r9b';
  folder.createFile(res.getBlob().setName(name).setContentType('application/octet-stream'));

  // Keep the last KEEP_DAYS days.
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf('road-to-9-') === 0 && f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}

function setUpDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'backupRoadTo9')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupRoadTo9').timeBased().everyDays(1).atHour(3).inTimezone('Europe/London').create();
}

function backupFolder_() {
  const found = DriveApp.getFoldersByName(FOLDER_NAME);
  return found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
}
