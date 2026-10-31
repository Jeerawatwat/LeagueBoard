// ของจำลองทั้งโฟลเดอร์: จำลองพฤติกรรมของ view, SP และ trigger ด้วย JSON
// ของจริงอยู่ในฐานข้อมูล ฟังก์ชันทุกตัวชื่อตรงกับ repositories/mssql/
const store = require('./store');
const views = require('./views');
const engine = require('./engine');
const dbError = require('./dbError');
const { assertGranted } = require('./permissions');

const seasons = {
  async listSeasons() {
    return views.vwSeasonList();
  },

  // จำลอง usp_CreateSeason
  async createSeason(ctx, { seasonName, startDate, endDate }) {
    assertGranted(ctx, 'usp_CreateSeason');
    if (!seasonName) throw dbError.notNull('SeasonName');
    if (!startDate) throw dbError.notNull('StartDate');
    if (!endDate) throw dbError.notNull('EndDate');
    if (endDate < startDate) throw dbError.check('CK_Seasons_Dates');
    const rows = store.read('Seasons');
    if (rows.some((s) => s.SeasonName === seasonName)) throw dbError.unique('UQ_Seasons_SeasonName');
    const seasonId = store.nextId(rows, 'SeasonID');
    const latest = [...rows].sort((a, b) => b.StartDate.localeCompare(a.StartDate))[0];
    rows.push({
      SeasonID: seasonId, SeasonName: seasonName, StartDate: startDate, EndDate: endDate, Status: 'Upcoming',
    });
    store.write('Seasons', rows);
    if (latest) {
      const zones = store.read('SeasonZones');
      const firstId = store.nextId(zones, 'ZoneID');
      const copies = zones.filter((z) => z.SeasonID === latest.SeasonID)
        .map((z, i) => ({ ...z, ZoneID: firstId + i, SeasonID: seasonId }));
      store.write('SeasonZones', [...zones, ...copies]);
    }
    return { SeasonID: seasonId };
  },

  // จำลอง usp_SetSeasonStatus
  async setSeasonStatus(ctx, { seasonId, status }) {
    assertGranted(ctx, 'usp_SetSeasonStatus');
    const rows = store.read('Seasons');
    const season = rows.find((s) => s.SeasonID === seasonId);
    if (!season) throw dbError.business(51020);
    const matches = store.read('Matches').filter((m) => m.SeasonID === seasonId);
    if (season.Status === 'Upcoming' && status === 'Active') {
      if (matches.length === 0) throw dbError.business(51025);
      if (rows.some((s) => s.Status === 'Active')) throw dbError.business(51026);
    } else if (season.Status === 'Active' && status === 'Finished') {
      if (matches.some((m) => m.Status !== 'Finished')) throw dbError.business(51025);
    } else {
      throw dbError.business(51025);
    }
    season.Status = status;
    store.write('Seasons', rows);
  },

  // จำลอง usp_GenerateFixtures
  async generateFixtures(ctx, seasonId) {
    assertGranted(ctx, 'usp_GenerateFixtures');
    const season = store.read('Seasons').find((s) => s.SeasonID === seasonId);
    if (!season) throw dbError.business(51020);
    if (season.Status !== 'Upcoming') throw dbError.business(51027);
    const matches = store.read('Matches');
    if (matches.some((m) => m.SeasonID === seasonId)) throw dbError.business(51022);
    const teamIds = store.read('SeasonTeams').filter((st) => st.SeasonID === seasonId).map((st) => st.TeamID);
    if (teamIds.length < 2) throw dbError.business(51023);
    const venues = store.read('Venues');
    if (venues.length === 0) throw dbError.business(51024);
    const { rows, rounds } = engine.buildFixtures(season, teamIds, venues, store.nextId(matches, 'MatchID'));
    store.write('Matches', [...matches, ...rows]);
    engine.rebuildStandings([seasonId]);
    return { MatchesCreated: rows.length, Rounds: rounds };
  },

  // จำลอง usp_AddTeamToSeason
  async addTeamToSeason(ctx, { seasonId, teamId }) {
    assertGranted(ctx, 'usp_AddTeamToSeason');
    const season = store.read('Seasons').find((s) => s.SeasonID === seasonId);
    if (!season) throw dbError.business(51020);
    if (season.Status !== 'Upcoming') throw dbError.business(51027);
    if (store.read('Matches').some((m) => m.SeasonID === seasonId)) throw dbError.business(51022);
    const team = store.read('Teams').find((t) => t.TeamID === teamId);
    if (!team) throw dbError.business(51030);
    if (team.Status !== 'Approved') throw dbError.business(51034);
    const seasonTeams = store.read('SeasonTeams');
    if (seasonTeams.some((st) => st.SeasonID === seasonId && st.TeamID === teamId)) throw dbError.business(51035);
    seasonTeams.push({ SeasonID: seasonId, TeamID: teamId, JoinedAt: store.now() });
    store.write('SeasonTeams', seasonTeams);
    engine.rebuildStandings([seasonId]);
  },
};

