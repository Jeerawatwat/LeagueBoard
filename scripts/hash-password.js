// สร้าง bcrypt hash สำหรับใส่ใน database/08_sample_data.sql: npm run hash -- รหัสผ่าน
const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
  console.error('วิธีใช้: npm run hash -- รหัสผ่าน');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 10));
