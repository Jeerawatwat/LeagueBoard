const sql = require('mssql');
const pools = require('./pools');
const contract = require('./contract');

// RowVersion ผ่านฟอร์มเป็น hex ส่วน RANK() คืน BIGINT ซึ่ง driver ไม่ได้ส่งมาเป็น number
function normalize(row) {
  const out = { ...row };
  if (Buffer.isBuffer(out.RowVersion)) out.RowVersion = out.RowVersion.toString('hex');
  if (out.RankNo !== undefined && out.RankNo !== null) out.RankNo = Number(out.RankNo);
  return out;
}

function bind(request, params) {
  for (const [name, [type, value]] of Object.entries(params)) request.input(name, type, value);
  return request;
}

async function request(ctx, params) {
  const pool = await pools.getPool(pools.poolNameFor(ctx));
  return bind(pool.request(), params);
}

// params = { ชื่อ: [ชนิด, ค่า] } ค่าจากผู้ใช้ทุกตัวต้องผ่านทางนี้ ห้ามต่อสตริงเข้า SQL
async function query(ctx, statement, params = {}) {
  const result = await (await request(ctx, params)).query(statement);
  return result.recordset.map(normalize);
}

async function execute(ctx, procedure, params = {}) {
  const result = await (await request(ctx, params)).execute(procedure);
  return (result.recordset || []).map(normalize);
}

const selectList = (name) => contract.views[name].map((column) => `[${column}]`).join(', ');
const hexToBinary = (hex) => Buffer.from(String(hex || ''), 'hex');
const toSqlDate = (text) => (/^\d{4}-\d{2}-\d{2}$/.test(text || '') ? new Date(`${text}T00:00:00`) : null);

module.exports = { sql, query, execute, selectList, hexToBinary, toSqlDate };