const standings = {
  async getLeagueTable(ctx, seasonId) {
    return views.vwLeagueTable(seasonId);
  },
  async getTopScorers(ctx, seasonId) {
    return views.vwTopScorers(seasonId);
  },
};

const matches = {
  async listMatches(ctx, filters = {}) {
    return views.vwMatchList()
      .filter((m) => (filters.seasonId === undefined || m.SeasonID === filters.seasonId)
        && (filters.roundNo === undefined || m.RoundNo === filters.roundNo)
        && (filters.status === undefined || m.Status === filters.status)
        && (filters.teamId === undefined || m.HomeTeamID === filters.teamId || m.AwayTeamID === filters.teamId))
      .sort((a, b) => a.RoundNo - b.RoundNo || a.KickoffAt.localeCompare(b.KickoffAt) || a.MatchID - b.MatchID);
  },
  async getMatch(ctx, matchId) {
    return views.vwMatchList().find((m) => m.MatchID === matchId) || null;
  },
  async listRecent(ctx, limit) {
    return views.vwMatchList()
      .filter((m) => m.Status === 'Finished')
      .sort((a, b) => b.KickoffAt.localeCompare(a.KickoffAt) || b.MatchID - a.MatchID)
      .slice(0, limit);
  },
  async listUpcoming(ctx, limit) {
    return views.vwUpcomingMatches()
      .sort((a, b) => a.KickoffAt.localeCompare(b.KickoffAt) || a.MatchID - b.MatchID)
      .slice(0, limit);
  },
  async getHeadToHead(ctx, teamA, teamB) {
    return views.fnHeadToHead(teamA, teamB);
  },
  async listEvents(ctx, matchId) {
    return views.vwMatchEventDetails(matchId);
  },

  // จำลอง usp_RecordMatchResult ของจริงใช้ TRANSACTION + TRY/CATCH
  async recordResult(ctx, { matchId, homeScore, awayScore, rowVersion }) {
    assertGranted(ctx, 'usp_RecordMatchResult');
    const match = store.read('Matches').find((m) => m.MatchID === matchId);
    if (!match) throw dbError.business(51001);
    const season = store.read('Seasons').find((s) => s.SeasonID === match.SeasonID);
    if (season.Status === 'Finished') throw dbError.business(51007);
    if (homeScore === null || awayScore === null || homeScore < 0 || awayScore < 0) throw dbError.business(51003);
    if (match.RowVersion !== rowVersion) throw dbError.business(51002);

    const firstEntry = match.Status !== 'Finished';
    const changed = match.HomeScore !== homeScore || match.AwayScore !== awayScore;
    const updated = engine.updateMatch(matchId, {
      HomeScore: homeScore, AwayScore: awayScore, Status: 'Finished',
    }, ctx.userId);

    if (firstEntry || changed) {
      const row = views.vwMatchList().find((m) => m.MatchID === matchId);
      const line = `${row.HomeTeamName} ${homeScore}-${awayScore} ${row.AwayTeamName}`;
      const rows = store.read('Notifications');
      rows.push({
        NotificationID: store.nextId(rows, 'NotificationID'),
        MatchID: matchId,
        Type: firstEntry ? 'MatchFinished' : 'ResultCorrected',
        Message: `${firstEntry ? 'จบการแข่งขัน' : 'แก้ไขผล'}: ${line}`,
        CreatedAt: store.now(),
      });
      store.write('Notifications', rows);
    }
    return {
      MatchID: matchId,
      HomeScore: homeScore,
      AwayScore: awayScore,
      Status: updated.Status,
      RowVersion: updated.RowVersion,
    };
  },

  // จำลอง usp_ClearMatchResult
  async clearResult(ctx, { matchId, rowVersion }) {
    assertGranted(ctx, 'usp_ClearMatchResult');
    const match = store.read('Matches').find((m) => m.MatchID === matchId);
    if (!match) throw dbError.business(51001);
    const season = store.read('Seasons').find((s) => s.SeasonID === match.SeasonID);
    if (season.Status === 'Finished') throw dbError.business(51007);
    if (match.Status !== 'Finished') throw dbError.business(51006);
    if (match.RowVersion !== rowVersion) throw dbError.business(51002);
    store.write('MatchEvents', store.read('MatchEvents').filter((e) => e.MatchID !== matchId));
    const updated = engine.updateMatch(matchId, { HomeScore: null, AwayScore: null, Status: 'Scheduled' }, ctx.userId);
    return { MatchID: matchId, Status: updated.Status, RowVersion: updated.RowVersion };
  },

  // จำลอง usp_AddMatchEvent, trg_MatchEvents_ValidatePlayer และ CHECK ของ MatchEvents
  async addEvent(ctx, { matchId, playerId, eventType, minute }) {
    assertGranted(ctx, 'usp_AddMatchEvent');
    const match = store.read('Matches').find((m) => m.MatchID === matchId);
    if (!match) throw dbError.business(51001);
    const season = store.read('Seasons').find((s) => s.SeasonID === match.SeasonID);
    if (season.Status === 'Finished') throw dbError.business(51007);
    if (match.Status !== 'Finished') throw dbError.business(51004);
    if (minute === null) throw dbError.notNull('Minute');
    if (!['Goal', 'Yellow', 'Red'].includes(eventType)) throw dbError.check('CK_MatchEvents_Type');
    if (minute < 0 || minute > 120) throw dbError.check('CK_MatchEvents_Minute');
    const player = store.read('Players').find((p) => p.PlayerID === playerId);
    if (!player) throw dbError.check('FK_MatchEvents_Players');
    if (player.TeamID !== match.HomeTeamID && player.TeamID !== match.AwayTeamID) throw dbError.business(51010);
    const rows = store.read('MatchEvents');
    const eventId = store.nextId(rows, 'EventID');
    rows.push({
      EventID: eventId,
      MatchID: matchId,
      PlayerID: playerId,
      EventType: eventType,
      Minute: minute,
      CreatedBy: ctx.userId,
      CreatedAt: store.now(),
    });
    store.write('MatchEvents', rows);
    return { EventID: eventId };
  },

  // จำลอง usp_DeleteMatchEvent
  async deleteEvent(ctx, eventId) {
    assertGranted(ctx, 'usp_DeleteMatchEvent');
    const rows = store.read('MatchEvents');
    const event = rows.find((e) => e.EventID === eventId);
    if (!event) throw dbError.business(51005);
    const match = store.read('Matches').find((m) => m.MatchID === event.MatchID);
    const season = store.read('Seasons').find((s) => s.SeasonID === match.SeasonID);
    if (season.Status === 'Finished') throw dbError.business(51007);
    store.write('MatchEvents', rows.filter((e) => e.EventID !== eventId));
  },
};

