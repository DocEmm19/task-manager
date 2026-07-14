// ==== CONFIG ====
// Passcode is stored in Script Properties (File > Project Settings > Script Properties),
// NOT in code, so it is never committed. Key: "PASSCODE".
var HEADERS = ['id','title','project','priority','due','status','pinned','notes',
               'subtasks','recur','last_completed','deleted','created','updated','schemaVersion'];
var TASKS_TAB = 'tasks';
var LOG_TAB = 'log';
var SCHEMA_VERSION = 1;

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
function tasksSheet_() { return sheet_(TASKS_TAB, HEADERS); }
function logSheet_() { return sheet_(LOG_TAB, ['at','id','field','oldValue','newValue']); }

function authed_(body) {
  var want = PropertiesService.getScriptProperties().getProperty('PASSCODE') || '';
  var got = String(body.passcode || '');
  if (want.length === 0 || got.length !== want.length) return false;
  var diff = 0;                                   // constant-time compare
  for (var i = 0; i < want.length; i++) diff |= (want.charCodeAt(i) ^ got.charCodeAt(i));
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  if (!authed_(body)) return json_({ ok: false, error: 'unauthorized' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // serialize all mutations; reads take it too for a consistent snapshot
  try {
    switch (body.action) {
      case 'list':     return json_({ ok: true, tasks: listTasks_() });
      case 'create':   return json_(createTask_(body));
      case 'patch':    return json_(patchTask_(body));
      case 'complete': return json_(completeTask_(body));
      default:         return json_({ ok: false, error: 'unknown_action' });
    }
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return json_({ ok: true, ping: 'pong' }); } // health check only

function nowISO_() { return new Date().toISOString(); } // server truth; project TZ is IST for date math

function rowToObj_(row) {
  var o = {};
  for (var i = 0; i < HEADERS.length; i++) o[HEADERS[i]] = row[i];
  if (typeof o.subtasks === 'string' && o.subtasks) { try { o.subtasks = JSON.parse(o.subtasks); } catch (e) { o.subtasks = []; } }
  if (!o.subtasks) o.subtasks = [];
  o.pinned = o.pinned === true || o.pinned === 'TRUE' || o.pinned === 'true';
  o.deleted = o.deleted === true || o.deleted === 'TRUE' || o.deleted === 'true';
  return o;
}

function listTasks_() {
  var sh = tasksSheet_();
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var o = rowToObj_(values[r]);
    if (!o.deleted && o.id) out.push(o);
  }
  return out;
}

function findRow_(sh, id) {
  var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2; // 1-based row incl header
  return -1;
}

function createTask_(body) {
  var sh = tasksSheet_();
  var t = body.task || {};
  var id = Utilities.getUuid();
  var now = nowISO_();
  var obj = {
    id: id, title: t.title || '', project: t.project || '', priority: t.priority || 'none',
    due: t.due || '', status: 'open', pinned: !!t.pinned, notes: t.notes || '',
    subtasks: JSON.stringify(t.subtasks || []), recur: t.recur || 'none', last_completed: '',
    deleted: false, created: now, updated: now, schemaVersion: SCHEMA_VERSION
  };
  var row = HEADERS.map(function (h) { return obj[h]; });
  sh.appendRow(row);
  logWrite_(id, '__create__', '', obj.title);
  var saved = rowToObj_(row);
  return { ok: true, task: saved, tempId: body.tempId || null };
}

function patchTask_(body) {
  var sh = tasksSheet_();
  var rowNum = findRow_(sh, body.id);
  if (rowNum < 0) return { ok: false, error: 'not_found' };
  var range = sh.getRange(rowNum, 1, 1, HEADERS.length);
  var row = range.getValues()[0];
  var patch = body.patch || {};

  for (var key in patch) {
    if (!patch.hasOwnProperty(key)) continue;
    if (key === 'id') continue;
    var col = HEADERS.indexOf(key);
    if (col < 0) continue;                       // ignore unknown fields
    var newVal = (key === 'subtasks') ? JSON.stringify(patch[key]) : patch[key];
    logWrite_(body.id, key, row[col], newVal);   // pre-image, even if it "loses" a conflict
    row[col] = newVal;
  }
  row[HEADERS.indexOf('updated')] = nowISO_();   // server receive-time defeats clock skew
  range.setValues([row]);
  return { ok: true, task: rowToObj_(row), ackId: body.patchId || null };
}

function logWrite_(id, field, oldVal, newVal) {
  logSheet_().appendRow([nowISO_(), id, field, oldVal, newVal]);
}

function istTodayISO_() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}
function addDaysISO_(iso, n) {
  var p = iso.split('-'); var d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0,10);
}
function dowISO_(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2])).getUTCDay(); }
function lastDom_(y,m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

function nextOccurrenceGS_(currentDue, recur, todayIso) {
  if (recur === 'daily') return addDaysISO_(todayIso, 1);
  if (recur === 'weekdays') { var i = addDaysISO_(todayIso,1); while (dowISO_(i)===0||dowISO_(i)===6) i = addDaysISO_(i,1); return i; }
  if (recur === 'weekly') { var t = dowISO_(currentDue||todayIso); var j = addDaysISO_(todayIso,1); while (dowISO_(j)!==t) j = addDaysISO_(j,1); return j; }
  if (recur === 'monthly') {
    var td = (currentDue||todayIso).split('-'); var targetDay = +td[2];
    var cp = todayIso.split('-'); var y=+cp[0], m=+cp[1]; var oy=y, om=m;
    do { m++; if (m>12){m=1;y++;} } while (y===oy && m===om);
    var day = Math.min(targetDay, lastDom_(y,m));
    return y + '-' + ('0'+m).slice(-2) + '-' + ('0'+day).slice(-2);
  }
  return currentDue;
}

function completeTask_(body) {
  var sh = tasksSheet_();
  var rowNum = findRow_(sh, body.id);
  if (rowNum < 0) return { ok: false, error: 'not_found' };
  var range = sh.getRange(rowNum, 1, 1, HEADERS.length);
  var row = range.getValues()[0];
  var cur = rowToObj_(row);
  var now = nowISO_();
  var today = istTodayISO_();

  if (cur.recur && cur.recur !== 'none') {
    var nd = nextOccurrenceGS_(cur.due || today, cur.recur, today);
    row[HEADERS.indexOf('due')] = nd;
    row[HEADERS.indexOf('status')] = 'open';        // stays alive
    row[HEADERS.indexOf('last_completed')] = now;
    logWrite_(body.id, 'recur_complete', cur.due, nd);
  } else {
    row[HEADERS.indexOf('status')] = 'done';
    row[HEADERS.indexOf('last_completed')] = now;
    logWrite_(body.id, 'status', cur.status, 'done');
  }
  row[HEADERS.indexOf('updated')] = now;
  range.setValues([row]);
  return { ok: true, task: rowToObj_(row), ackId: body.patchId || null };
}

function backupToDrive_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var file = DriveApp.getFileById(ss.getId());
  var folders = DriveApp.getFoldersByName('Task Manager Backups');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Task Manager Backups');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  file.makeCopy('tasks-backup-' + stamp, folder);
}

function installBackupTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++)
    if (triggers[i].getHandlerFunction() === 'backupToDrive_') ScriptApp.deleteTrigger(triggers[i]);
  ScriptApp.newTrigger('backupToDrive_').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
}
