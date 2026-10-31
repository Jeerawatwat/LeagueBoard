const express = require('express');
const repo = require('../repositories');
const { toInt, text, pickSeason } = require('./helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons);
  const [recent, upcoming, notifications, table] = await Promise.all([
    repo.matches.listRecent(req.ctx, 5),
    repo.matches.listUpcoming(req.ctx, 5),
    repo.notifications.listNotifications(req.ctx, 5),
    season ? repo.standings.getLeagueTable(req.ctx, season.SeasonID) : [],
  ]);
  res.render('pages/home', {
    title: 'หน้าแรก',
    season,
    recent,
    upcoming,
    notifications,
    leaders: table.filter((row) => row.RankNo === 1),
  });
});

router.get('/standings', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons, req.query.season);
  const table = season ? await repo.standings.getLeagueTable(req.ctx, season.SeasonID) : [];
  const zones = [...new Map(table.filter((row) => row.ZoneName).map((row) => [row.ZoneName, row.ColorHex])).entries()];
  res.render('pages/standings', { title: 'ตารางคะแนน', seasons, season, table, zones });
});

router.get('/matches', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons, req.query.season);
  const matches = season ? await repo.matches.listMatches(req.ctx, { seasonId: season.SeasonID }) : [];
  const rounds = [...new Set(matches.map((m) => m.RoundNo))];
  const round = toInt(req.query.round);
  const shown = rounds.includes(round) ? matches.filter((m) => m.RoundNo === round) : matches;
  res.render('pages/matches', {
    title: 'โปรแกรม/ผลแข่ง',
    seasons,
    season,
    rounds,
    round: rounds.includes(round) ? round : null,
    groups: [...new Set(shown.map((m) => m.RoundNo))].map((no) => ({
      roundNo: no,
      matches: shown.filter((m) => m.RoundNo === no),
    })),
  });
});

router.get('/matches/:id', async (req, res, next) => {
  const matchId = toInt(req.params.id);
  const match = matchId === null ? null : await repo.matches.getMatch(req.ctx, matchId);
  if (!match) {
    next();
    return;
  }
  const [events, headToHead] = await Promise.all([
    repo.matches.listEvents(req.ctx, matchId),
    repo.matches.getHeadToHead(req.ctx, match.HomeTeamID, match.AwayTeamID),
  ]);
  res.render('pages/match', {
    title: `${match.HomeTeamName} พบ ${match.AwayTeamName}`,
    match,
    events,
    headToHead,
  });
});

router.get('/teams', async (req, res) => {
  const teams = await repo.teams.listTeams(req.ctx, { status: 'Approved' });
  res.render('pages/teams', { title: 'ทีม', teams });
});

router.get('/teams/:id', async (req, res, next) => {
  const teamId = toInt(req.params.id);
  const team = teamId === null ? null : await repo.teams.getTeam(req.ctx, teamId);
  if (!team || team.Status !== 'Approved') {
    next();
    return;
  }
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons, req.query.season);
  const [roster, table, matches] = await Promise.all([
    repo.teams.getRoster(req.ctx, teamId),
    season ? repo.standings.getLeagueTable(req.ctx, season.SeasonID) : [],
    season ? repo.matches.listMatches(req.ctx, { seasonId: season.SeasonID, teamId }) : [],
  ]);
  res.render('pages/team', {
    title: team.TeamName,
    team,
    seasons,
    season,
    roster,
    matches,
    standing: table.find((row) => row.TeamID === teamId) || null,
  });
});

router.get('/top-scorers', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons, req.query.season);
  const scorers = season ? await repo.standings.getTopScorers(req.ctx, season.SeasonID) : [];
  res.render('pages/scorers', { title: 'ดาวซัลโว', seasons, season, scorers });
});

router.get('/players/search', async (req, res) => {
  const keyword = text(req.query.q);
  const players = keyword ? await repo.teams.searchPlayers(req.ctx, keyword) : [];
  res.render('pages/search', { title: 'ค้นหานักเตะ', keyword, players });
});

module.exports = router;
