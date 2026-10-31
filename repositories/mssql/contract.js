// ทุกสิ่งที่เว็บต้องการจากฐานข้อมูล ตรงกับ docs/db_design.md และ docs/db_contract.md
// repository ใช้ชื่อคอลัมน์จากไฟล์นี้ และ npm run db:check ใช้ตรวจว่าฐานข้อมูลมีครบ

const tables = {
  Users: ['UserID', 'Username', 'PasswordHash', 'DisplayName', 'Role', 'CreatedAt'],
  Seasons: ['SeasonID', 'SeasonName', 'StartDate', 'EndDate', 'Status'],
  Teams: ['TeamID', 'TeamName', 'ShortName', 'LogoUrl', 'Status', 'CreatedBy', 'RequestedSeasonID', 'ReviewedBy', 'ReviewedAt', 'CreatedAt'],
  SeasonTeams: ['SeasonID', 'TeamID', 'JoinedAt'],
  Players: ['PlayerID', 'TeamID', 'Nickname', 'Position', 'JerseyNo', 'CreatedAt'],
  Venues: ['VenueID', 'VenueName', 'Location'],
  Matches: ['MatchID', 'SeasonID', 'RoundNo', 'HomeTeamID', 'AwayTeamID', 'VenueID', 'KickoffAt', 'Status', 'HomeScore', 'AwayScore', 'RowVersion', 'UpdatedBy', 'UpdatedAt'],
  MatchEvents: ['EventID', 'MatchID', 'PlayerID', 'EventType', 'Minute', 'CreatedBy', 'CreatedAt'],
  Standings: ['SeasonID', 'TeamID', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points'],
  ScoreAuditLog: ['AuditID', 'MatchID', 'OldHomeScore', 'OldAwayScore', 'NewHomeScore', 'NewAwayScore', 'ChangeType', 'ChangedBy', 'ChangedByLogin', 'ChangedAt'],
  SeasonZones: ['ZoneID', 'SeasonID', 'ZoneName', 'FromRank', 'ToRank', 'ColorHex'],
  Notifications: ['NotificationID', 'MatchID', 'Type', 'Message', 'CreatedAt'],
};

// คอลัมน์ที่เก็บข้อความไทย ต้องเป็น NVARCHAR
const nvarcharColumns = [
  'Users.DisplayName', 'Seasons.SeasonName', 'Teams.TeamName', 'Teams.ShortName', 'Players.Nickname',
  'Venues.VenueName', 'Venues.Location', 'SeasonZones.ZoneName', 'Notifications.Message',
];

const views = {
  vw_LeagueTable: ['SeasonID', 'TeamID', 'TeamName', 'ShortName', 'LogoUrl', 'RankNo', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points', 'Form', 'ZoneName', 'ColorHex'],
  vw_UpcomingMatches: ['MatchID', 'SeasonID', 'RoundNo', 'KickoffAt', 'HomeTeamID', 'AwayTeamID', 'HomeTeamName', 'AwayTeamName', 'HomeLogoUrl', 'AwayLogoUrl', 'VenueName'],
  vw_TopScorers: ['SeasonID', 'PlayerID', 'TeamID', 'Nickname', 'JerseyNo', 'TeamName', 'LogoUrl', 'Goals', 'RankNo'],
  vw_TeamRoster: ['TeamID', 'PlayerID', 'TeamName', 'JerseyNo', 'Nickname', 'Position'],
  vw_MatchList: ['MatchID', 'SeasonID', 'RoundNo', 'SeasonName', 'SeasonStatus', 'KickoffAt', 'Status', 'HomeTeamID', 'AwayTeamID', 'HomeTeamName', 'AwayTeamName', 'HomeLogoUrl', 'AwayLogoUrl', 'HomeScore', 'AwayScore', 'VenueID', 'VenueName', 'RowVersion', 'UpdatedAt'],
  vw_MatchEventDetails: ['EventID', 'MatchID', 'PlayerID', 'TeamID', 'Minute', 'EventType', 'Nickname', 'JerseyNo', 'TeamName'],
  vw_TeamList: ['TeamID', 'CreatedBy', 'RequestedSeasonID', 'TeamName', 'ShortName', 'LogoUrl', 'Status', 'CreatedByUsername', 'RequestedSeasonName', 'PlayerCount', 'CreatedAt'],
  vw_SeasonList: ['SeasonID', 'SeasonName', 'StartDate', 'EndDate', 'Status', 'TeamCount', 'MatchCount', 'FinishedCount'],
  vw_ScoreAudit: ['AuditID', 'MatchID', 'HomeTeamName', 'AwayTeamName', 'OldHomeScore', 'OldAwayScore', 'NewHomeScore', 'NewAwayScore', 'ChangeType', 'ChangedBy', 'ChangedByUsername', 'ChangedByLogin', 'ChangedAt'],
  vw_Notifications: ['NotificationID', 'MatchID', 'Type', 'Message', 'CreatedAt'],
};

const scalarFunctions = { fn_CalcPoints: ['@gf', '@ga'], fn_TeamForm: ['@SeasonID', '@TeamID'] };

const tableFunctions = {
  fn_HeadToHead: {
    params: ['@TeamA', '@TeamB'],
    columns: ['MatchID', 'SeasonID', 'SeasonName', 'KickoffAt', 'HomeTeamID', 'AwayTeamID', 'HomeTeamName', 'AwayTeamName', 'HomeScore', 'AwayScore', 'WinnerTeamID'],
  },
};

const procedures = {
  usp_RecordMatchResult: ['@MatchID', '@HomeScore', '@AwayScore', '@RowVersion', '@UpdatedBy'],
  usp_ClearMatchResult: ['@MatchID', '@RowVersion', '@UpdatedBy'],
  usp_AddMatchEvent: ['@MatchID', '@PlayerID', '@EventType', '@Minute', '@CreatedBy'],
  usp_DeleteMatchEvent: ['@EventID'],
  usp_GenerateFixtures: ['@SeasonID'],
  usp_CreateSeason: ['@SeasonName', '@StartDate', '@EndDate'],
  usp_SetSeasonStatus: ['@SeasonID', '@Status'],
  usp_AddTeamToSeason: ['@SeasonID', '@TeamID'],
  usp_RegisterTeam: ['@TeamName', '@ShortName', '@LogoUrl', '@RequestedSeasonID', '@CreatedBy'],
  usp_ApproveTeam: ['@TeamID', '@Approve', '@ReviewedBy'],
  usp_RegisterPlayer: ['@TeamID', '@Nickname', '@Position', '@JerseyNo', '@UserID'],
  usp_SearchPlayers: ['@Keyword'],
  usp_GetUserForLogin: ['@Username'],
  usp_RegisterUser: ['@Username', '@PasswordHash', '@DisplayName'],
};

const triggers = {
  trg_Matches_UpdateStandings: 'Matches',
  trg_Matches_AuditScore: 'Matches',
  trg_MatchEvents_ValidatePlayer: 'MatchEvents',
  trg_Teams_Approved: 'Teams',
  trg_Teams_LimitPerUser: 'Teams',
};

// ชื่อ constraint ที่เว็บใช้แปล error เป็นภาษาไทย
const constraints = [
  'UQ_Users_Username', 'UQ_Seasons_SeasonName', 'UQ_Teams_TeamName', 'UQ_Players_Team_Jersey', 'UQ_Matches_Season_Pair',
  'CK_Seasons_Dates', 'CK_Players_Position', 'CK_Matches_DifferentTeams', 'CK_Matches_ScoreNonNegative',
  'CK_Matches_FinishedHasScore', 'CK_MatchEvents_Type', 'CK_MatchEvents_Minute',
  'FK_Matches_HomeTeam', 'FK_Matches_AwayTeam', 'FK_Matches_UpdatedBy', 'FK_MatchEvents_Users', 'FK_MatchEvents_Players',
];

const indexes = ['UX_Seasons_OneActive'];
const roles = ['role_viewer', 'role_team_manager', 'role_referee', 'role_admin', 'role_checker'];

module.exports = {
  tables,
  nvarcharColumns,
  views,
  scalarFunctions,
  tableFunctions,
  procedures,
  triggers,
  constraints,
  indexes,
  roles,
};