const teams = {
  async listTeams(ctx, filters = {}) {
    return views.vwTeamList()
      .filter((t) => (filters.status === undefined || t.Status === filters.status)
        && (filters.createdBy === undefined || t.CreatedBy === filters.createdBy));
  },
  async getTeam(ctx, teamId) {
    return views.vwTeamList().find((t) => t.TeamID === teamId) || null;
  },
  async getRoster(ctx, teamId) {
    return views.vwTeamRoster(teamId);
  },

  // จำลอง usp_SearchPlayers
  async searchPlayers(ctx, keyword) {
    const word = (keyword || '').trim().toLowerCase();
    if (!word) return [];
    const list = new Map(views.vwTeamList().map((t) => [t.TeamID, t]));
    return store.read('Players')
      .filter((p) => list.get(p.TeamID).Status === 'Approved' && p.Nickname.toLowerCase().includes(word))
      .map((p) => {
        const team = list.get(p.TeamID);
        return {
          PlayerID: p.PlayerID,
          Nickname: p.Nickname,
          Position: p.Position,
          JerseyNo: p.JerseyNo,
          TeamID: p.TeamID,
          TeamName: team.TeamName,
          LogoUrl: team.LogoUrl,
        };
      })
      .sort((a, b) => a.Nickname.localeCompare(b.Nickname, 'th'));
  },

  // จำลอง usp_RegisterTeam และ trg_Teams_LimitPerUser
  async registerTeam(ctx, { teamName, shortName, logoUrl, requestedSeasonId }) {
    assertGranted(ctx, 'usp_RegisterTeam');
    if (!teamName) throw dbError.notNull('TeamName');
    if (!shortName) throw dbError.notNull('ShortName');
    const season = store.read('Seasons').find((s) => s.SeasonID === requestedSeasonId);
    if (!season) throw dbError.business(51020);
    if (season.Status !== 'Upcoming') throw dbError.business(51027);
    const rows = store.read('Teams');
    if (rows.some((t) => t.TeamName === teamName)) throw dbError.unique('UQ_Teams_TeamName');
    const owned = rows.filter((t) => t.CreatedBy === ctx.userId && t.Status !== 'Rejected');
    if (owned.length >= 3) throw dbError.business(51032);
    const teamId = store.nextId(rows, 'TeamID');
    rows.push({
      TeamID: teamId,
      TeamName: teamName,
      ShortName: shortName,
      LogoUrl: logoUrl || null,
      Status: 'Pending',
      CreatedBy: ctx.userId,
      RequestedSeasonID: requestedSeasonId,
      ReviewedBy: null,
      ReviewedAt: null,
      CreatedAt: store.now(),
    });
    store.write('Teams', rows);
    return { TeamID: teamId };
  },

  // จำลอง usp_ApproveTeam และ trg_Teams_Approved
  async reviewTeam(ctx, { teamId, approve }) {
    assertGranted(ctx, 'usp_ApproveTeam');
    const rows = store.read('Teams');
    const team = rows.find((t) => t.TeamID === teamId);
    if (!team) throw dbError.business(51030);
    if (team.Status !== 'Pending') throw dbError.business(51031);
    if (approve) {
      const season = store.read('Seasons').find((s) => s.SeasonID === team.RequestedSeasonID);
      if (season.Status !== 'Upcoming') throw dbError.business(51027);
      if (store.read('Matches').some((m) => m.SeasonID === season.SeasonID)) throw dbError.business(51022);
    }
    team.Status = approve ? 'Approved' : 'Rejected';
    team.ReviewedBy = ctx.userId;
    team.ReviewedAt = store.now();
    store.write('Teams', rows);
    if (approve) {
      const seasonTeams = store.read('SeasonTeams');
      if (!seasonTeams.some((st) => st.SeasonID === team.RequestedSeasonID && st.TeamID === teamId)) {
        seasonTeams.push({ SeasonID: team.RequestedSeasonID, TeamID: teamId, JoinedAt: store.now() });
        store.write('SeasonTeams', seasonTeams);
      }
      engine.rebuildStandings([team.RequestedSeasonID]);
    }
  },

  // จำลอง usp_RegisterPlayer, Rule ของเบอร์เสื้อ และ UNIQUE
  async registerPlayer(ctx, { teamId, nickname, position, jerseyNo }) {
    assertGranted(ctx, 'usp_RegisterPlayer');
    const team = store.read('Teams').find((t) => t.TeamID === teamId);
    if (!team) throw dbError.business(51030);
    if (team.CreatedBy !== ctx.userId) throw dbError.business(51033);
    if (team.Status !== 'Approved') throw dbError.business(51034);
    if (!nickname || jerseyNo === null || jerseyNo < 1 || jerseyNo > 99) throw dbError.business(51040);
    if (!['GK', 'DF', 'MF', 'FW'].includes(position)) throw dbError.check('CK_Players_Position');
    const rows = store.read('Players');
    if (rows.some((p) => p.TeamID === teamId && p.JerseyNo === jerseyNo)) throw dbError.unique('UQ_Players_Team_Jersey');
    const playerId = store.nextId(rows, 'PlayerID');
    rows.push({
      PlayerID: playerId,
      TeamID: teamId,
      Nickname: nickname,
      Position: position,
      JerseyNo: jerseyNo,
      CreatedAt: store.now(),
    });
    store.write('Players', rows);
    return { PlayerID: playerId };
  },
};

