const { query, selectList } = require('./run');

async function listScoreAudit(ctx) {
  return query(ctx, `SELECT ${selectList('vw_ScoreAudit')} FROM dbo.vw_ScoreAudit ORDER BY ChangedAt DESC, AuditID DESC`);
}

module.exports = { listScoreAudit };
