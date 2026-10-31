// สร้างข้อมูลจำลองใหม่ทั้งหมด: npm run mock:reset
// ลีกฟุตบอลระหว่างคณะในมหาวิทยาลัยสมมติ ผลทุกนัดคงเดิมทุกครั้งที่รัน เพราะใช้ seed คงที่
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const store = require('../repositories/mock/store');
const engine = require('../repositories/mock/engine');

// บัญชีทดสอบของโหมด mock เท่านั้น ดูรายละเอียดใน README.md
const TEST_PASSWORDS = { admin: 'Admin#2026', referee: 'Referee#2026', manager: 'Manager#2026' };

let seed = 20261031;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[randomInt(0, list.length - 1)];
const pad = (n) => String(n).padStart(2, '0');

const SEASONS = [
  { SeasonID: 1, SeasonName: 'ฤดูกาล 2025', StartDate: '2025-08-02', EndDate: '2025-11-08', Status: 'Finished' },
  { SeasonID: 2, SeasonName: 'ฤดูกาล 2026', StartDate: '2026-09-12', EndDate: '2026-12-12', Status: 'Active' },
  { SeasonID: 3, SeasonName: 'ฤดูกาล 2027', StartDate: '2027-08-07', EndDate: '2027-11-13', Status: 'Upcoming' },
];

const TEAMS = [
  { name: 'วิศวกรรมศาสตร์ เอฟซี', short: 'ENG', color: '#c0392b', strength: 3, owner: 3 },
  { name: 'วิทยาศาสตร์ เอฟซี', short: 'SCI', color: '#1f6fb2', strength: 2, owner: 4 },
  { name: 'บริหารธุรกิจ เอฟซี', short: 'BUS', color: '#6c3fa0', strength: 2, owner: 4 },
  { name: 'สถาปัตยกรรมศาสตร์ เอฟซี', short: 'ARC', color: '#d9822b', strength: 1, owner: 4 },
  { name: 'เกษตรศาสตร์ เอฟซี', short: 'AGR', color: '#2e8b57', strength: 2, owner: 5 },
  { name: 'นิติศาสตร์ เอฟซี', short: 'LAW', color: '#34495e', strength: 1, owner: 5 },
  { name: 'แพทยศาสตร์ เอฟซี', short: 'MED', color: '#16a085', strength: 1, owner: 5 },
  { name: 'มนุษยศาสตร์ เอฟซี', short: 'HUM', color: '#b5478b', strength: 0, owner: 6 },
];
const PENDING_TEAMS = [
  { name: 'ศึกษาศาสตร์ เอฟซี', short: 'EDU', color: '#7f8c2a', owner: 3 },
  { name: 'เศรษฐศาสตร์ เอฟซี', short: 'ECO', color: '#a0522d', owner: 6 },
];

const NICKNAMES = [
  'บอล', 'เจมส์', 'ต้น', 'ปอนด์', 'ฟิล์ม', 'แบงค์', 'ไอซ์', 'เบียร์', 'ก้อง', 'โอม', 'กอล์ฟ', 'เอิร์ธ', 'นนท์', 'พีท',
  'ภูมิ', 'แทน', 'ม่อน', 'เต้', 'บาส', 'ตั้ม', 'นัท', 'อาร์ม', 'เจ', 'วิน', 'โฟร์ด', 'ปั้น', 'กันต์', 'ทอย', 'เอก', 'มาร์ค',
  'บูม', 'คิม', 'ซัน', 'เมฆ', 'โจ้', 'แมน', 'ปิง', 'หมอก', 'ไผ่', 'ดิว', 'ฟลุ๊ค', 'ตูน', 'จิม', 'พอร์ช', 'เก่ง', 'ไนท์',
];

function buildUsers() {
  const hash = (password) => bcrypt.hashSync(password, 10);
  const manager = hash(TEST_PASSWORDS.manager);
  const created = '2025-06-01T09:00:00';
  const person = (id, username, name, role, passwordHash) => ({
    UserID: id, Username: username, PasswordHash: passwordHash, DisplayName: name, Role: role, CreatedAt: created,
  });
  return [
    person(1, 'admin', 'ผู้ดูแลลีก', 'admin', hash(TEST_PASSWORDS.admin)),
    person(2, 'referee', 'ผู้ตัดสินหลัก', 'referee', hash(TEST_PASSWORDS.referee)),
    person(3, 'manager', 'ผู้จัดการทีมวิศวะ', 'team_manager', manager),
    person(4, 'manager2', 'ผู้จัดการกลุ่มสอง', 'team_manager', manager),
    person(5, 'manager3', 'ผู้จัดการกลุ่มสาม', 'team_manager', manager),
    person(6, 'manager4', 'ผู้จัดการกลุ่มสี่', 'team_manager', manager),
  ];
}

