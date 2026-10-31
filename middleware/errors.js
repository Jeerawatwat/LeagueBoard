const { translateError } = require('../services/errors');

function notFound(req, res) {
  res.status(404).render('pages/error', { title: 'ไม่พบหน้านี้', message: 'ไม่พบหน้าที่คุณต้องการ' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const translated = translateError(err);
  if (translated.code === 'UNKNOWN' || translated.code === 'CONNECTION') console.error(err);
  res.status(translated.status).render('pages/error', { title: 'เกิดข้อผิดพลาด', message: translated.message });
}

module.exports = { notFound, errorHandler };
