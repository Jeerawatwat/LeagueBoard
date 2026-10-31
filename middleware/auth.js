// ctx ถูกส่งเข้า repository ทุกครั้ง repositories/mssql เลือก connection pool จาก ctx.role
function attachUser(req, res, next) {
  const user = req.session.user || null;
  req.ctx = { role: user ? user.role : null, userId: user ? user.userId : null };
  res.locals.currentUser = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) {
      if (req.method === 'GET') req.session.returnTo = req.originalUrl;
      res.redirect('/login');
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).render('pages/error', { title: 'ไม่มีสิทธิ์', message: 'คุณไม่มีสิทธิ์เข้าหน้านี้' });
      return;
    }
    next();
  };
}

module.exports = { attachUser, requireRole };
