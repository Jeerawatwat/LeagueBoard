const express = require('express');
const repo = require('../repositories');
const { requireRole } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const { translateError } = require('../services/errors');

const router = express.Router();
router.use('/db-check', requireRole('admin'));

router.get('/db-check', async (req, res) => {
  res.render('pages/dbcheck', { title: 'ตรวจฐานข้อมูล', result: await repo.system.checkDatabase() });
});

// เรียก SP ผ่าน pool ของ viewer โดยตั้งใจ ฐานข้อมูลต้องตอบ error 229 ไม่ใช่เว็บเป็นคนบล็อก
// matchId 0 ไม่มีอยู่จริง ถ้าสิทธิ์ตั้งผิดก็จะไม่มีข้อมูลถูกแก้
router.post('/db-check/permission-test', async (req, res) => {
  try {
    await repo.matches.recordResult({ role: null, userId: null }, {
      matchId: 0, homeScore: 0, awayScore: 0, rowVersion: '0000000000000000',
    });
    setFlash(req, 'warning', 'viewer เรียก SP ได้โดยไม่ถูกปฏิเสธ ตรวจ database/07_security.sql');
  } catch (err) {
    const { code, message } = translateError(err);
    if (code === 'PERMISSION') setFlash(req, 'danger', `ผลการทดสอบ viewer: ${message}`);
    else setFlash(req, 'warning', `viewer ไม่ได้ถูกปฏิเสธด้วยสิทธิ์ แต่เกิด: ${message} ตรวจ database/07_security.sql`);
  }
  res.redirect('/db-check');
});

module.exports = router;
