// Road to 9 · nightly backup into Google Drive (Google Apps Script, runs as you).
// Setup, once:
//   1. Project Settings → Script properties → add BACKUP_TOKEN (the same value as in Supabase).
//   2. Run setUpDailyTrigger and allow access when Google asks (Drive, outside connections, sending email as you).
//   3. Run backupRoadTo9 once to check a file appears in "Road to 9 backups".
// Files are encrypted; only BACKUP_KEY (in your password manager) opens them.
// If a backup fails, or no new backup has arrived by the morning check, you get an email (to this Google account).

const BACKUP_URL = 'https://aabzydfrevhufprmmjnq.supabase.co/functions/v1/backup';
const PUBLIC_KEY = 'sb_publishable_U0bYmsiwR1jI5bGwYPbVUA_JmyayzZS'; // public key, safe to keep here
const FOLDER_NAME = 'Road to 9 backups';
const KEEP_DAYS = 30;
const MIN_BYTES = 200;      // a real backup is never smaller than this

function backupRoadTo9() {
  try {
    backup_();
  } catch (e) {
    alert_('The Road to 9 backup failed tonight', 'What went wrong:\n' + e.message);
    throw e;                // still shows as failed under Executions
  }
}

// Morning check (about 9am): is there a backup from the last 30 hours? Catches a night the backup didn't run at all.
function checkBackups() {
  const files = backupFolder_().getFiles();
  let newest = null;
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf('road-to-9-') === 0 && (!newest || f.getDateCreated() > newest.getDateCreated())) newest = f;
  }
  if (!newest) return alert_('No Road to 9 backups found', 'The folder "' + FOLDER_NAME + '" has no backup files in it.');
  const hours = (Date.now() - newest.getDateCreated().getTime()) / 36e5;
  if (hours > 30) alert_('No Road to 9 backup since ' + Utilities.formatDate(newest.getDateCreated(), 'Europe/London', 'd MMM'),
    'The newest backup is ' + Math.round(hours) + ' hours old (' + newest.getName() + '). The 3am backup has not run or has failed.');
  else if (newest.getSize() < MIN_BYTES) alert_('Last night\'s Road to 9 backup looks empty',
    newest.getName() + ' is only ' + newest.getSize() + ' bytes.');
}

function alert_(subject, text) {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject,
    text + '\n\nOpen the script to see more: Executions, on the left.\nhttps://script.google.com/home\n\nRESTORE.md in the road-to-9 repo explains what to do if you need a backup.');
}

function backup_() {
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
  const blob = res.getBlob();
  if (blob.getBytes().length < MIN_BYTES) throw new Error('The backup came back almost empty (' + blob.getBytes().length + ' bytes).');
  folder.createFile(blob.setName(name).setContentType('application/octet-stream'));

  // Keep the last KEEP_DAYS days.
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf('road-to-9-') === 0 && f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}

// Run this once after any change to the script: sets the 3am backup and the 9am check (old ones are replaced).
function setUpDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['backupRoadTo9', 'checkBackups'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupRoadTo9').timeBased().everyDays(1).atHour(3).inTimezone('Europe/London').create();
  ScriptApp.newTrigger('checkBackups').timeBased().everyDays(1).atHour(9).inTimezone('Europe/London').create();
}

function backupFolder_() {
  const found = DriveApp.getFoldersByName(FOLDER_NAME);
  return found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
}
