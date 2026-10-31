const { translateError } = require('../services/errors');

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function exposeFlash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

// ห่อ POST handler: สำเร็จแสดงข้อความเขียว error ของฐานข้อมูลแสดงเป็นภาษาไทย แล้วกลับหน้าเดิม
// handler คืน { message, redirect } ส่วน fallback คือ path หรือฟังก์ชันที่คืน path
function action(fallback, handler) {
  const pathFor = (req) => (typeof fallback === 'function' ? fallback(req) : fallback);
  return async (req, res, next) => {
    try {
      const result = await handler(req, res);
      setFlash(req, 'success', result.message);
      res.redirect(result.redirect || pathFor(req));
    } catch (err) {
      const translated = translateError(err);
      if (translated.code === 'UNKNOWN' || translated.code === 'CONNECTION') {
        next(err);
        return;
      }
      setFlash(req, 'danger', translated.message);
      res.redirect(pathFor(req));
    }
  };
}

module.exports = { setFlash, exposeFlash, action };
