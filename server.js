const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const format = require('./services/format');
const { attachUser } = require('./middleware/auth');
const { exposeFlash } = require('./middleware/flash');
const csrf = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'leagueboard.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));

app.use((req, res, next) => {
  res.locals.fmt = format;
  res.locals.dataSource = config.dataSource;
  res.locals.path = req.path;
  next();
});
app.use(attachUser);
app.use(exposeFlash);
app.use(csrf);

app.use(require('./routes/public'));
app.use(require('./routes/auth'));
app.use(require('./routes/manager'));
app.use(require('./routes/referee'));
app.use(require('./routes/admin'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  if (config.sessionSecretMissing) {
    console.warn('คำเตือน: ไม่ได้ตั้ง SESSION_SECRET ทุกคนจะหลุดจากระบบเมื่อเริ่มเว็บใหม่');
  }
  app.listen(config.port, () => {
    console.log(`LeagueBoard (${config.dataSource}) เปิดที่ http://localhost:${config.port}`);
  });
}

module.exports = app;
