// ของจำลอง: อ่าน/เขียน JSON ใน mock-data/ ไฟล์ละตาราง ชื่อตรงกับ docs/db_design.md
// ของจริงคือตารางในฐานข้อมูล LeagueBoard
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'mock-data');

function read(table) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${table}.json`), 'utf8'));
}

function write(table, rows) {
  const file = path.join(DATA_DIR, `${table}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

// จำลอง IDENTITY
function nextId(rows, key) {
  return rows.reduce((max, row) => Math.max(max, row[key]), 0) + 1;
}

// จำลอง SYSDATETIME() เป็นเวลาท้องถิ่นแบบเดียวกับที่ฐานข้อมูลเก็บ
function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = { DATA_DIR, read, write, nextId, now };
