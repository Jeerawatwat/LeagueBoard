const express = require('express');
const repo = require('../repositories');
const { requireRole } = require('../middleware/auth');
const { action } = require('../middleware/flash');
const { toInt, text } = require('./helpers');

const router = express.Router();
router.use('/referee', requireRole('referee'));

const matchPage = (req) => `/referee/matches/${req.params.id}`;

router.get('/referee', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = seasons.find((s) => s.Status === 'Active') || null;
  const matches = season ? await repo.matches.listMatches(req.ctx, { seasonId: season.SeasonID }) : [];
  res.render('pages/referee/index', {
    title: 'กรอกผลการแข่งขัน',
    season,
    pending: matches.filter((m) => m.Status === 'Scheduled'),
    finished: matches.filter((m) => m.Status === 'Finished').reverse(),
  });
});

router.get('/referee/matches/:id', async (req, res, next) => {
  const matchId = toInt(req.params.id);
  const match = matchId === null ? null : await repo.matches.getMatch(req.ctx, matchId);
  if (!match) {
    next();
    return;
  }
  const [events, homeRoster, awayRoster] = await Promise.all([
    repo.matches.listEvents(req.ctx, matchId),
    repo.teams.getRoster(req.ctx, match.HomeTeamID),
    repo.teams.getRoster(req.ctx, match.AwayTeamID),
  ]);
  const goals = (teamId) => events.filter((e) => e.EventType === 'Goal' && e.TeamID === teamId).length;
  const goalMismatch = match.Status === 'Finished'
    && (goals(match.HomeTeamID) !== match.HomeScore || goals(match.AwayTeamID) !== match.AwayScore);
  res.render('pages/referee/match', {
    title: 'กรอกผล', match, events, homeRoster, awayRoster, goalMismatch,
  });
});

router.post('/referee/matches/:id/result', action(matchPage, async (req) => {
  await repo.matches.recordResult(req.ctx, {
    matchId: toInt(req.params.id),
    homeScore: toInt(req.body.homeScore),
    awayScore: toInt(req.body.awayScore),
    rowVersion: text(req.body.rowVersion),
  });
  return { message: 'บันทึกผลแล้ว ตารางคะแนนอัปเดตแล้ว' };
}));

router.post('/referee/matches/:id/clear', action(matchPage, async (req) => {
  await repo.matches.clearResult(req.ctx, { matchId: toInt(req.params.id), rowVersion: text(req.body.rowVersion) });
  return { message: 'ลบผลการแข่งขันแล้ว' };
}));

router.post('/referee/matches/:id/events', action(matchPage, async (req) => {
  await repo.matches.addEvent(req.ctx, {
    matchId: toInt(req.params.id),
    playerId: toInt(req.body.playerId),
    eventType: text(req.body.eventType),
    minute: toInt(req.body.minute),
  });
  return { message: 'เพิ่มเหตุการณ์แล้ว' };
}));

router.post('/referee/matches/:id/events/:eventId/delete', action(matchPage, async (req) => {
  await repo.matches.deleteEvent(req.ctx, toInt(req.params.eventId));
  return { message: 'ลบเหตุการณ์แล้ว' };
}));

module.exports = router;
