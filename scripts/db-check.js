// npm run db:check ตรวจว่าฐานข้อมูลมีทุกอย่างตาม docs/db_contract.md แล้วรายงานภาษาไทย
const { db } = require('../config');
const { closeAll } = require('../repositories/mssql/pools');
const { checkDatabase } = require('../repositories/mssql/system');

const HINTS = {
  ELOGIN: 'ตรวจชื่อ/รหัสผ่านใน .env, เปิด SQL Server Authentication และสร้าง login แล้วหรือยัง',
  ESOCKET: `ต่อ ${db.server}:${db.port} ไม่ได้ ตรวจว่าเปิด TCP/IP แล้ว restart บริการ SQL Server หรือยัง`,
  ETIMEOUT: `ต่อ ${db.server}:${db.port} ไม่ทันเวลา ตรวจ TCP/IP พอร์ต และ firewall`,
};

async function main() {
  console.log(`ตรวจฐานข้อมูล ${db.database} ที่ ${db.server}:${db.port}\n`);
  const result = await checkDatabase();

  console.log('การเชื่อมต่อของแต่ละ login');
  for (const login of result.logins) {
    console.log(`  ${login.ok ? '[ผ่าน]' : '[ไม่ผ่าน]'} ${login.name}`);
    if (!login.ok) console.log(`      ${HINTS[login.code] || login.error}`);
  }

  if (!result.schemaRead) {
    console.log('\nตรวจโครงสร้างไม่ได้ เพราะ login checker ใช้งานไม่ได้ หรืออ่าน metadata ไม่ได้');
    result.missing.forEach((item) => console.log(`  ${item}`));
    return 1;
  }

  if (result.missing.length) {
    console.log(`\nยังขาด ${result.missing.length} รายการ`);
    result.missing.forEach((item) => console.log(`  - ${item}`));
  } else {
    console.log('\nโครงสร้างครบตาม contract');
  }
  if (result.warnings.length) {
    console.log('\nคำเตือน (ไม่ทำให้ไม่ผ่าน)');
    result.warnings.forEach((item) => console.log(`  - ${item}`));
  }
  const allLoginsOk = result.logins.every((login) => login.ok);
  return result.missing.length === 0 && allLoginsOk ? 0 : 1;
}

main()
  .then(async (code) => {
    await closeAll();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(`ตรวจไม่สำเร็จ: ${err.message}`);
    await closeAll();
    process.exit(1);
  });
