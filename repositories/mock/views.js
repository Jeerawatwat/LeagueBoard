// ของจำลองทั้งไฟล์: เลียนแบบ view และ fn_HeadToHead คืนชื่อคอลัมน์ตาม docs/db_contract.md
// ของจริงอยู่ในฐานข้อมูล
const store = require('./store');
const { teamForm } = require('./engine');

const indexBy = (rows, key) => new Map(rows.map((row) => [row[key], row]));

// จำลอง RANK(): ค่าเท่ากันได้อันดับเท่ากัน และอันดับถัดไปข้ามเลข
function withRank(sorted, sameRank) {
  const ranked = [];
  sorted.forEach((row, index) => {
    const tied = index > 0 && sameRank(sorted[index - 1], row);
    ranked.push({ ...row, RankNo: tied ? ranked[index - 1].RankNo : index + 1 });
  });
  return ranked;
}

function vwLeagueTable(seasonId) {
  const teams = indexBy(store.read('Teams'), 'TeamID');
  const matches = store.read('Matches');
  const zones = store.read('SeasonZones').filter((z) => z.SeasonID === seasonId);
  const rows = store.read('Standings')
    .filter((row) => row.SeasonID === seasonId)
    .map((row) => ({ ...row, GD: row.GF - row.GA }))
    .sort((a, b) => b.Points - a.Points || b.GD - a.GD || b.GF - a.GF);
  return withRank(rows, (a, b) => a.Points === b.Points && a.GD === b.GD && a.GF === b.GF).map((row) => {
    const team = teams.get(row.TeamID);
    const zone = zones.find((z) => row.RankNo >= z.FromRank && row.RankNo <= z.ToRank);
    return {
      SeasonID: row.SeasonID,
      TeamID: row.TeamID,
      TeamName: team.TeamName,
      ShortName: team.ShortName,
      LogoUrl: team.LogoUrl,
      RankNo: row.RankNo,
      Played: row.Played,
      Won: row.Won,
      Drawn: row.Drawn,
      Lost: row.Lost,
      GF: row.GF,
      GA: row.GA,
      GD: row.GD,
      Points: row.Points,
      Form: teamForm(matches, seasonId, row.TeamID),
      ZoneName: zone ? zone.ZoneName : null,
      ColorHex: zone ? zone.ColorHex : null,
    };
  }).sort((a, b) => a.RankNo - b.RankNo || a.TeamName.localeCompare(b.TeamName, 'th'));
}

function vwMatchList() {
  const teams = indexBy(store.read('Teams'), 'TeamID');
  const seasons = indexBy(store.read('Seasons'), 'SeasonID');
  const venues = indexBy(store.read('Venues'), 'VenueID');
  return store.read('Matches').map((m) => {
    const season = seasons.get(m.SeasonID);
    const home = teams.get(m.HomeTeamID);
    const away = teams.get(m.AwayTeamID);
    const venue = venues.get(m.VenueID);
    return {
      MatchID: m.MatchID,
      SeasonID: m.SeasonID,
      RoundNo: m.RoundNo,
      SeasonName: season.SeasonName,
      SeasonStatus: season.Status,
      KickoffAt: m.KickoffAt,
      Status: m.Status,
      HomeTeamID: m.HomeTeamID,
      AwayTeamID: m.AwayTeamID,
      HomeTeamName: home.TeamName,
      AwayTeamName: away.TeamName,
      HomeLogoUrl: home.LogoUrl,
      AwayLogoUrl: away.LogoUrl,
      HomeScore: m.HomeScore,
      AwayScore: m.AwayScore,
      VenueID: m.VenueID,
      VenueName: venue ? venue.VenueName : null,
      RowVersion: m.RowVersion,
      UpdatedAt: m.UpdatedAt,
    };
  });
}

function vwUpcomingMatches() {
  return vwMatchList().filter((m) => m.Status === 'Scheduled' && m.SeasonStatus === 'Active');
}

function vwTopScorers(seasonId) {
  const players = indexBy(store.read('Players'), 'PlayerID');
  const teams = indexBy(store.read('Teams'), 'TeamID');
  const finished = new Set(store.read('Matches')
    .filter((m) => m.SeasonID === seasonId && m.Status === 'Finished')
    .map((m) => m.MatchID));
  const goals = new Map();
  for (const e of store.read('MatchEvents')) {
    if (e.EventType === 'Goal' && finished.has(e.MatchID)) goals.set(e.PlayerID, (goals.get(e.PlayerID) || 0) + 1);
  }
  const rows = [...goals.entries()].map(([playerId, count]) => {
    const player = players.get(playerId);
    const team = teams.get(player.TeamID);
    return {
      SeasonID: seasonId,
      PlayerID: playerId,
      TeamID: player.TeamID,
      Nickname: player.Nickname,
      JerseyNo: player.JerseyNo,
      TeamName: team.TeamName,
      LogoUrl: team.LogoUrl,
      Goals: count,
    };
  }).sort((a, b) => b.Goals - a.Goals || a.Nickname.localeCompare(b.Nickname, 'th'));
  return withRank(rows, (a, b) => a.Goals === b.Goals);
}

