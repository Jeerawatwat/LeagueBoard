// ทดสอบเว็บจริงในโหมด mock ตั้งแต่ HTTP จนถึง JSON โดยใช้ข้อมูลชุดคัดลอกในโฟลเดอร์ชั่วคราว
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_SOURCE = 'mock';
process.env.SESSION_SECRET = 'test-secret';

const store = require('../repositories/mock/store');

const realDir = store.DATA_DIR;
const copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-mock-'));
fs.cpSync(realDir, copyDir, { recursive: true });
store.useDataDir(copyDir);

const app = require('../server');

let base;
let server;

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  server.closeAllConnections();
  fs.rmSync(copyDir, { recursive: true, force: true });
});

class Browser {
  constructor() { this.cookie = ''; }

  async get(url) {
    const res = await fetch(base + url, { headers: { cookie: this.cookie }, redirect: 'manual' });
    this.remember(res);
    return { status: res.status, location: res.headers.get('location'), body: await res.text() };
  }

  async follow(url) {
    let res = await this.get(url);
    while (res.status === 302) res = await this.get(res.location);
    return res;
  }

  remember(res) {
    const set = res.headers.get('set-cookie');
    if (set) [this.cookie] = set.split(';');
  }

  async post(url, fields, csrfFrom) {
    const page = await this.get(csrfFrom || url);
    const token = (page.body.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    const res = await fetch(base + url, {
      method: 'POST',
      headers: { cookie: this.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token, ...fields }),
      redirect: 'manual',
    });
    this.remember(res);
    await res.text();
    const location = res.headers.get('location');
    return location ? this.follow(location) : { status: res.status };
  }

  async login(username, password) {
    return this.post('/login', { username, password }, '/login');
  }
}

const rowVersionOf = (matchId) => store.read('Matches').find((m) => m.MatchID === matchId).RowVersion;
const standing = (seasonId, teamId) => store.read('Standings')
  .find((s) => s.SeasonID === seasonId && s.TeamID === teamId);
const firstScheduled = () => store.read('Matches').find((m) => m.SeasonID === 2 && m.Status === 'Scheduled');

test('บัญชีผิดถูกปฏิเสธเป็นภาษาไทย และบัญชีถูกเข้าได้', async () => {
  const b = new Browser();
  assert.match((await b.login('admin', 'wrong-password')).body, /ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/);
  assert.match((await b.login('admin', 'Admin#2026')).body, /ผู้ดูแลลีก/);
});

test('POST ไม่มี CSRF token ถูกปฏิเสธ', async () => {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=x',
  });
  assert.strictEqual(res.status, 403);
});

test('แต่ละ role เข้าได้เฉพาะหน้าของตัวเอง', async () => {
  const anonymous = new Browser();
  assert.strictEqual((await anonymous.get('/admin/audit')).location, '/login');
  const referee = new Browser();
  await referee.login('referee', 'Referee#2026');
  assert.strictEqual((await referee.get('/referee')).status, 200);
  assert.strictEqual((await referee.get('/admin/audit')).status, 403);
  assert.strictEqual((await referee.get('/manager')).status, 403);
});