function buildTeams() {
  const created = '2025-06-15T10:00:00';
  const approved = TEAMS.map((t, i) => ({
    TeamID: i + 1,
    TeamName: t.name,
    ShortName: t.short,
    LogoUrl: `/logos/${t.short.toLowerCase()}.svg`,
    Status: 'Approved',
    CreatedBy: t.owner,
    RequestedSeasonID: 1,
    ReviewedBy: 1,
    ReviewedAt: '2025-06-20T10:00:00',
    CreatedAt: created,
  }));
  const pending = PENDING_TEAMS.map((t, i) => ({
    TeamID: TEAMS.length + i + 1,
    TeamName: t.name,
    ShortName: t.short,
    LogoUrl: `/logos/${t.short.toLowerCase()}.svg`,
    Status: 'Pending',
    CreatedBy: t.owner,
    RequestedSeasonID: 3,
    ReviewedBy: null,
    ReviewedAt: null,
    CreatedAt: '2026-10-20T10:00:00',
  }));
  return [...approved, ...pending];
}

function buildPlayers() {
  const players = [];
  const names = [...NICKNAMES];
  TEAMS.forEach((team, teamIndex) => {
    const size = randomInt(10, 12);
    const jerseys = new Set([1]);
    while (jerseys.size < size) jerseys.add(randomInt(2, 40));
    const shape = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'];
    [...jerseys].sort((a, b) => a - b).forEach((jerseyNo, index) => {
      if (names.length === 0) names.push(...NICKNAMES);
      const nickname = names.splice(randomInt(0, names.length - 1), 1)[0];
      players.push({
        PlayerID: players.length + 1,
        TeamID: teamIndex + 1,
        Nickname: nickname,
        Position: shape[Math.min(index, shape.length - 1)],
        JerseyNo: jerseyNo,
        CreatedAt: '2025-06-25T10:00:00',
      });
    });
  });
  return players;
}

