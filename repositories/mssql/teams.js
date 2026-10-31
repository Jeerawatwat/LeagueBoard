const {
  sql, query, execute, selectList,
} = require('./run');

async function listTeams(ctx, filters = {}) {
  const where = [];
  const params = {};
  if (filters.status !== undefined) {
    where.push('Status = @Status');
    params.Status = [sql.VarChar(10), filters.status];
  }
  if (filters.createdBy !== undefined) {
    where.push('CreatedBy = @CreatedBy');
    params.CreatedBy = [sql.Int, filters.createdBy];
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(ctx, `SELECT ${selectList('vw_TeamList')} FROM dbo.vw_TeamList ${clause} ORDER BY TeamName`, params);
}

async function getTeam(ctx, teamId) {
  const rows = await query(
    ctx,
    `SELECT ${selectList('vw_TeamList')} FROM dbo.vw_TeamList WHERE TeamID = @TeamID`,
    { TeamID: [sql.Int, teamId] },
  );
  return rows[0] || null;
}

async function getRoster(ctx, teamId) {
  return query(
    ctx,
    `SELECT ${selectList('vw_TeamRoster')} FROM dbo.vw_TeamRoster WHERE TeamID = @TeamID ORDER BY JerseyNo`,
    { TeamID: [sql.Int, teamId] },
  );
}

async function searchPlayers(ctx, keyword) {
  return execute(ctx, 'dbo.usp_SearchPlayers', { Keyword: [sql.NVarChar(50), keyword] });
}

async function registerTeam(ctx, { teamName, shortName, logoUrl, requestedSeasonId }) {
  const rows = await execute(ctx, 'dbo.usp_RegisterTeam', {
    TeamName: [sql.NVarChar(100), teamName || null],
    ShortName: [sql.NVarChar(10), shortName || null],
    LogoUrl: [sql.NVarChar(300), logoUrl],
    RequestedSeasonID: [sql.Int, requestedSeasonId],
    CreatedBy: [sql.Int, ctx.userId],
  });
  return rows[0];
}

async function reviewTeam(ctx, { teamId, approve }) {
  await execute(ctx, 'dbo.usp_ApproveTeam', {
    TeamID: [sql.Int, teamId],
    Approve: [sql.Bit, approve],
    ReviewedBy: [sql.Int, ctx.userId],
  });
}

async function registerPlayer(ctx, { teamId, nickname, position, jerseyNo }) {
  const rows = await execute(ctx, 'dbo.usp_RegisterPlayer', {
    TeamID: [sql.Int, teamId],
    Nickname: [sql.NVarChar(50), nickname],
    Position: [sql.VarChar(2), position],
    JerseyNo: [sql.Int, jerseyNo],
    UserID: [sql.Int, ctx.userId],
  });
  return rows[0];
}

module.exports = {
  listTeams, getTeam, getRoster, searchPlayers, registerTeam, reviewTeam, registerPlayer,
};