test('กรอกผลแล้วตารางคะแนนเปลี่ยน แก้ผลแล้วไม่บวกซ้อน และมี audit', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  const match = firstScheduled();
  const url = `/referee/matches/${match.MatchID}`;
  const home = standing(2, match.HomeTeamID);
  const away = standing(2, match.AwayTeamID);

  const saved = await b.post(`${url}/result`, { homeScore: 2, awayScore: 1, rowVersion: match.RowVersion }, url);
  assert.match(saved.body, /บันทึกผลแล้ว/);
  assert.strictEqual(standing(2, match.HomeTeamID).Points, home.Points + 3);
  assert.strictEqual(standing(2, match.AwayTeamID).Points, away.Points);

  await b.post(`${url}/result`, { homeScore: 0, awayScore: 3, rowVersion: rowVersionOf(match.MatchID) }, url);
  assert.strictEqual(standing(2, match.HomeTeamID).Points, home.Points);
  assert.strictEqual(standing(2, match.AwayTeamID).Points, away.Points + 3);
  assert.strictEqual(standing(2, match.HomeTeamID).Played, home.Played + 1);

  const audit = store.read('ScoreAuditLog').filter((a) => a.MatchID === match.MatchID);
  assert.deepStrictEqual(audit.map((a) => [a.NewHomeScore, a.NewAwayScore]), [[2, 1], [0, 3]]);
  assert.strictEqual(audit[1].OldHomeScore, 2);
  assert.strictEqual(audit[1].ChangedBy, 2);
  assert.ok(store.read('Notifications').some((n) => n.MatchID === match.MatchID && n.Type === 'ResultCorrected'));

  await b.post(`${url}/clear`, { rowVersion: rowVersionOf(match.MatchID) }, url);
  assert.deepStrictEqual(standing(2, match.HomeTeamID), home);
});

test('RowVersion เก่าถูกปฏิเสธ', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  const match = firstScheduled();
  const url = `/referee/matches/${match.MatchID}`;
  const stale = '0000000000000000';
  const res = await b.post(`${url}/result`, { homeScore: 1, awayScore: 0, rowVersion: stale }, url);
  assert.match(res.body, /มีผู้อื่นแก้ไขแมตช์นี้ไปแล้ว/);
  assert.strictEqual(store.read('Matches').find((m) => m.MatchID === match.MatchID).Status, 'Scheduled');
});

test('ข้อมูลผิดถูกปฏิเสธด้วยข้อความไทย', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  const match = firstScheduled();
  const url = `/referee/matches/${match.MatchID}`;
  assert.match((await b.post(`${url}/result`, { homeScore: -1, awayScore: 0, rowVersion: match.RowVersion }, url)).body, /สกอร์ต้องเป็นจำนวนเต็ม/);
  assert.match((await b.post(`${url}/result`, { homeScore: 'abc', awayScore: 0, rowVersion: match.RowVersion }, url)).body, /สกอร์ต้องเป็นจำนวนเต็ม/);

  const player = store.read('Players').find((p) => p.TeamID === match.HomeTeamID);
  assert.match((await b.post(`${url}/events`, { playerId: player.PlayerID, eventType: 'Goal', minute: 10 }, url)).body, /ต้องบันทึกผลการแข่งขันก่อน/);

  const finished = store.read('Matches').find((m) => m.SeasonID === 2 && m.Status === 'Finished');
  const fUrl = `/referee/matches/${finished.MatchID}`;
  const inMatch = store.read('Players').find((p) => p.TeamID === finished.HomeTeamID);
  const outsider = store.read('Players')
    .find((p) => p.TeamID !== finished.HomeTeamID && p.TeamID !== finished.AwayTeamID);
  assert.match((await b.post(`${fUrl}/events`, { playerId: inMatch.PlayerID, eventType: 'Goal', minute: 130 }, fUrl)).body, /นาทีต้องอยู่ระหว่าง 0–120/);
  assert.match((await b.post(`${fUrl}/events`, { playerId: outsider.PlayerID, eventType: 'Goal', minute: 10 }, fUrl)).body, /นักกีฬาต้องอยู่ในทีมเหย้าหรือทีมเยือน/);
  assert.match((await b.post(`${fUrl}/events`, { playerId: inMatch.PlayerID, eventType: 'Foul', minute: 10 }, fUrl)).body, /ชนิดเหตุการณ์ไม่ถูกต้อง/);
});

test('ลบเหตุการณ์แล้วประตูในดาวซัลโวลดลง', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  const season2 = new Set(store.read('Matches').filter((m) => m.SeasonID === 2).map((m) => m.MatchID));
  const event = store.read('MatchEvents').find((e) => e.EventType === 'Goal' && season2.has(e.MatchID));
  const url = `/referee/matches/${event.MatchID}`;
  await b.post(`${url}/events/${event.EventID}/delete`, {}, url);
  assert.ok(!store.read('MatchEvents').some((e) => e.EventID === event.EventID));
  assert.match((await b.get(url)).body, /จำนวนประตูในเหตุการณ์ยังไม่ตรงกับสกอร์/);
});

