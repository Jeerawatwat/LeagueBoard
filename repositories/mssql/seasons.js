const {
  sql, query, execute, selectList, toSqlDate,
} = require('./run');

async function listSeasons(ctx) {
  return query(ctx, `SELECT ${selectList('vw_SeasonList')} FROM dbo.vw_SeasonList ORDER BY StartDate DESC`);
}

async function createSeason(ctx, { seasonName, startDate, endDate }) {
  const rows = await execute(ctx, 'dbo.usp_CreateSeason', {
    SeasonName: [sql.NVarChar(100), seasonName || null],
    StartDate: [sql.Date, toSqlDate(startDate)],
    EndDate: [sql.Date, toSqlDate(endDate)],
  });
  return rows[0];
}

async function setSeasonStatus(ctx, { seasonId, status }) {
  await execute(ctx, 'dbo.usp_SetSeasonStatus', {
    SeasonID: [sql.Int, seasonId],
    Status: [sql.VarChar(20), status],
  });
}

async function generateFixtures(ctx, seasonId) {
  const rows = await execute(ctx, 'dbo.usp_GenerateFixtures', { SeasonID: [sql.Int, seasonId] });
  return rows[0];
}

async function addTeamToSeason(ctx, { seasonId, teamId }) {
  await execute(ctx, 'dbo.usp_AddTeamToSeason', {
    SeasonID: [sql.Int, seasonId],
    TeamID: [sql.Int, teamId],
  });
}

module.exports = {
  listSeasons, createSeason, setSeasonStatus, generateFixtures, addTeamToSeason,
};
