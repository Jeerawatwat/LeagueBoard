// ทดสอบ repositories/mssql โดยไม่ใช้ฐานข้อมูลจริง: แทน connection pool ด้วยตัวบันทึกคำสั่ง
// แล้วตรวจว่าเรียก object และส่งพารามิเตอร์ตรงกับ contract ส่วนการรันบน SQL Server จริงตรวจด้วย db:check
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const pools = require('../repositories/mssql/pools');
const contract = require('../repositories/mssql/contract');
const { compareSchema } = require('../repositories/mssql/schemaCheck');
const mssqlRepo = require('../repositories/mssql');
const mockRepo = require('../repositories/mock');

const calls = [];
let poolsUsed = [];
let fakeRows = [];

pools.getPool = async (name) => {
  poolsUsed.push(name);
  return {
    request() {
      const inputs = {};
      return {
        input(key, type, value) { inputs[key] = { type, value }; },
        async query(statement) {
          calls.push({ kind: 'query', statement, inputs });
          return { recordset: fakeRows };
        },
        async execute(procedure) {
          calls.push({ kind: 'execute', procedure, inputs });
          return { recordset: fakeRows };
        },
      };
    },
  };
};

const referee = { role: 'referee', userId: 2 };
const admin = { role: 'admin', userId: 1 };
const manager = { role: 'team_manager', userId: 3 };
const viewer = { role: null, userId: null };
const rowVersion = '00112233aabbccdd';

const procedureCalls = [
  ['usp_RecordMatchResult', () => mssqlRepo.matches.recordResult(referee, { matchId: 1, homeScore: 2, awayScore: 1, rowVersion })],
  ['usp_ClearMatchResult', () => mssqlRepo.matches.clearResult(referee, { matchId: 1, rowVersion })],
  ['usp_AddMatchEvent', () => mssqlRepo.matches.addEvent(referee, { matchId: 1, playerId: 2, eventType: 'Goal', minute: 9 })],
  ['usp_DeleteMatchEvent', () => mssqlRepo.matches.deleteEvent(referee, 1)],
  ['usp_GenerateFixtures', () => mssqlRepo.seasons.generateFixtures(admin, 1)],
  ['usp_CreateSeason', () => mssqlRepo.seasons.createSeason(admin, { seasonName: 'x', startDate: '2027-01-01', endDate: '2027-02-01' })],
  ['usp_SetSeasonStatus', () => mssqlRepo.seasons.setSeasonStatus(admin, { seasonId: 1, status: 'Active' })],
  ['usp_AddTeamToSeason', () => mssqlRepo.seasons.addTeamToSeason(admin, { seasonId: 1, teamId: 1 })],
  ['usp_RegisterTeam', () => mssqlRepo.teams.registerTeam(manager, { teamName: 'x', shortName: 'x', logoUrl: null, requestedSeasonId: 1 })],
  ['usp_ApproveTeam', () => mssqlRepo.teams.reviewTeam(admin, { teamId: 1, approve: true })],
  ['usp_RegisterPlayer', () => mssqlRepo.teams.registerPlayer(manager, { teamId: 1, nickname: 'x', position: 'FW', jerseyNo: 7 })],
  ['usp_SearchPlayers', () => mssqlRepo.teams.searchPlayers(viewer, 'x')],
  ['usp_GetUserForLogin', () => mssqlRepo.users.findForLogin(viewer, 'x')],
  ['usp_RegisterUser', () => mssqlRepo.users.register(viewer, { username: 'x', passwordHash: 'h', displayName: 'x' })],
];

test('ทุก SP ใน contract ถูกเรียกครบ และส่งพารามิเตอร์ตรงชื่อ', async () => {
  assert.deepStrictEqual(procedureCalls.map(([name]) => name).sort(), Object.keys(contract.procedures).sort());
  for (const [name, call] of procedureCalls) {
    calls.length = 0;
    await call();
    assert.strictEqual(calls[0].procedure, `dbo.${name}`);
    const sent = Object.keys(calls[0].inputs).map((key) => `@${key}`).sort();
    assert.deepStrictEqual(sent, [...contract.procedures[name]].sort(), name);
  }
});