function vwTeamRoster(teamId) {
  const teams = indexBy(store.read('Teams'), 'TeamID');
  return store.read('Players')
    .filter((p) => p.TeamID === teamId)
    .map((p) => ({
      TeamID: p.TeamID,
      PlayerID: p.PlayerID,
      TeamName: teams.get(p.TeamID).TeamName,
      JerseyNo: p.JerseyNo,
      Nickname: p.Nickname,
      Position: p.Position,
    }))
    .sort((a, b) => a.JerseyNo - b.JerseyNo);
}

function vwMatchEventDetails(matchId) {
  const players = indexBy(store.read('Players'), 'PlayerID');
  const teams = indexBy(store.read('Teams'), 'TeamID');
  return store.read('MatchEvents')
    .filter((e) => e.MatchID === matchId)
    .map((e) => {
      const player = players.get(e.PlayerID);
      return {
        EventID: e.EventID,
        MatchID: e.MatchID,
        PlayerID: e.PlayerID,
        TeamID: player.TeamID,
        Minute: e.Minute,
        EventType: e.EventType,
        Nickname: player.Nickname,
        JerseyNo: player.JerseyNo,
        TeamName: teams.get(player.TeamID).TeamName,
      };
    })
    .sort((a, b) => a.Minute - b.Minute || a.EventID - b.EventID);
}

function vwTeamList() {
  const users = indexBy(store.read('Users'), 'UserID');
  const seasons = indexBy(store.read('Seasons'), 'SeasonID');
  const players = store.read('Players');
  return store.read('Teams').map((t) => ({
    TeamID: t.TeamID,
    CreatedBy: t.CreatedBy,
    RequestedSeasonID: t.RequestedSeasonID,
    TeamName: t.TeamName,
    ShortName: t.ShortName,
    LogoUrl: t.LogoUrl,
    Status: t.Status,
    CreatedByUsername: users.get(t.CreatedBy).Username,
    RequestedSeasonName: seasons.get(t.RequestedSeasonID).SeasonName,
    PlayerCount: players.filter((p) => p.TeamID === t.TeamID).length,
    CreatedAt: t.CreatedAt,
  })).sort((a, b) => a.TeamName.localeCompare(b.TeamName, 'th'));
}

function vwSeasonList() {
  const seasonTeams = store.read('SeasonTeams');
  const matches = store.read('Matches');
  return store.read('Seasons').map((s) => {
    const own = matches.filter((m) => m.SeasonID === s.SeasonID);
    return {
      SeasonID: s.SeasonID,
      SeasonName: s.SeasonName,
      StartDate: s.StartDate,
      EndDate: s.EndDate,
      Status: s.Status,
      TeamCount: seasonTeams.filter((st) => st.SeasonID === s.SeasonID).length,
      MatchCount: own.length,
      FinishedCount: own.filter((m) => m.Status === 'Finished').length,
    };
  }).sort((a, b) => b.StartDate.localeCompare(a.StartDate));
}

function vwScoreAudit() {
  const users = indexBy(store.read('Users'), 'UserID');
  const matches = indexBy(vwMatchList(), 'MatchID');
  return store.read('ScoreAuditLog').map((a) => {
    const match = matches.get(a.MatchID);
    const user = users.get(a.ChangedBy);
    return {
      AuditID: a.AuditID,
      MatchID: a.MatchID,
      HomeTeamName: match ? match.HomeTeamName : null,
      AwayTeamName: match ? match.AwayTeamName : null,
      OldHomeScore: a.OldHomeScore,
      OldAwayScore: a.OldAwayScore,
      NewHomeScore: a.NewHomeScore,
      NewAwayScore: a.NewAwayScore,
      ChangeType: a.ChangeType,
      ChangedBy: a.ChangedBy,
      ChangedByUsername: user ? user.Username : null,
      ChangedByLogin: a.ChangedByLogin,
      ChangedAt: a.ChangedAt,
    };
  }).sort((a, b) => b.ChangedAt.localeCompare(a.ChangedAt) || b.AuditID - a.AuditID);
}

function vwNotifications() {
  return store.read('Notifications')
    .sort((a, b) => b.CreatedAt.localeCompare(a.CreatedAt) || b.NotificationID - a.NotificationID);
}

function fnHeadToHead(teamA, teamB) {
  return vwMatchList()
    .filter((m) => m.Status === 'Finished'
      && ((m.HomeTeamID === teamA && m.AwayTeamID === teamB) || (m.HomeTeamID === teamB && m.AwayTeamID === teamA)))
    .map((m) => {
      let winner = null;
      if (m.HomeScore > m.AwayScore) winner = m.HomeTeamID;
      else if (m.AwayScore > m.HomeScore) winner = m.AwayTeamID;
      return {
        MatchID: m.MatchID,
        SeasonID: m.SeasonID,
        SeasonName: m.SeasonName,
        KickoffAt: m.KickoffAt,
        HomeTeamID: m.HomeTeamID,
        AwayTeamID: m.AwayTeamID,
        HomeTeamName: m.HomeTeamName,
        AwayTeamName: m.AwayTeamName,
        HomeScore: m.HomeScore,
        AwayScore: m.AwayScore,
        WinnerTeamID: winner,
      };
    })
    .sort((a, b) => b.KickoffAt.localeCompare(a.KickoffAt) || b.MatchID - a.MatchID);
}

module.exports = {
  vwLeagueTable,
  vwMatchList,
  vwUpcomingMatches,
  vwTopScorers,
  vwTeamRoster,
  vwMatchEventDetails,
  vwTeamList,
  vwSeasonList,
  vwScoreAudit,
  vwNotifications,
  fnHeadToHead,
};
