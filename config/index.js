const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const dataSource = (process.env.DATA_SOURCE || 'mock').toLowerCase();
if (!['mock', 'mssql'].includes(dataSource)) {
  throw new Error(`DATA_SOURCE ต้องเป็น mock หรือ mssql แต่ได้ค่า "${dataSource}"`);
}

const sessionSecretMissing = !process.env.SESSION_SECRET;

function dbLogin(prefix) {
  return {
    user: process.env[`DB_${prefix}_USER`],
    password: process.env[`DB_${prefix}_PASSWORD`],
  };
}

module.exports = {
  dataSource,
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  sessionSecretMissing,
  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    database: process.env.DB_NAME || 'LeagueBoard',
    encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
    logins: {
      viewer: dbLogin('VIEWER'),
      team_manager: dbLogin('TEAM_MANAGER'),
      referee: dbLogin('REFEREE'),
      admin: dbLogin('ADMIN'),
      checker: dbLogin('CHECKER'),
    },
  },
};