const queryCalls = [
  ['vw_SeasonList', () => mssqlRepo.seasons.listSeasons(viewer)],
  ['vw_LeagueTable', () => mssqlRepo.standings.getLeagueTable(viewer, 1)],
  ['vw_TopScorers', () => mssqlRepo.standings.getTopScorers(viewer, 1)],
  ['vw_MatchList', () => mssqlRepo.matches.listMatches(viewer, {
    seasonId: 1, roundNo: 2, status: 'Finished', teamId: 3,
  })],
  ['vw_MatchList', () => mssqlRepo.matches.getMatch(viewer, 1)],
  ['vw_MatchList', () => mssqlRepo.matches.listRecent(viewer, 5)],
  ['vw_UpcomingMatches', () => mssqlRepo.matches.listUpcoming(viewer, 5)],
  ['vw_MatchEventDetails', () => mssqlRepo.matches.listEvents(viewer, 1)],
  ['vw_TeamList', () => mssqlRepo.teams.listTeams(viewer, { status: 'Approved', createdBy: 1 })],
  ['vw_TeamList', () => mssqlRepo.teams.getTeam(viewer, 1)],
  ['vw_TeamRoster', () => mssqlRepo.teams.getRoster(viewer, 1)],
  ['vw_ScoreAudit', () => mssqlRepo.admin.listScoreAudit(admin)],
  ['vw_Notifications', () => mssqlRepo.notifications.listNotifications(viewer, 5)],
  ['fn_HeadToHead', () => mssqlRepo.matches.getHeadToHead(viewer, 1, 2)],
];

test('ทุก view ถูกอ่าน ไม่มีการ SELECT ตารางตรง และทุกตัวแปรใน SQL มีการ bind', async () => {
  const used = new Set(queryCalls.map(([name]) => name));
  for (const view of Object.keys(contract.views)) assert.ok(used.has(view), `ไม่มีการใช้ ${view}`);
  for (const [name, call] of queryCalls) {
    calls.length = 0;
    await call();
    const { statement, inputs } = calls[0];
    const from = statement.match(/FROM\s+dbo\.(\w+)/)[1];
    assert.strictEqual(from, name);
    for (const variable of statement.matchAll(/@(\w+)/g)) assert.ok(inputs[variable[1]], `ไม่ได้ bind @${variable[1]}`);
    assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/i.test(statement));
  }
});

test('ไม่มี SQL ต่อสตริงจากค่าที่ผู้ใช้ส่งมา', async () => {
  calls.length = 0;
  const attack = "x'; DROP TABLE Users;--";
  await mssqlRepo.teams.listTeams(viewer, { status: attack });
  assert.ok(!calls[0].statement.includes('DROP'));
  assert.strictEqual(calls[0].inputs.Status.value, attack);
});

test('เลือก pool ตาม role และยังไม่ login ใช้ viewer', async () => {
  const cases = [[viewer, 'viewer'], [{}, 'viewer'], [manager, 'team_manager'], [referee, 'referee'], [admin, 'admin']];
  for (const [ctx, expected] of cases) {
    poolsUsed = [];
    await mssqlRepo.seasons.listSeasons(ctx);
    assert.deepStrictEqual(poolsUsed, [expected]);
  }
});

test('แปลง RowVersion เป็น hex ไปกลับ และ RankNo เป็น number', async () => {
  fakeRows = [{ RowVersion: Buffer.from(rowVersion, 'hex'), RankNo: '1' }];
  const [row] = await mssqlRepo.matches.listMatches(viewer);
  fakeRows = [];
  assert.strictEqual(row.RowVersion, rowVersion);
  assert.strictEqual(row.RankNo, 1);
  calls.length = 0;
  await mssqlRepo.matches.recordResult(referee, { matchId: 1, homeScore: 2, awayScore: 1, rowVersion });
  assert.strictEqual(calls[0].inputs.RowVersion.value.toString('hex'), rowVersion);
  assert.strictEqual(calls[0].inputs.UpdatedBy.value, 2);
});

test('repository ทั้งสองโหมดมีฟังก์ชันเหมือนกันทุกตัว', () => {
  assert.deepStrictEqual(Object.keys(mssqlRepo).sort(), Object.keys(mockRepo).sort());
  for (const module of Object.keys(mssqlRepo)) {
    assert.deepStrictEqual(Object.keys(mssqlRepo[module]).sort(), Object.keys(mockRepo[module]).sort(), module);
  }
});

test('แถวข้อมูลจาก mock มีคอลัมน์ตรงกับ contract', async () => {
  const views = require('../repositories/mock/views');
  const sample = {
    vw_LeagueTable: views.vwLeagueTable(2),
    vw_UpcomingMatches: views.vwUpcomingMatches(),
    vw_TopScorers: views.vwTopScorers(2),
    vw_TeamRoster: views.vwTeamRoster(1),
    vw_MatchList: views.vwMatchList(),
    vw_TeamList: views.vwTeamList(),
    vw_SeasonList: views.vwSeasonList(),
    vw_ScoreAudit: views.vwScoreAudit(),
    vw_Notifications: views.vwNotifications(),
  };
  for (const [view, rows] of Object.entries(sample)) {
    assert.ok(rows.length > 0, view);
    assert.deepStrictEqual(Object.keys(rows[0]).sort(), [...contract.views[view]].sort(), view);
  }
});