test('แก้ผลฤดูกาลที่จบแล้วไม่ได้', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  const old = store.read('Matches').find((m) => m.SeasonID === 1);
  const url = `/referee/matches/${old.MatchID}`;
  const res = await b.post(`${url}/result`, { homeScore: 9, awayScore: 9, rowVersion: old.RowVersion }, '/referee');
  assert.match(res.body, /ฤดูกาลนี้จบแล้ว/);
});

test('manager เพิ่มนักกีฬาได้เฉพาะทีมตัวเอง และเบอร์ถูกตรวจ', async () => {
  const b = new Browser();
  await b.login('manager', 'Manager#2026');
  const url = '/manager/teams/1/players';
  assert.strictEqual((await b.get('/manager/teams/2/players')).status, 404);
  assert.match((await b.post('/manager/teams/2/players', { nickname: 'ทดสอบ', position: 'FW', jerseyNo: 77 }, url)).body, /เฉพาะทีมของตัวเอง/);
  assert.match((await b.post(url, { nickname: 'ทดสอบ', position: 'FW', jerseyNo: 100 })).body, /เบอร์เสื้อต้องอยู่ระหว่าง 1–99/);
  assert.match((await b.post(url, { nickname: 'ทดสอบ', position: 'XX', jerseyNo: 77 })).body, /ตำแหน่งไม่ถูกต้อง/);
  assert.match((await b.post(url, { nickname: 'ทดสอบ', position: 'FW', jerseyNo: 77 })).body, /เพิ่มนักกีฬาแล้ว/);
  assert.match((await b.post(url, { nickname: 'ซ้ำ', position: 'FW', jerseyNo: 77 })).body, /เบอร์เสื้อนี้มีผู้เล่นในทีมใช้แล้ว/);
});

