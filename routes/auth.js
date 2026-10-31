const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const repo = require('../repositories');
const { setFlash, action } = require('../middleware/flash');
const { text } = require('./helpers');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// ใช้เทียบเมื่อไม่พบผู้ใช้ เพื่อไม่ให้เวลาตอบบอกได้ว่าชื่อผู้ใช้นี้มีอยู่หรือไม่
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

function badInput(message) {
  const err = new Error(message);
  err.number = 51999;
  return err;
}

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/');
    return;
  }
  res.render('pages/login', { title: 'เข้าสู่ระบบ' });
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await repo.users.findForLogin(req.ctx, text(req.body.username));
    const matched = await bcrypt.compare(String(req.body.password || ''), user ? user.PasswordHash : DUMMY_HASH);
    if (!user || !matched) {
      setFlash(req, 'danger', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      res.redirect('/login');
      return;
    }
    const returnTo = req.session.returnTo || '/';
    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.user = {
        userId: user.UserID, username: user.Username, displayName: user.DisplayName, role: user.Role,
      };
      req.session.save(() => res.redirect(returnTo));
    });
  } catch (err) {
    next(err);
  }
});

router.get('/register', (req, res) => {
  res.render('pages/register', { title: 'สมัครสมาชิก', minPasswordLength: MIN_PASSWORD_LENGTH });
});

router.post('/register', action('/register', async (req) => {
  const password = String(req.body.password || '');
  if (password.length < MIN_PASSWORD_LENGTH) throw badInput(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
  if (password !== req.body.confirm) throw badInput('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  await repo.users.register(req.ctx, {
    username: text(req.body.username),
    displayName: text(req.body.displayName),
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  return { message: 'สมัครสมาชิกสำเร็จ เข้าสู่ระบบได้เลย', redirect: '/login' };
}));

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie('leagueboard.sid');
    res.redirect('/');
  });
});

module.exports = router;
