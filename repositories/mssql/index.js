// เรียก view, function และ SP ตาม docs/db_contract.md ด้วย parameterized query เท่านั้น
// ห้ามคำนวณคะแนนหรือ SELECT/UPDATE ตารางตรงในโฟลเดอร์นี้
module.exports = {
  seasons: require('./seasons'),
  standings: require('./standings'),
  matches: require('./matches'),
  teams: require('./teams'),
  users: require('./users'),
  notifications: require('./notifications'),
  admin: require('./admin'),
  system: require('./system'),
};
