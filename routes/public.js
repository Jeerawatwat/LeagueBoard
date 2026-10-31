const express = require('express');
const repo = require('../repositories');
const { pickSeason } = require('./helpers');

const router = express.Router();

router.get('/', (req, res) => res.redirect('/standings'));

router.get('/standings', async (req, res) => {
  const seasons = await repo.seasons.listSeasons(req.ctx);
  const season = pickSeason(seasons, req.query.season);
  const table = season ? await repo.standings.getLeagueTable(req.ctx, season.SeasonID) : [];
  const zones = [...new Map(table.filter((row) => row.ZoneName).map((row) => [row.ZoneName, row.ColorHex])).entries()];
  res.render('pages/standings', { title: 'ตารางคะแนน', seasons, season, table, zones });
});

module.exports = router;
