const { sql, execute } = require('./run');

async function findForLogin(ctx, username) {
  const rows = await execute(ctx, 'dbo.usp_GetUserForLogin', { Username: [sql.NVarChar(50), username] });
  return rows[0] || null;
}

async function register(ctx, { username, passwordHash, displayName }) {
  const rows = await execute(ctx, 'dbo.usp_RegisterUser', {
    Username: [sql.NVarChar(50), username],
    PasswordHash: [sql.VarChar(60), passwordHash],
    DisplayName: [sql.NVarChar(100), displayName],
  });
  return rows[0];
}

module.exports = { findForLogin, register };