function goalsFor(strength) {
  const roll = random() + strength * 0.08;
  if (roll < 0.25) return 0;
  if (roll < 0.6) return 1;
  if (roll < 0.85) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

function addEvents(events, match, playersByTeam) {
  const add = (playerId, type, minute) => events.push({
    EventID: events.length + 1,
    MatchID: match.MatchID,
    PlayerID: playerId,
    EventType: type,
    Minute: minute,
    CreatedBy: 2,
    CreatedAt: match.UpdatedAt,
  });
  const scorers = (teamId) => {
    const squad = playersByTeam.get(teamId).filter((p) => p.Position !== 'GK');
    return [...squad, ...squad.filter((p) => p.Position === 'FW'), ...squad.filter((p) => p.Position === 'FW')];
  };
  for (const [teamId, goals] of [[match.HomeTeamID, match.HomeScore], [match.AwayTeamID, match.AwayScore]]) {
    for (let i = 0; i < goals; i += 1) add(pick(scorers(teamId)).PlayerID, 'Goal', randomInt(1, 90));
    for (let i = randomInt(0, 2); i > 0; i -= 1) add(pick(playersByTeam.get(teamId)).PlayerID, 'Yellow', randomInt(10, 90));
    if (random() < 0.04) add(pick(playersByTeam.get(teamId)).PlayerID, 'Red', randomInt(40, 90));
  }
}

function logoSvg(short, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${short}">
  <path d="M32 3 57 12v22c0 14-10 23-25 27C17 57 7 48 7 34V12Z" fill="${color}"/>
  <path d="M32 8 52 15v19c0 11-8 19-20 22C20 53 12 45 12 34V15Z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
  <text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#fff">${short}</text>
</svg>
`;
}

function main() {
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  const logoDir = path.join(__dirname, '..', 'public', 'logos');
  fs.mkdirSync(logoDir, { recursive: true });
  for (const t of [...TEAMS, ...PENDING_TEAMS]) {
    fs.writeFileSync(path.join(logoDir, `${t.short.toLowerCase()}.svg`), logoSvg(t.short, t.color));
  }
  fs.writeFileSync(path.join(logoDir, 'default.svg'), logoSvg('?', '#8a94a6'));

  const teams = buildTeams();
  const players = buildPlayers();
  const playersByTeam = new Map(TEAMS.map((t, i) => [i + 1, players.filter((p) => p.TeamID === i + 1)]));
  const teamIds = TEAMS.map((_, i) => i + 1);
  const venues = [
    { VenueID: 1, VenueName: 'สนามกีฬากลางมหาวิทยาลัย', Location: 'โซนกีฬา อาคาร 1' },
    { VenueID: 2, VenueName: 'สนามหญ้าเทียมหลังคณะ', Location: 'โซนกีฬา อาคาร 2' },
    { VenueID: 3, VenueName: 'สนามฝึกซ้อมริมบึง', Location: 'โซนกีฬา อาคาร 3' },
  ];
  const seasonTeams = [1, 2].flatMap((seasonId) => teamIds.map((teamId) => ({
    SeasonID: seasonId, TeamID: teamId, JoinedAt: '2025-06-20T10:00:00',
  })));
  const zones = SEASONS.flatMap((season, i) => [
    { ZoneName: 'เข้ารอบชิงชนะเลิศ', FromRank: 1, ToRank: 2, ColorHex: '#1a73e8' },
    { ZoneName: 'เพลย์ออฟ', FromRank: 3, ToRank: 4, ColorHex: '#f29900' },
    { ZoneName: 'ตกรอบแบ่งกลุ่ม', FromRank: 8, ToRank: 8, ColorHex: '#d93025' },
  ].map((zone, j) => ({ ZoneID: i * 3 + j + 1, SeasonID: season.SeasonID, ...zone })));

  const matches = [];
  const events = [];
  const strength = (teamId) => TEAMS[teamId - 1].strength;
  for (const [season, playedRounds] of [[SEASONS[0], 14], [SEASONS[1], 7]]) {
    const { rows } = engine.buildFixtures(season, teamIds, venues, matches.length + 1);
    for (const match of rows) {
      match.RowVersion = pad(randomInt(16, 99)) + random().toString(16).slice(2, 16).padEnd(14, '0');
      if (match.RoundNo <= playedRounds) {
        match.Status = 'Finished';
        match.HomeScore = goalsFor(strength(match.HomeTeamID) + 1);
        match.AwayScore = goalsFor(strength(match.AwayTeamID));
        match.UpdatedBy = 2;
        match.UpdatedAt = match.KickoffAt.replace(/T(\d\d)/, (_, h) => `T${pad(Number(h) + 2)}`);
        addEvents(events, match, playersByTeam);
      }
      matches.push(match);
    }
  }

  // ประวัติและการแจ้งเตือนของรอบล่าสุด พร้อมการแก้สกอร์หนึ่งครั้งไว้ดูในหน้า audit
  const audit = [];
  const notifications = [];
  const teamName = (id) => TEAMS[id - 1].name;
  const line = (m, h, a) => `${teamName(m.HomeTeamID)} ${h}-${a} ${teamName(m.AwayTeamID)}`;
  const logChange = (m, oldHome, oldAway, newHome, newAway, at) => audit.push({
    AuditID: audit.length + 1,
    MatchID: m.MatchID,
    OldHomeScore: oldHome,
    OldAwayScore: oldAway,
    NewHomeScore: newHome,
    NewAwayScore: newAway,
    ChangeType: 'UPDATE',
    ChangedBy: 2,
    ChangedByLogin: 'lb_referee',
    ChangedAt: at,
  });
  const notify = (m, type, message, at) => notifications.push({
    NotificationID: notifications.length + 1, MatchID: m.MatchID, Type: type, Message: message, CreatedAt: at,
  });
  const lastRound = matches.filter((m) => m.SeasonID === 2 && m.RoundNo === 7);
  for (const m of lastRound) {
    logChange(m, null, null, m.HomeScore, m.AwayScore, m.UpdatedAt);
    notify(m, 'MatchFinished', `จบการแข่งขัน: ${line(m, m.HomeScore, m.AwayScore)}`, m.UpdatedAt);
  }
  const corrected = lastRound[0];
  const correctedAt = corrected.UpdatedAt.replace(/T(\d\d)/, (_, h) => `T${pad(Number(h) + 3)}`);
  corrected.UpdatedAt = correctedAt;
  const typoHome = corrected.HomeScore + 1;
  logChange(corrected, typoHome, corrected.AwayScore, corrected.HomeScore, corrected.AwayScore, correctedAt);
  audit[0].NewHomeScore = typoHome;
  notifications[0].Message = `จบการแข่งขัน: ${line(corrected, typoHome, corrected.AwayScore)}`;
  notify(corrected, 'ResultCorrected', `แก้ไขผล: ${line(corrected, corrected.HomeScore, corrected.AwayScore)}`, correctedAt);

  store.write('Users', buildUsers());
  store.write('Seasons', SEASONS);
  store.write('Teams', teams);
  store.write('SeasonTeams', seasonTeams);
  store.write('Players', players);
  store.write('Venues', venues);
  store.write('Matches', matches);
  store.write('MatchEvents', events);
  store.write('Standings', []);
  store.write('ScoreAuditLog', audit);
  store.write('SeasonZones', zones);
  store.write('Notifications', notifications);
  engine.rebuildStandings([1, 2]);

  console.log(`สร้างข้อมูลจำลองแล้ว: ${teams.length} ทีม, ${players.length} นักกีฬา, ${matches.length} แมตช์, ${events.length} เหตุการณ์`);
}

main();
