// ของจำลองทั้งไฟล์: เลียนแบบ function และ trigger เพื่อให้เว็บทำงานได้โดยไม่มีฐานข้อมูล
// ของจริงอยู่ในฐานข้อมูล: fn_CalcPoints, fn_TeamForm, trg_Matches_UpdateStandings,
// trg_Matches_AuditScore และตรรกะของ usp_GenerateFixtures
// โหมด mssql ไม่ใช้ไฟล์นี้ และเว็บต้องไม่คำนวณคะแนนเองในโหมดนั้น
const crypto = require('crypto');
const store = require('./store');

// จำลอง fn_CalcPoints
function calcPoints(gf, ga) {
  if (gf > ga) return 3;
  return gf === ga ? 1 : 0;
}

const newestFirst = (a, b) => b.KickoffAt.localeCompare(a.KickoffAt) || b.MatchID - a.MatchID;

// จำลอง fn_TeamForm: ซ้ายเก่าสุด ขวาล่าสุด
function teamForm(matches, seasonId, teamId) {
  const lastFive = matches
    .filter((m) => m.SeasonID === seasonId && m.Status === 'Finished'
      && (m.HomeTeamID === teamId || m.AwayTeamID === teamId))
    .sort(newestFirst)
    .slice(0, 5)
    .reverse();
  return lastFive.map((m) => {
    const home = m.HomeTeamID === teamId;
    const gf = home ? m.HomeScore : m.AwayScore;
    const ga = home ? m.AwayScore : m.HomeScore;
    return { 3: 'W', 1: 'D', 0: 'L' }[calcPoints(gf, ga)];
  }).join('');
}

// จำลอง trg_Matches_UpdateStandings: คำนวณใหม่ทั้งฤดูกาล ทีมที่ยังไม่แข่งเป็นศูนย์
function rebuildStandings(seasonIds) {
  const seasonTeams = store.read('SeasonTeams');
  const matches = store.read('Matches');
  const others = store.read('Standings').filter((row) => !seasonIds.includes(row.SeasonID));
  const rebuilt = [];
  for (const seasonId of seasonIds) {
    const table = new Map();
    for (const st of seasonTeams.filter((row) => row.SeasonID === seasonId)) {
      table.set(st.TeamID, {
        SeasonID: seasonId, TeamID: st.TeamID, Played: 0, Won: 0, Drawn: 0, Lost: 0, GF: 0, GA: 0, Points: 0,
      });
    }
    const add = (teamId, gf, ga) => {
      const row = table.get(teamId);
      const points = calcPoints(gf, ga);
      row.Played += 1;
      row.GF += gf;
      row.GA += ga;
      row.Points += points;
      if (points === 3) row.Won += 1;
      else if (points === 1) row.Drawn += 1;
      else row.Lost += 1;
    };
    for (const m of matches.filter((row) => row.SeasonID === seasonId && row.Status === 'Finished')) {
      add(m.HomeTeamID, m.HomeScore, m.AwayScore);
      add(m.AwayTeamID, m.AwayScore, m.HomeScore);
    }
    rebuilt.push(...table.values());
  }
  store.write('Standings', [...others, ...rebuilt]);
}

// จำลอง ROWVERSION
const newRowVersion = () => crypto.randomBytes(8).toString('hex');

// จำลองการ UPDATE Matches พร้อม trigger สองตัว ได้แก่ audit และคำนวณตารางคะแนน
function updateMatch(matchId, patch, userId) {
  const matches = store.read('Matches');
  const match = matches.find((m) => m.MatchID === matchId);
  const old = { home: match.HomeScore, away: match.AwayScore };
  Object.assign(match, patch, { RowVersion: newRowVersion(), UpdatedBy: userId, UpdatedAt: store.now() });
  store.write('Matches', matches);

  if (old.home !== match.HomeScore || old.away !== match.AwayScore) {
    const audit = store.read('ScoreAuditLog');
    audit.push({
      AuditID: store.nextId(audit, 'AuditID'),
      MatchID: matchId,
      OldHomeScore: old.home,
      OldAwayScore: old.away,
      NewHomeScore: match.HomeScore,
      NewAwayScore: match.AwayScore,
      ChangeType: 'UPDATE',
      ChangedBy: userId,
      ChangedByLogin: 'lb_referee',
      ChangedAt: store.now(),
    });
    store.write('ScoreAuditLog', audit);
  }
  rebuildStandings([match.SeasonID]);
  return match;
}

// พบกันหมดเหย้า-เยือนด้วย circle method จำลองตรรกะของ usp_GenerateFixtures
function roundRobinPairs(teamIds) {
  const list = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, null];
  const size = list.length;
  const firstLeg = [];
  for (let round = 0; round < size - 1; round += 1) {
    const pairs = [];
    for (let i = 0; i < size / 2; i += 1) {
      const a = list[i];
      const b = list[size - 1 - i];
      if (a !== null && b !== null) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(pairs);
    list.splice(1, 0, list.pop());
  }
  const secondLeg = firstLeg.map((pairs) => pairs.map(([home, away]) => [away, home]));
  return [...firstLeg, ...secondLeg];
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// แถว Matches ใหม่ตามกติกาใน docs/db_contract.md หัวข้อ usp_GenerateFixtures
function buildFixtures(season, teamIds, venues, firstMatchId) {
  const rounds = roundRobinPairs(teamIds);
  const venueIds = venues.map((v) => v.VenueID).sort((a, b) => a - b);
  const rows = [];
  rounds.forEach((pairs, roundIndex) => {
    const date = addDays(season.StartDate, 7 * roundIndex);
    pairs.forEach(([home, away], pairIndex) => {
      rows.push({
        MatchID: firstMatchId + rows.length,
        SeasonID: season.SeasonID,
        RoundNo: roundIndex + 1,
        HomeTeamID: home,
        AwayTeamID: away,
        VenueID: venueIds[rows.length % venueIds.length],
        KickoffAt: `${date}T${String(15 + 2 * pairIndex).padStart(2, '0')}:00:00`,
        Status: 'Scheduled',
        HomeScore: null,
        AwayScore: null,
        RowVersion: newRowVersion(),
        UpdatedBy: null,
        UpdatedAt: null,
      });
    });
  });
  return { rows, rounds: rounds.length };
}

module.exports = {
  calcPoints, teamForm, rebuildStandings, newRowVersion, updateMatch, roundRobinPairs, buildFixtures, addDays,
};
