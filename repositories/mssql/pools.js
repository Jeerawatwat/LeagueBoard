const sql = require('mssql');
const { db } = require('../../config');

const pools = new Map();

// ยังไม่ login ใช้ viewer ตาม docs/db_design.md หัวข้อ 7
function poolNameFor(ctx) {
  const role = ctx && ctx.role;
  return ['team_manager', 'referee', 'admin'].includes(role) ? role : 'viewer';
}

function getPool(name) {
  if (!pools.has(name)) {
    const { user, password } = db.logins[name];
    const pool = new sql.ConnectionPool({
      user,
      password,
      server: db.server,
      port: db.port,
      database: db.database,
      options: {
        encrypt: db.encrypt,
        trustServerCertificate: db.trustServerCertificate,
        // ฐานข้อมูลเก็บเวลาท้องถิ่น ถ้าเป็น true เวลาจะคลาด 7 ชั่วโมง
        useUTC: false,
      },
    });
    const connecting = pool.connect().catch((err) => {
      pools.delete(name);
      throw err;
    });
    pools.set(name, connecting);
  }
  return pools.get(name);
}

async function closeAll() {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((connecting) => connecting.then((pool) => pool.close()).catch(() => {})));
}

module.exports = { poolNameFor, getPool, closeAll };
