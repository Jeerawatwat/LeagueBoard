const {
  sql, query, execute, selectList, hexToBinary,
} = require('./run');
const contract = require('./contract');

async function listMatches(ctx, filters = {}) {
  const where = [];
  const params = {};
  if (filters.seasonId !== undefined) {
    where.push('SeasonID = @SeasonID');
    params.SeasonID = [sql.Int, filters.seasonId];
  }
  if (filters.roundNo !== undefined) {
    where.push('RoundNo = @RoundNo');
    params.RoundNo = [sql.Int, filters.roundNo];
  }
  if (filters.status !== undefined) {
    where.push('Status = @Status');
    params.Status = [sql.VarChar(20), filters.status];
  }
  if (filters.teamId !== undefined) {
    where.push('(HomeTeamID = @TeamID OR AwayTeamID = @TeamID)');
    params.TeamID = [sql.Int, filters.teamId];
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(
    ctx,
    `SELECT ${selectList('vw_MatchList')} FROM dbo.vw_MatchList ${clause} ORDER BY RoundNo, KickoffAt, MatchID`,
    params,
  );
}

async function getMatch(ctx, matchId) {
  const rows = await query(
    ctx,
    `SELECT ${selectList('vw_MatchList')} FROM dbo.vw_MatchList WHERE MatchID = @MatchID`,
    { MatchID: [sql.Int, matchId] },
  );
  return rows[0] || null;
}

async function listRecent(ctx, limit) {
  return query(
    ctx,
    `SELECT TOP (@Limit) ${selectList('vw_MatchList')} FROM dbo.vw_MatchList
     WHERE Status = 'Finished' ORDER BY KickoffAt DESC, MatchID DESC`,
    { Limit: [sql.Int, limit] },
  );
}

async function listUpcoming(ctx, limit) {
  return query(
    ctx,
    `SELECT TOP (@Limit) ${selectList('vw_UpcomingMatches')} FROM dbo.vw_UpcomingMatches ORDER BY KickoffAt, MatchID`,
    { Limit: [sql.Int, limit] },
  );
}

async function getHeadToHead(ctx, teamA, teamB) {
  const columns = contract.tableFunctions.fn_HeadToHead.columns.map((c) => `[${c}]`).join(', ');
  return query(
    ctx,
    `SELECT ${columns} FROM dbo.fn_HeadToHead(@TeamA, @TeamB) ORDER BY KickoffAt DESC, MatchID DESC`,
    { TeamA: [sql.Int, teamA], TeamB: [sql.Int, teamB] },
  );
}

async function listEvents(ctx, matchId) {
  return query(
    ctx,
    `SELECT ${selectList('vw_MatchEventDetails')} FROM dbo.vw_MatchEventDetails
     WHERE MatchID = @MatchID ORDER BY Minute, EventID`,
    { MatchID: [sql.Int, matchId] },
  );
}

async function recordResult(ctx, { matchId, homeScore, awayScore, rowVersion }) {
  const rows = await execute(ctx, 'dbo.usp_RecordMatchResult', {
    MatchID: [sql.Int, matchId],
    HomeScore: [sql.Int, homeScore],
    AwayScore: [sql.Int, awayScore],
    RowVersion: [sql.VarBinary(8), hexToBinary(rowVersion)],
    UpdatedBy: [sql.Int, ctx.userId],
  });
  return rows[0];
}

async function clearResult(ctx, { matchId, rowVersion }) {
  const rows = await execute(ctx, 'dbo.usp_ClearMatchResult', {
    MatchID: [sql.Int, matchId],
    RowVersion: [sql.VarBinary(8), hexToBinary(rowVersion)],
    UpdatedBy: [sql.Int, ctx.userId],
  });
  return rows[0];
}

async function addEvent(ctx, { matchId, playerId, eventType, minute }) {
  const rows = await execute(ctx, 'dbo.usp_AddMatchEvent', {
    MatchID: [sql.Int, matchId],
    PlayerID: [sql.Int, playerId],
    EventType: [sql.VarChar(10), eventType],
    Minute: [sql.Int, minute],
    CreatedBy: [sql.Int, ctx.userId],
  });
  return rows[0];
}

async function deleteEvent(ctx, eventId) {
  await execute(ctx, 'dbo.usp_DeleteMatchEvent', { EventID: [sql.Int, eventId] });
}

module.exports = {
  listMatches,
  getMatch,
  listRecent,
  listUpcoming,
  getHeadToHead,
  listEvents,
  recordResult,
  clearResult,
  addEvent,
  deleteEvent,
};