test('ใบสมัครทีมถูกจำกัดจำนวน แล้วแอดมินอนุมัติเข้าฤดูกาล และสร้างตารางแข่งได้', async () => {
  const manager = new Browser();
  await manager.login('manager', 'Manager#2026');
  const form = '/manager/teams/new';
  const apply = (name) => manager.post(form, { teamName: name, shortName: 'NEW', logoUrl: '', requestedSeasonId: 3 });
  assert.match((await manager.post(form, { teamName: 'ลิงก์เสีย', shortName: 'X', logoUrl: 'javascript:alert(1)', requestedSeasonId: 3 })).body, /ลิงก์โลโก้/);
  assert.match((await apply('ทีมใหม่ เอฟซี')).body, /รอผู้ดูแลอนุมัติ/);
  assert.match((await apply('ทีมที่สี่ เอฟซี')).body, /สูงสุด 3 ทีม/);
  assert.doesNotMatch((await new Browser().get('/teams')).body, /ทีมใหม่ เอฟซี/);

  const admin = new Browser();
  await admin.login('admin', 'Admin#2026');
  const teams = store.read('Teams');
  const teamA = teams.find((t) => t.TeamName === 'ทีมใหม่ เอฟซี');
  await admin.post(`/admin/teams/${teamA.TeamID}/review`, { decision: 'approve' }, '/admin/teams');
  await admin.post(`/admin/teams/${teamA.TeamID}/review`, { decision: 'reject' }, '/admin/teams');
  assert.strictEqual(store.read('Teams').find((t) => t.TeamID === teamA.TeamID).Status, 'Approved');
  assert.ok(store.read('SeasonTeams').some((s) => s.SeasonID === 3 && s.TeamID === teamA.TeamID));

  const seasons = '/admin/seasons';
  assert.match((await admin.post(`${seasons}/3/fixtures`, {}, seasons)).body, /ต้องมีอย่างน้อย 2 ทีม/);
  assert.match((await admin.post(`${seasons}/3/status`, { status: 'Active' }, seasons)).body, /เปลี่ยนสถานะฤดูกาลไม่ได้/);
  await admin.post(`${seasons}/3/teams`, { teamId: 1 }, seasons);
  assert.match((await admin.post(`${seasons}/3/teams`, { teamId: 1 }, seasons)).body, /ทีมนี้อยู่ในฤดูกาลแล้ว/);
  await admin.post(`${seasons}/3/teams`, { teamId: 2 }, seasons);
  assert.match((await admin.post(`${seasons}/3/fixtures`, {}, seasons)).body, /สร้างตารางแข่งแล้ว 6 แมตช์ 6 รอบ/);
  assert.match((await admin.post(`${seasons}/3/fixtures`, {}, seasons)).body, /ฤดูกาลนี้สร้างตารางแข่งแล้ว/);
  assert.match((await admin.post(`${seasons}/3/status`, { status: 'Active' }, seasons)).body, /มีฤดูกาลที่กำลังแข่งอยู่แล้ว/);
  const fixtures = store.read('Matches').filter((m) => m.SeasonID === 3);
  assert.strictEqual(new Set(fixtures.map((m) => `${m.HomeTeamID}-${m.AwayTeamID}`)).size, 6);

  assert.match((await admin.post(seasons, { seasonName: 'ฤดูกาลกลับด้าน', startDate: '2028-02-01', endDate: '2028-01-01' }, seasons)).body, /วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น/);
  assert.match((await admin.post(seasons, { seasonName: 'ฤดูกาล 2028', startDate: '2028-01-01', endDate: '2028-02-01' }, seasons)).body, /สร้างฤดูกาลแล้ว/);
  const created = store.read('Seasons').find((s) => s.SeasonName === 'ฤดูกาล 2028');
  assert.ok(store.read('SeasonZones').some((z) => z.SeasonID === created.SeasonID));
  assert.match((await admin.post(seasons, { seasonName: 'ฤดูกาล 2028', startDate: '2028-01-01', endDate: '2028-02-01' }, seasons)).body, /ชื่อฤดูกาลนี้มีอยู่แล้ว/);
});

test('สมัครสมาชิกได้เป็น team_manager เท่านั้น และชื่อซ้ำถูกปฏิเสธ', async () => {
  const b = new Browser();
  const fields = { username: 'newcomer', displayName: 'คนใหม่', password: 'Newcomer#1', confirm: 'Newcomer#1', role: 'admin' };
  assert.match((await b.post('/register', { ...fields, password: 'short', confirm: 'short' })).body, /อย่างน้อย 8 ตัวอักษร/);
  assert.match((await b.post('/register', { ...fields, confirm: 'different1' })).body, /ไม่ตรงกัน/);
  assert.match((await b.post('/register', fields)).body, /สมัครสมาชิกสำเร็จ/);
  assert.strictEqual(store.read('Users').find((u) => u.Username === 'newcomer').Role, 'team_manager');
  assert.match((await b.post('/register', fields)).body, /ชื่อผู้ใช้นี้ถูกใช้แล้ว/);
  assert.match((await b.login('newcomer', 'Newcomer#1')).body, /คนใหม่/);
});

test('หน้า /db-check เฉพาะแอดมิน และปุ่มทดสอบ viewer ได้ Permission denied', async () => {
  const b = new Browser();
  await b.login('referee', 'Referee#2026');
  assert.strictEqual((await b.get('/db-check')).status, 403);
  const admin = new Browser();
  await admin.login('admin', 'Admin#2026');
  assert.match((await admin.get('/db-check')).body, /โหมด mock/);
  const res = await admin.post('/db-check/permission-test', {}, '/db-check');
  assert.match(res.body, /Permission denied/);
});

test('ค้นหาไม่เจอหน้าไม่พัง และข้อความถูก escape', async () => {
  const res = await new Browser().get(`/players/search?q=${encodeURIComponent('<script>alert(1)</script>')}`);
  assert.strictEqual(res.status, 200);
  assert.doesNotMatch(res.body, /<script>alert/);
});