test('mock-data ชื่อคอลัมน์ตรงกับตารางใน contract', () => {
  for (const [table, columns] of Object.entries(contract.tables)) {
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mock-data', `${table}.json`), 'utf8'));
    assert.ok(rows.length > 0, table);
    assert.deepStrictEqual(Object.keys(rows[0]).sort(), columns.filter((c) => !(table === 'Standings' && c === 'GD')).sort(), table);
  }
});

function perfectSchema() {
  const objects = [];
  const columns = [];
  const parameters = [];
  const add = (name, type, cols, params = []) => {
    objects.push({ name, type });
    cols.forEach((c) => columns.push({
      objectName: name, name: c, baseType: 'int', userType: 'int', isComputed: false,
    }));
    params.forEach((p) => parameters.push({ objectName: name, name: p }));
  };
  Object.entries(contract.tables).forEach(([name, cols]) => add(name, 'U', cols));
  Object.entries(contract.views).forEach(([name, cols]) => add(name, 'V', cols));
  Object.entries(contract.scalarFunctions).forEach(([name, params]) => add(name, 'FN', [], params));
  Object.entries(contract.tableFunctions).forEach(([name, spec]) => add(name, 'IF', spec.columns, spec.params));
  Object.entries(contract.procedures).forEach(([name, params]) => add(name, 'P', [], params));
  contract.constraints.forEach((name) => objects.push({ name, type: 'C' }));
  const set = (object, name, patch) => Object.assign(columns.find((c) => c.objectName === object && c.name === name), patch);
  contract.nvarcharColumns.forEach((entry) => {
    const [table, name] = entry.split('.');
    set(table, name, { baseType: 'nvarchar' });
  });
  set('Players', 'JerseyNo', { userType: 'JerseyNumber' });
  set('Matches', 'Status', { userType: 'MatchStatusType' });
  set('Matches', 'RowVersion', { baseType: 'timestamp' });
  set('Standings', 'GD', { isComputed: true });
  return {
    objects,
    columns,
    parameters,
    triggers: Object.entries(contract.triggers).map(([name, parentName]) => ({ name, parentName })),
    indexes: contract.indexes.map((name) => ({ name })),
    types: [{ name: 'JerseyNumber', ruleId: 1, defaultId: 0 }, { name: 'MatchStatusType', ruleId: 0, defaultId: 1 }],
    roles: contract.roles.map((name) => ({ name })),
    optional: [{
      queues: 1, fulltextCatalogs: 1, synonyms: 1, filegroups: 2, collation: 'Thai_100_CI_AS',
    }],
  };
}

test('db:check ผ่านเมื่อครบ และรายงานภาษาไทยเมื่อขาด', () => {
  assert.deepStrictEqual(compareSchema(perfectSchema()), { missing: [], warnings: [] });

  const broken = perfectSchema();
  broken.objects = broken.objects.filter((o) => !['vw_TopScorers', 'usp_ApproveTeam', 'Venues'].includes(o.name));
  broken.columns = broken.columns.filter((c) => !(c.objectName === 'Teams' && c.name === 'LogoUrl'));
  broken.parameters.find((p) => p.objectName === 'usp_RegisterTeam' && p.name === '@LogoUrl').name = '@Logo';
  broken.triggers = broken.triggers.filter((t) => t.name !== 'trg_Teams_Approved');
  broken.types[0].ruleId = 0;
  broken.columns.find((c) => c.objectName === 'Teams' && c.name === 'TeamName').baseType = 'varchar';
  broken.optional[0].queues = 0;
  const { missing, warnings } = compareSchema(broken);
  for (const expected of [
    'ไม่มี view vw_TopScorers',
    'ไม่มี stored procedure usp_ApproveTeam',
    'ไม่มีตาราง Venues',
    'ตาราง Teams ไม่มีคอลัมน์ LogoUrl',
    'stored procedure usp_RegisterTeam ไม่มีพารามิเตอร์ @LogoUrl',
    'stored procedure usp_RegisterTeam มีพารามิเตอร์เกิน @Logo ซึ่งเว็บไม่ได้ส่ง',
    'ไม่มี trigger trg_Teams_Approved',
    'ยังไม่ได้ผูก Rule กับ type JerseyNumber',
    'Teams.TeamName ต้องเป็น NVARCHAR ไม่เช่นนั้นภาษาไทยจะเพี้ยน',
  ]) assert.ok(missing.includes(expected), expected);
  assert.ok(warnings.includes('ส่วนเสริม: ยังไม่มี Service Broker queue'));
});
