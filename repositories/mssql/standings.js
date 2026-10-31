const { sql, query, selectList } = require('./run');

async function getLeagueTable(ctx, seasonId) {
  return query(
    ctx,
    `SELECT ${selectList('vw_LeagueTable')} FROM dbo.vw_LeagueTable WHERE SeasonID = @SeasonID ORDER BY RankNo, TeamName`,
    { SeasonID: [sql.Int, seasonId] },
  );
}

async function getTopScorers(ctx, seasonId) {
  return query(
    ctx,
    `SELECT ${selectList('vw_TopScorers')} FROM dbo.vw_TopScorers WHERE SeasonID = @SeasonID ORDER BY RankNo, Nickname`,
    { SeasonID: [sql.Int, seasonId] },
  );
}

module.exports = { getLeagueTable, getTopScorers };
