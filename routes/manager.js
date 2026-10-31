const express = require('express');
const repo = require('../repositories');
const { requireRole } = require('../middleware/auth');
const { action } = require('../middleware/flash');
const { POSITIONS } = require('../services/format');
const { toInt, text } = require('./helpers');

const router = express.Router();
router.use('/manager', requireRole('team_manager'));

function badLogoUrl() {
  const err = new Error('ลิงก์โลโก้ต้องขึ้นต้นด้วย http://, https:// หรือ /');
  err.number = 51999;
  return err;
}

router.get('/manager', async (req, res) => {
  const teams = await repo.teams.listTeams(req.ctx, { createdBy: req.ctx.userId });
  res.render('pages/manager/index', { title: 'ทีมของฉัน', teams });
});

router.get('/manager/teams/new', async (req, res) => {
  const seasons = (await repo.seasons.listSeasons(req.ctx)).filter((s) => s.Status === 'Upcoming');
  res.render('pages/manager/newTeam', { title: 'สมัครทีม', seasons });
});

router.post('/manager/teams/new', action('/manager/teams/new', async (req) => {
  const logoUrl = text(req.body.logoUrl);
  if (logoUrl && !/^(https?:\/\/|\/)/i.test(logoUrl)) throw badLogoUrl();
  await repo.teams.registerTeam(req.ctx, {
    teamName: text(req.body.teamName),
    shortName: text(req.body.shortName),
    logoUrl: logoUrl || null,
    requestedSeasonId: toInt(req.body.requestedSeasonId),
  });
  return { message: 'ส่งใบสมัครแล้ว รอผู้ดูแลอนุมัติ', redirect: '/manager' };
}));

router.get('/manager/teams/:id/players', async (req, res, next) => {
  const teamId = toInt(req.params.id);
  const team = teamId === null ? null : await repo.teams.getTeam(req.ctx, teamId);
  if (!team || team.CreatedBy !== req.ctx.userId) {
    next();
    return;
  }
  const roster = await repo.teams.getRoster(req.ctx, teamId);
  res.render('pages/manager/players', { title: `นักกีฬา ${team.TeamName}`, team, roster, positions: POSITIONS });
});

router.post('/manager/teams/:id/players', action((req) => `/manager/teams/${req.params.id}/players`, async (req) => {
  await repo.teams.registerPlayer(req.ctx, {
    teamId: toInt(req.params.id),
    nickname: text(req.body.nickname),
    position: text(req.body.position),
    jerseyNo: toInt(req.body.jerseyNo),
  });
  return { message: 'เพิ่มนักกีฬาแล้ว' };
}));

module.exports = router;
