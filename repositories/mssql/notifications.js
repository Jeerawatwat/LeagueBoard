const { sql, query, selectList } = require('./run');

async function listNotifications(ctx, limit) {
  return query(
    ctx,
    `SELECT TOP (@Limit) ${selectList('vw_Notifications')} FROM dbo.vw_Notifications
     ORDER BY CreatedAt DESC, NotificationID DESC`,
    { Limit: [sql.Int, limit] },
  );
}

module.exports = { listNotifications };