const users = {
  // จำลอง usp_GetUserForLogin
  async findForLogin(ctx, username) {
    const user = store.read('Users').find((u) => u.Username.toLowerCase() === String(username).toLowerCase());
    if (!user) return null;
    return {
      UserID: user.UserID,
      Username: user.Username,
      PasswordHash: user.PasswordHash,
      DisplayName: user.DisplayName,
      Role: user.Role,
    };
  },

  // จำลอง usp_RegisterUser สมัครได้เฉพาะ team_manager
  async register(ctx, { username, passwordHash, displayName }) {
    if (!username || !displayName) throw dbError.business(51050);
    const rows = store.read('Users');
    if (rows.some((u) => u.Username.toLowerCase() === username.toLowerCase())) {
      throw dbError.unique('UQ_Users_Username');
    }
    const userId = store.nextId(rows, 'UserID');
    rows.push({
      UserID: userId,
      Username: username,
      PasswordHash: passwordHash,
      DisplayName: displayName,
      Role: 'team_manager',
      CreatedAt: store.now(),
    });
    store.write('Users', rows);
    return { UserID: userId };
  },
};

const notifications = {
  async listNotifications(ctx, limit) {
    return views.vwNotifications().slice(0, limit);
  },
};

const admin = {
  async listScoreAudit(ctx) {
    assertGranted(ctx, 'vw_ScoreAudit');
    return views.vwScoreAudit();
  },
};

const system = {
  async checkDatabase() {
    return { mode: 'mock' };
  },
};

module.exports = {
  seasons, standings, matches, teams, users, notifications, admin, system,
};
