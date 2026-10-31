const { translateError } = require('../../services/errors');
const pools = require('./pools');
const { readSchema, compareSchema } = require('./schemaCheck');

const LOGINS = ['viewer', 'team_manager', 'referee', 'admin', 'checker'];

async function checkLogins() {
  return Promise.all(LOGINS.map(async (name) => {
    try {
      await pools.getPool(name);
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, error: err.message, code: err.code };
    }
  }));
}

async function checkDatabase() {
  const logins = await checkLogins();
  if (!logins.find((login) => login.name === 'checker').ok) {
    return { mode: 'mssql', logins, schemaRead: false, missing: [], warnings: [] };
  }
  try {
    const pool = await pools.getPool('checker');
    return { mode: 'mssql', logins, schemaRead: true, ...compareSchema(await readSchema(pool)) };
  } catch (err) {
    console.error(err);
    return {
      mode: 'mssql', logins, schemaRead: false, missing: [translateError(err).message], warnings: [],
    };
  }
}

module.exports = { checkDatabase };
