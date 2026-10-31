// ของจำลอง: เลียนแบบ GRANT ใน docs/db_design.md หัวข้อ 7 ของจริงอยู่ที่ database/07_security.sql
const { denied } = require('./dbError');

const GRANTS = {
  vw_ScoreAudit: ['admin'],
  usp_RegisterTeam: ['team_manager'],
  usp_RegisterPlayer: ['team_manager'],
  usp_RecordMatchResult: ['referee'],
  usp_ClearMatchResult: ['referee'],
  usp_AddMatchEvent: ['referee'],
  usp_DeleteMatchEvent: ['referee'],
  usp_CreateSeason: ['admin'],
  usp_SetSeasonStatus: ['admin'],
  usp_GenerateFixtures: ['admin'],
  usp_AddTeamToSeason: ['admin'],
  usp_ApproveTeam: ['admin'],
};

function assertGranted(ctx, object) {
  if (!GRANTS[object].includes(ctx && ctx.role)) throw denied(object);
}

module.exports = { assertGranted };
