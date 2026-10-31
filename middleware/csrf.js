const crypto = require('crypto');

function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (req.method !== 'POST') {
    next();
    return;
  }
  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const expected = Buffer.from(req.session.csrfToken);
  if (sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    res.status(403).render('pages/error', {
      title: 'ไม่สามารถทำรายการได้', message: 'หน้านี้หมดอายุแล้ว กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง',
    });
    return;
  }
  next();
}

module.exports = csrf;
