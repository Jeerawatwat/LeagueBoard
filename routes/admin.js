const express = require('express');
const repo = require('../repositories');
const { requireRole } = require('../middleware/auth');
const { action } = require('../middleware/flash');
const { toInt, text } = require('./helpers');

const router = express.Router();
router.use('/admin', requireRole('admin'));

router.get('/admin', (req, res) => res.redirect('/admin/seasons'));

router.get('/admin/seasons', async (req, res) => {
  const [seasons, approvedTeams] = await Promise.all([
    repo.seasons.listSeasons(req.ctx),
    repo.teams.listTeams(req.ctx, { status: 'Approved' }),
  ]);
  res.render('pages/admin/seasons', { title: 'จัดการฤดูกาล', seasons, approvedTeams });
});

router.post('/admin/seasons', action('/admin/seasons', async (req) => {
  await repo.seasons.createSeason(req.ctx, {
    seasonName: text(req.body.seasonName),
    startDate: text(req.body.startDate),
    endDate: text(req.body.endDate),
  });
  return { message: 'สร้างฤดูกาลแล้ว' };
}));

router.post('/admin/seasons/:id/status', action('/admin/seasons', async (req) => {
  await repo.seasons.setSeasonStatus(req.ctx, { seasonId: toInt(req.params.id), status: text(req.body.status) });
  return { message: 'เปลี่ยนสถานะฤดูกาลแล้ว' };
}));

router.post('/admin/seasons/:id/fixtures', action('/admin/seasons', async (req) => {
  const result = await repo.seasons.generateFixtures(req.ctx, toInt(req.params.id));
  return { message: `สร้างตารางแข่งแล้ว ${result.MatchesCreated} แมตช์ ${result.Rounds} รอบ` };
}));

router.post('/admin/seasons/:id/teams', action('/admin/seasons', async (req) => {
  await repo.seasons.addTeamToSeason(req.ctx, { seasonId: toInt(req.params.id), teamId: toInt(req.body.teamId) });
  return { message: 'เพิ่มทีมเข้าฤดูกาลแล้ว' };
}));

router.get('/admin/teams', async (req, res) => {
  const teams = await repo.teams.listTeams(req.ctx);
  res.render('pages/admin/teams', {
    title: 'อนุมัติทีม',
    pending: teams.filter((t) => t.Status === 'Pending'),
    reviewed: teams.filter((t) => t.Status !== 'Pending'),
  });
});

router.post('/admin/teams/:id/review', action('/admin/teams', async (req) => {
  const approve = req.body.decision === 'approve';
  await repo.teams.reviewTeam(req.ctx, { teamId: toInt(req.params.id), approve });
  return { message: approve ? 'อนุมัติทีมแล้ว' : 'ปฏิเสธทีมแล้ว' };
}));

router.get('/admin/audit', async (req, res) => {
  const rows = await repo.admin.listScoreAudit(req.ctx);
  res.render('pages/admin/audit', { title: 'ประวัติการแก้สกอร์', rows });
});

router.get('/admin/notifications', async (req, res) => {
  const rows = await repo.notifications.listNotifications(req.ctx, 100);
  res.render('pages/admin/notifications', { title: 'การแจ้งเตือน', rows });
});

module.exports = router;
