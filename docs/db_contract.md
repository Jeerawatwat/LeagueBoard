# LeagueBoard — สัญญาระหว่างเว็บกับฐานข้อมูล

เอกสารนี้ระบุทุกสิ่งที่เว็บเรียกจากฐานข้อมูล ถ้าชื่อ object พารามิเตอร์ หรือคอลัมน์ไม่ตรงกับเอกสารนี้ เว็บจะใช้งานไม่ได้ และ `npm run db:check` จะรายงานว่าขาด

ถ้าต้องเปลี่ยน ให้ตกลงกับคนทำเว็บแล้วแก้เอกสารนี้ก่อนแก้โค้ด โครงสร้างตารางอยู่ใน `db_design.md`

## 1. ภาพรวม

| ประเภท | จำนวน | รายการ |
|---|---|---|
| View | 10 | `vw_LeagueTable`, `vw_UpcomingMatches`, `vw_TopScorers`, `vw_TeamRoster`, `vw_MatchList`, `vw_MatchEventDetails`, `vw_TeamList`, `vw_SeasonList`, `vw_ScoreAudit`, `vw_Notifications` |
| Function | 3 | `fn_CalcPoints`, `fn_TeamForm`, `fn_HeadToHead` |
| Stored Procedure | 14 | ดูหัวข้อ 5 |
| Trigger | 5 | ดู `db_design.md` หัวข้อ 6 เว็บไม่เรียกโดยตรง แต่ทำงานผ่าน SP |

### กฎร่วม

- เว็บใช้ parameterized query เท่านั้น
- เว็บ SELECT เฉพาะ view กับ `fn_HeadToHead` และแก้ข้อมูลผ่าน SP เท่านั้น ไม่แตะตารางตรง
- view ไม่มี `ORDER BY` เว็บเป็นคนเรียงตามคอลัมน์ "การเรียงของเว็บ"
- SP ที่คืนข้อมูลใช้ result set แถวเดียว ไม่ใช้ OUTPUT parameter
- ทุก SP ต้อง `SET NOCOUNT ON`
- ฝั่งเว็บต้องตั้ง `options.useUTC = false` ใน `mssql` เพราะฐานข้อมูลเก็บเวลาท้องถิ่น ไม่เช่นนั้นเวลาจะคลาด 7 ชั่วโมง
- `RowVersion` เป็น `BINARY(8)` เว็บรับเป็น Buffer และส่งกลับในฟอร์มเป็น hex
- พารามิเตอร์ผู้กระทำ เช่น `@UpdatedBy` เว็บส่งจาก session ไม่รับจากฟอร์ม

### การเลือก connection pool

ทุกฟังก์ชันใน repository รับ `ctx` เป็นพารามิเตอร์แรก (`{ role, userId }`) แล้วเลือก pool ตาม `ctx.role`: ไม่มี role ใช้ `lb_viewer`, `team_manager` ใช้ `lb_team_manager`, `referee` ใช้ `lb_referee`, `admin` ใช้ `lb_admin`

## 2. รูปแบบ Error

### กฎการ THROW

- Error เชิงธุรกิจใช้ `THROW` เลขในช่วง 51000–51999 พร้อมข้อความภาษาไทยแบบ `N'...'`
- เว็บเลือกข้อความจาก **เลข error** ตามตารางด้านล่าง ถ้าเป็นเลข 51xxx ที่เว็บไม่รู้จัก จะแสดงข้อความจากฐานข้อมูลตรงๆ
- SP ที่มี TRY/CATCH ต้อง rollback เมื่อยังมี transaction ค้าง แล้วใช้ `THROW;` แบบไม่มีพารามิเตอร์เพื่อส่ง error เดิมต่อ ห้ามเปลี่ยนเลข เช่น 51010 จาก trigger หรือ 547 จาก constraint ต้องไปถึงเว็บเป็นเลขเดิม
- ห้ามใช้ `RAISERROR` หรือคืนรหัสสถานะแทน error
- เลข 51999 สงวนไว้ให้เว็บใช้ตรวจฟอร์ม เช่น รหัสผ่านสั้นเกินไป ฐานข้อมูลห้ามใช้เลขนี้

### Error ของระบบ

| รหัสเว็บ | เลข | การตัดสิน | ข้อความบนเว็บ |
|---|---|---|---|
| `UNIQUE` | 2627, 2601 | ดูชื่อ constraint ตามตารางด้านล่าง | ตามตาราง |
| `CHECK_FK` | 547 | ดูชื่อ constraint ตามตารางด้านล่าง | ตามตาราง |
| `NOT_NULL` | 515 | | กรุณากรอกข้อมูลให้ครบ |
| `RULE` | 513 | | เบอร์เสื้อต้องอยู่ระหว่าง 1–99 |
| `PERMISSION` | 229 | | คุณไม่มีสิทธิ์ทำรายการนี้ (Permission denied) |
| `DEADLOCK` | 1205 | | ระบบกำลังทำงานหนัก กรุณาลองใหม่อีกครั้ง |
| `CONNECTION` | รหัส `ELOGIN`, `ESOCKET`, `ETIMEOUT` ของ driver | | เชื่อมต่อฐานข้อมูลไม่ได้ |
| `UNKNOWN` | อื่นๆ | | เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ (รายละเอียดเขียนลง log ฝั่ง server) |

### Error จากชื่อ constraint

| Constraint | ข้อความบนเว็บ |
|---|---|
| `UQ_Users_Username` | ชื่อผู้ใช้นี้ถูกใช้แล้ว |
| `UQ_Seasons_SeasonName` | ชื่อฤดูกาลนี้มีอยู่แล้ว |
| `UX_Seasons_OneActive` | มีฤดูกาลที่กำลังแข่งอยู่แล้ว |
| `UQ_Teams_TeamName` | ชื่อทีมนี้ถูกใช้แล้ว |
| `UQ_Players_Team_Jersey` | เบอร์เสื้อนี้มีผู้เล่นในทีมใช้แล้ว |
| `UQ_Matches_Season_Pair` | คู่แข่งขันนี้มีอยู่ในฤดูกาลแล้ว |
| `CK_Seasons_Dates` | วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น |
| `CK_Players_Position` | ตำแหน่งไม่ถูกต้อง |
| `CK_Matches_DifferentTeams` | ทีมเหย้าและทีมเยือนต้องเป็นคนละทีม |
| `CK_Matches_ScoreNonNegative` | สกอร์ต้องไม่ติดลบ |
| `CK_Matches_FinishedHasScore` | แมตช์ที่จบแล้วต้องมีสกอร์ครบ |
| `CK_MatchEvents_Type` | ชนิดเหตุการณ์ไม่ถูกต้อง |
| `CK_MatchEvents_Minute` | นาทีต้องอยู่ระหว่าง 0–120 |
| `FK_Matches_HomeTeam`, `FK_Matches_AwayTeam` | ทีมนี้ไม่ได้อยู่ในฤดูกาล |
| `FK_Matches_UpdatedBy`, `FK_MatchEvents_Users` | ไม่พบผู้ใช้ที่ทำรายการ กรุณาเข้าสู่ระบบใหม่ |
| `FK_MatchEvents_Players` | ไม่พบนักกีฬา |
| constraint อื่น | ข้อมูลไม่ถูกต้องตามเงื่อนไขของระบบ |

### Error เชิงธุรกิจ

| เลข | ความหมาย | ข้อความบนเว็บ | เกิดจาก |
|---|---|---|---|
| 51001 | ไม่พบแมตช์ | ไม่พบแมตช์นี้ | `usp_RecordMatchResult`, `usp_ClearMatchResult`, `usp_AddMatchEvent` |
| 51002 | `RowVersion` ไม่ตรง | มีผู้อื่นแก้ไขแมตช์นี้ไปแล้ว กรุณาโหลดข้อมูลใหม่ | `usp_RecordMatchResult`, `usp_ClearMatchResult` |
| 51003 | สกอร์ไม่ถูกต้อง | สกอร์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป | `usp_RecordMatchResult` |
| 51004 | แมตช์ยังไม่จบ | ต้องบันทึกผลการแข่งขันก่อนเพิ่มเหตุการณ์ | `usp_AddMatchEvent` |
| 51005 | ไม่พบเหตุการณ์ | ไม่พบเหตุการณ์นี้ | `usp_DeleteMatchEvent` |
| 51006 | แมตช์ไม่มีผล | แมตช์นี้ยังไม่มีผลให้ลบ | `usp_ClearMatchResult` |
| 51007 | ฤดูกาลปิดแล้ว | ฤดูกาลนี้จบแล้ว แก้ไขผลไม่ได้ | `usp_RecordMatchResult`, `usp_ClearMatchResult`, `usp_AddMatchEvent`, `usp_DeleteMatchEvent` |
| 51010 | นักเตะไม่อยู่ในแมตช์ | นักกีฬาต้องอยู่ในทีมเหย้าหรือทีมเยือนของแมตช์นี้ | `trg_MatchEvents_ValidatePlayer` |
| 51020 | ไม่พบฤดูกาล | ไม่พบฤดูกาลนี้ | SP ของฤดูกาล, `usp_RegisterTeam` |
| 51022 | มีตารางแข่งแล้ว | ฤดูกาลนี้สร้างตารางแข่งแล้ว | `usp_GenerateFixtures`, `usp_AddTeamToSeason`, `usp_ApproveTeam` |
| 51023 | ทีมไม่พอ | ต้องมีอย่างน้อย 2 ทีมจึงจะสร้างตารางแข่งได้ | `usp_GenerateFixtures` |
| 51024 | ไม่มีสนาม | ยังไม่มีข้อมูลสนามแข่ง | `usp_GenerateFixtures` |
| 51025 | เปลี่ยนสถานะไม่ได้ | เปลี่ยนสถานะฤดูกาลไม่ได้ในตอนนี้ | `usp_SetSeasonStatus` |
| 51026 | มี Active แล้ว | มีฤดูกาลที่กำลังแข่งอยู่แล้ว | `usp_SetSeasonStatus` |
| 51027 | ไม่ใช่ Upcoming | ทำรายการนี้ได้เฉพาะฤดูกาลที่ยังไม่เริ่ม | `usp_RegisterTeam`, `usp_ApproveTeam`, `usp_AddTeamToSeason`, `usp_GenerateFixtures` |
| 51030 | ไม่พบทีม | ไม่พบทีมนี้ | `usp_ApproveTeam`, `usp_AddTeamToSeason`, `usp_RegisterPlayer` |
| 51031 | พิจารณาแล้ว | ทีมนี้ได้รับการพิจารณาแล้ว | `usp_ApproveTeam` |
| 51032 | เกินโควตา | คุณมีทีมครบจำนวนที่กำหนดแล้ว (สูงสุด 3 ทีม) | `trg_Teams_LimitPerUser` |
| 51033 | ไม่ใช่เจ้าของทีม | คุณเพิ่มนักกีฬาได้เฉพาะทีมของตัวเอง | `usp_RegisterPlayer` |
| 51034 | ทีมยังไม่อนุมัติ | ทีมนี้ยังไม่ได้รับการอนุมัติ | `usp_RegisterPlayer`, `usp_AddTeamToSeason` |
| 51035 | ทีมอยู่ในฤดูกาลแล้ว | ทีมนี้อยู่ในฤดูกาลแล้ว | `usp_AddTeamToSeason` |
| 51040 | ข้อมูลนักกีฬาผิด | ข้อมูลนักกีฬาไม่ถูกต้อง เบอร์เสื้อต้องอยู่ระหว่าง 1–99 | `usp_RegisterPlayer` |
| 51050 | ข้อมูลสมัครผิด | กรุณากรอกชื่อผู้ใช้และชื่อที่แสดง | `usp_RegisterUser` |

## 3. View

ทุกตัวให้เรียงตาม "การเรียงของเว็บ" ไม่ต้องเรียงใน view

### vw_LeagueTable

ตารางคะแนนหนึ่งแถวต่อทีมต่อฤดูกาล

- **หน้าที่ใช้:** ตารางคะแนน `/standings`, หน้าแรก (จ่าฝูง), หน้าทีม
- **Repository:** `standings.getLeagueTable(ctx, seasonId)`
- **การเรียกของเว็บ:** `WHERE SeasonID = @SeasonID`
- **การเรียงของเว็บ:** `RankNo, TeamName`

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `SeasonID` | `INT` | |
| `TeamID` | `INT` | |
| `TeamName` | `NVARCHAR(100)` | |
| `ShortName` | `NVARCHAR(10)` | |
| `LogoUrl` | `NVARCHAR(300)` | NULL ได้ |
| `RankNo` | `BIGINT` | `RANK()` ภายในฤดูกาล เรียง `Points` มากไปน้อย, `GD` มากไปน้อย, `GF` มากไปน้อย |
| `Played`, `Won`, `Drawn`, `Lost`, `GF`, `GA`, `GD`, `Points` | `INT` | จาก `Standings` |
| `Form` | `VARCHAR(5)` | จาก `fn_TeamForm` |
| `ZoneName` | `NVARCHAR(50)` | จาก `SeasonZones` ตาม `RankNo`, NULL ถ้าไม่อยู่ในโซน |
| `ColorHex` | `CHAR(7)` | NULL ถ้าไม่อยู่ในโซน |

### vw_UpcomingMatches

แมตช์ `Scheduled` ของฤดูกาล `Active` ไม่กรองด้วยเวลาปัจจุบัน เพื่อให้ข้อมูลตัวอย่างแสดงผลได้ทุกเมื่อ

- **หน้าที่ใช้:** หน้าแรก
- **Repository:** `matches.listUpcoming(ctx, limit)`
- **การเรียกของเว็บ:** `SELECT TOP (@Limit)`
- **การเรียงของเว็บ:** `KickoffAt, MatchID`

| คอลัมน์ | ชนิด |
|---|---|
| `MatchID`, `SeasonID`, `RoundNo` | `INT` |
| `KickoffAt` | `DATETIME2(0)` |
| `HomeTeamID`, `AwayTeamID` | `INT` |
| `HomeTeamName`, `AwayTeamName` | `NVARCHAR(100)` |
| `HomeLogoUrl`, `AwayLogoUrl` | `NVARCHAR(300)` |
| `VenueName` | `NVARCHAR(100)` |

### vw_TopScorers

นับเฉพาะ `Goal` ของแมตช์ `Finished` มีเฉพาะนักเตะที่ทำประตูอย่างน้อย 1 ลูก

- **หน้าที่ใช้:** ดาวซัลโว `/top-scorers`
- **Repository:** `standings.getTopScorers(ctx, seasonId)`
- **การเรียกของเว็บ:** `WHERE SeasonID = @SeasonID`
- **การเรียงของเว็บ:** `RankNo, Nickname`

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `SeasonID`, `PlayerID`, `TeamID` | `INT` | |
| `Nickname` | `NVARCHAR(50)` | |
| `JerseyNo` | `TINYINT` | |
| `TeamName` | `NVARCHAR(100)` | |
| `LogoUrl` | `NVARCHAR(300)` | |
| `Goals` | `INT` | |
| `RankNo` | `BIGINT` | `RANK()` ภายในฤดูกาล เรียง `Goals` มากไปน้อย |

### vw_TeamRoster

- **หน้าที่ใช้:** หน้าทีม `/teams/:id`, หน้าเพิ่มนักกีฬา, ฟอร์มเหตุการณ์ของ referee
- **Repository:** `teams.getRoster(ctx, teamId)`
- **การเรียกของเว็บ:** `WHERE TeamID = @TeamID`
- **การเรียงของเว็บ:** `JerseyNo`

| คอลัมน์ | ชนิด |
|---|---|
| `TeamID`, `PlayerID` | `INT` |
| `TeamName` | `NVARCHAR(100)` |
| `JerseyNo` | `TINYINT` |
| `Nickname` | `NVARCHAR(50)` |
| `Position` | `VARCHAR(2)` |

### vw_MatchList

ทุกแมตช์พร้อมชื่อทีมและสนาม

- **หน้าที่ใช้:** โปรแกรม/ผลแข่ง `/matches`, รายละเอียดแมตช์, หน้าทีม, หน้าแรก (ผลล่าสุด), หน้า referee
- **Repository:** `matches.listMatches(ctx, filters)`, `matches.getMatch(ctx, matchId)`, `matches.listRecent(ctx, limit)`
- **การเรียกของเว็บ:** `WHERE` ตามตัวกรอง `SeasonID`, `RoundNo`, `Status`, ทีม หรือ `MatchID`
- **การเรียงของเว็บ:** รายการโปรแกรม `RoundNo, KickoffAt, MatchID` ส่วนผลล่าสุด `KickoffAt DESC, MatchID DESC`

| คอลัมน์ | ชนิด |
|---|---|
| `MatchID`, `SeasonID`, `RoundNo` | `INT` |
| `SeasonName` | `NVARCHAR(100)` |
| `SeasonStatus` | `VARCHAR(20)` |
| `KickoffAt` | `DATETIME2(0)` |
| `Status` | `VARCHAR(20)` |
| `HomeTeamID`, `AwayTeamID` | `INT` |
| `HomeTeamName`, `AwayTeamName` | `NVARCHAR(100)` |
| `HomeLogoUrl`, `AwayLogoUrl` | `NVARCHAR(300)` |
| `HomeScore`, `AwayScore` | `INT` (NULL ได้) |
| `VenueID` | `INT` (NULL ได้) |
| `VenueName` | `NVARCHAR(100)` (NULL ได้) |
| `RowVersion` | `BINARY(8)` |
| `UpdatedAt` | `DATETIME2(0)` |

### vw_MatchEventDetails

- **หน้าที่ใช้:** รายละเอียดแมตช์, หน้ากรอกผลของ referee
- **Repository:** `matches.listEvents(ctx, matchId)`
- **การเรียกของเว็บ:** `WHERE MatchID = @MatchID`
- **การเรียงของเว็บ:** `Minute, EventID`

| คอลัมน์ | ชนิด |
|---|---|
| `EventID`, `MatchID`, `PlayerID`, `TeamID` | `INT` |
| `Minute` | `INT` |
| `EventType` | `VARCHAR(10)` |
| `Nickname` | `NVARCHAR(50)` |
| `JerseyNo` | `TINYINT` |
| `TeamName` | `NVARCHAR(100)` |

### vw_TeamList

ทุกทีมทุกสถานะ เว็บกรองเอง หน้าสาธารณะแสดงเฉพาะ `Approved`

- **หน้าที่ใช้:** รายชื่อทีม, หน้าทีม, ทีมของ manager, อนุมัติทีม, เพิ่มทีมเข้าฤดูกาล
- **Repository:** `teams.listTeams(ctx, filters)`, `teams.getTeam(ctx, teamId)`
- **การเรียกของเว็บ:** `WHERE` ตามตัวกรอง `Status`, `CreatedBy` หรือ `TeamID`
- **การเรียงของเว็บ:** `TeamName`

| คอลัมน์ | ชนิด |
|---|---|
| `TeamID`, `CreatedBy`, `RequestedSeasonID` | `INT` |
| `TeamName` | `NVARCHAR(100)` |
| `ShortName` | `NVARCHAR(10)` |
| `LogoUrl` | `NVARCHAR(300)` |
| `Status` | `VARCHAR(10)` |
| `CreatedByUsername` | `NVARCHAR(50)` |
| `RequestedSeasonName` | `NVARCHAR(100)` |
| `PlayerCount` | `INT` |
| `CreatedAt` | `DATETIME2(0)` |

### vw_SeasonList

- **หน้าที่ใช้:** dropdown เลือกฤดูกาลทุกหน้า, สมัครทีม, จัดการฤดูกาล
- **Repository:** `seasons.listSeasons(ctx)`
- **การเรียงของเว็บ:** `StartDate DESC`

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `SeasonID` | `INT` | |
| `SeasonName` | `NVARCHAR(100)` | |
| `StartDate`, `EndDate` | `DATE` | |
| `Status` | `VARCHAR(20)` | |
| `TeamCount` | `INT` | จำนวนทีมใน `SeasonTeams` |
| `MatchCount` | `INT` | จำนวนแมตช์ทั้งหมด |
| `FinishedCount` | `INT` | จำนวนแมตช์ที่จบแล้ว |

### vw_ScoreAudit

เฉพาะ `role_admin`

- **หน้าที่ใช้:** ประวัติการแก้สกอร์ `/admin/audit`
- **Repository:** `admin.listScoreAudit(ctx)`
- **การเรียงของเว็บ:** `ChangedAt DESC, AuditID DESC`

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `AuditID`, `MatchID` | `INT` | |
| `HomeTeamName`, `AwayTeamName` | `NVARCHAR(100)` | NULL ถ้าแมตช์ถูกลบ |
| `OldHomeScore`, `OldAwayScore`, `NewHomeScore`, `NewAwayScore` | `INT` | NULL ได้ |
| `ChangeType` | `VARCHAR(10)` | |
| `ChangedBy` | `INT` | NULL ได้ |
| `ChangedByUsername` | `NVARCHAR(50)` | NULL ได้ |
| `ChangedByLogin` | `NVARCHAR(128)` | |
| `ChangedAt` | `DATETIME2(0)` | |

### vw_Notifications

- **หน้าที่ใช้:** หน้าแรก, ดูการแจ้งเตือน `/admin/notifications`
- **Repository:** `notifications.listNotifications(ctx, limit)`
- **การเรียงของเว็บ:** `CreatedAt DESC, NotificationID DESC`

| คอลัมน์ | ชนิด |
|---|---|
| `NotificationID` | `INT` |
| `MatchID` | `INT` (NULL ได้) |
| `Type` | `VARCHAR(20)` |
| `Message` | `NVARCHAR(300)` |
| `CreatedAt` | `DATETIME2(0)` |

## 4. Function

### fn_CalcPoints

- **ลายเซ็น:** `dbo.fn_CalcPoints(@gf INT, @ga INT) RETURNS INT`
- **ผู้เรียก:** `trg_Matches_UpdateStandings` เว็บไม่เรียกตรง

### fn_TeamForm

- **ลายเซ็น:** `dbo.fn_TeamForm(@SeasonID INT, @TeamID INT) RETURNS VARCHAR(5)`
- **ผู้เรียก:** `vw_LeagueTable` คอลัมน์ `Form` เว็บไม่เรียกตรง

### fn_HeadToHead

- **ลายเซ็น:** `dbo.fn_HeadToHead(@TeamA INT, @TeamB INT)` table-valued
- **หน้าที่ใช้:** รายละเอียดแมตช์ `/matches/:id`
- **Repository:** `matches.getHeadToHead(ctx, teamA, teamB)`
- **การเรียกของเว็บ:** `SELECT ... FROM dbo.fn_HeadToHead(@TeamA, @TeamB)`
- **การเรียงของเว็บ:** `KickoffAt DESC, MatchID DESC`

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `MatchID`, `SeasonID` | `INT` | |
| `SeasonName` | `NVARCHAR(100)` | |
| `KickoffAt` | `DATETIME2(0)` | |
| `HomeTeamID`, `AwayTeamID` | `INT` | |
| `HomeTeamName`, `AwayTeamName` | `NVARCHAR(100)` | |
| `HomeScore`, `AwayScore` | `INT` | |
| `WinnerTeamID` | `INT` | NULL เมื่อเสมอ |

## 5. Stored Procedure

ทุกตัวเรียกด้วย `request.execute()` คอลัมน์ "Error" คือเลขที่ SP ต้อง THROW ตามหัวข้อ 2 นอกจากนี้ error จาก constraint และ trigger ให้ส่งผ่านตามเดิม

### usp_RecordMatchResult

บันทึกหรือแก้ผล ต้องใช้ TRANSACTION + TRY/CATCH

- **หน้าที่ใช้:** กรอกผล `/referee/matches/:id`
- **Repository:** `matches.recordResult(ctx, { matchId, homeScore, awayScore, rowVersion })`
- **สิทธิ์:** `role_referee`

| พารามิเตอร์ | ชนิด |
|---|---|
| `@MatchID` | `INT` |
| `@HomeScore` | `INT` |
| `@AwayScore` | `INT` |
| `@RowVersion` | `BINARY(8)` |
| `@UpdatedBy` | `INT` |

**ลำดับการทำงาน**

1. ตรวจว่าแมตช์มีอยู่ (51001) ฤดูกาลไม่ใช่ `Finished` (51007) และสกอร์ไม่เป็น NULL หรือติดลบ (51003)
2. ตรวจ `@RowVersion` กับค่าปัจจุบันภายใน transaction โดยล็อกแถวไว้ ถ้าไม่ตรงให้ THROW 51002 การเทียบต้องไม่มีช่องว่างให้คำขอสองคำขอผ่านพร้อมกัน
3. ตั้ง `HomeScore`, `AwayScore`, `Status = 'Finished'`, `UpdatedBy`, `UpdatedAt`
4. ถ้าเป็นการกรอกครั้งแรก เพิ่ม `Notifications` ชนิด `MatchFinished` ถ้าเป็นการแก้และสกอร์เปลี่ยนจริง ใช้ชนิด `ResultCorrected` ถ้าสกอร์เท่าเดิมไม่ต้องเพิ่ม
5. COMMIT แล้วคืนผล

**คืนค่า 1 แถว:** `MatchID INT`, `HomeScore INT`, `AwayScore INT`, `Status VARCHAR(20)`, `RowVersion BINARY(8)`

**ข้อความแจ้งเตือน:** `จบการแข่งขัน: {ทีมเหย้า} {สกอร์}-{สกอร์} {ทีมเยือน}` หรือ `แก้ไขผล: {ทีมเหย้า} {สกอร์}-{สกอร์} {ทีมเยือน}`

**Error:** 51001, 51002, 51003, 51007

### usp_ClearMatchResult

ลบผลของแมตช์ แมตช์กลับเป็น `Scheduled` ต้องใช้ TRANSACTION + TRY/CATCH

- **หน้าที่ใช้:** กรอกผล `/referee/matches/:id`
- **Repository:** `matches.clearResult(ctx, { matchId, rowVersion })`
- **สิทธิ์:** `role_referee`
- **พารามิเตอร์:** `@MatchID INT`, `@RowVersion BINARY(8)`, `@UpdatedBy INT`
- **พฤติกรรม:** ลบ `MatchEvents` ของแมตช์ แล้วตั้งสกอร์เป็น NULL, `Status = 'Scheduled'`, `UpdatedBy`, `UpdatedAt` ไม่สร้างแจ้งเตือน
- **คืนค่า 1 แถว:** `MatchID INT`, `Status VARCHAR(20)`, `RowVersion BINARY(8)`
- **Error:** 51001, 51002, 51006, 51007

### usp_AddMatchEvent

- **หน้าที่ใช้:** กรอกเหตุการณ์ `/referee/matches/:id`
- **Repository:** `matches.addEvent(ctx, { matchId, playerId, eventType, minute })`
- **สิทธิ์:** `role_referee`
- **พารามิเตอร์:** `@MatchID INT`, `@PlayerID INT`, `@EventType VARCHAR(10)`, `@Minute INT`, `@CreatedBy INT`
- **พฤติกรรม:** เพิ่มได้เฉพาะแมตช์ `Finished` ค่า `@Minute` นอกช่วงให้ `CK_MatchEvents_Minute` เป็นผู้ปฏิเสธด้วย error 547
- **คืนค่า 1 แถว:** `EventID INT`
- **Error:** 51001, 51004, 51007 รวมถึง 51010 จาก trigger และ 547 จาก CHECK

### usp_DeleteMatchEvent

- **หน้าที่ใช้:** กรอกเหตุการณ์ `/referee/matches/:id`
- **Repository:** `matches.deleteEvent(ctx, eventId)`
- **สิทธิ์:** `role_referee`
- **พารามิเตอร์:** `@EventID INT`
- **คืนค่า:** ไม่มี
- **Error:** 51005, 51007

### usp_GenerateFixtures

สร้างตารางแข่งแบบพบกันหมดเหย้า-เยือน ต้องใช้ TRANSACTION + TRY/CATCH

- **หน้าที่ใช้:** ปุ่ม "สร้างตารางแข่ง" `/admin/seasons`
- **Repository:** `seasons.generateFixtures(ctx, seasonId)`
- **สิทธิ์:** `role_admin`
- **พารามิเตอร์:** `@SeasonID INT`

**พฤติกรรม**

- ทำได้เฉพาะฤดูกาล `Upcoming` ที่ยังไม่มีแมตช์ และมีอย่างน้อย 2 ทีม
- ทุกคู่พบกันเหย้า 1 ครั้ง เยือน 1 ครั้ง ครึ่งหลังของตารางสลับเหย้า-เยือนจากครึ่งแรก
- ทีมจำนวน N คู่ ใช้ `2(N-1)` รอบ รอบละ `N/2` แมตช์ ทีมจำนวนคี่ใช้ `2N` รอบ และมีหนึ่งทีมได้พักในแต่ละรอบ
- ทีมหนึ่งแข่งได้ไม่เกิน 1 นัดต่อรอบ
- รอบ R เริ่มวันที่ `StartDate + 7*(R-1)` เวลา 15:00 แมตช์ถัดไปในรอบเดียวกันห่างกัน 2 ชั่วโมง
- ใช้ `Venues` วนตามลำดับ `VenueID`

**คืนค่า 1 แถว:** `MatchesCreated INT`, `Rounds INT`

**Error:** 51020, 51022, 51023, 51024, 51027

### usp_CreateSeason

- **หน้าที่ใช้:** จัดการฤดูกาล `/admin/seasons`
- **Repository:** `seasons.createSeason(ctx, { seasonName, startDate, endDate })`
- **สิทธิ์:** `role_admin`
- **พารามิเตอร์:** `@SeasonName NVARCHAR(100)`, `@StartDate DATE`, `@EndDate DATE`
- **พฤติกรรม:** สร้างสถานะ `Upcoming` และคัดลอก `SeasonZones` จากฤดูกาลที่ `StartDate` ล่าสุด ถ้าไม่มีฤดูกาลก่อนหน้าก็ไม่มีโซน
- **คืนค่า 1 แถว:** `SeasonID INT`
- **Error:** 547 `CK_Seasons_Dates`, 2627 `UQ_Seasons_SeasonName`

### usp_SetSeasonStatus

- **หน้าที่ใช้:** จัดการฤดูกาล `/admin/seasons`
- **Repository:** `seasons.setSeasonStatus(ctx, { seasonId, status })`
- **สิทธิ์:** `role_admin`
- **พารามิเตอร์:** `@SeasonID INT`, `@Status VARCHAR(20)`
- **พฤติกรรม:** เปลี่ยนได้ 2 ทางเท่านั้น คือ `Upcoming → Active` (ต้องมีแมตช์แล้ว และไม่มีฤดูกาล Active อื่น) และ `Active → Finished` (ทุกแมตช์ต้อง `Finished`)
- **คืนค่า:** ไม่มี
- **Error:** 51020, 51025, 51026

### usp_AddTeamToSeason

เพิ่มทีมที่อนุมัติแล้วเข้าฤดูกาลใหม่ โดยไม่ต้องสมัครซ้ำ

- **หน้าที่ใช้:** จัดการฤดูกาล `/admin/seasons`
- **Repository:** `seasons.addTeamToSeason(ctx, { seasonId, teamId })`
- **สิทธิ์:** `role_admin`
- **พารามิเตอร์:** `@SeasonID INT`, `@TeamID INT`
- **พฤติกรรม:** ฤดูกาลต้องเป็น `Upcoming` และยังไม่มีแมตช์ เพิ่ม `SeasonTeams` พร้อมแถวศูนย์ใน `Standings`
- **คืนค่า:** ไม่มี
- **Error:** 51020, 51022, 51027, 51030, 51034, 51035

### usp_RegisterTeam

- **หน้าที่ใช้:** สมัครทีม `/manager/teams/new`
- **Repository:** `teams.registerTeam(ctx, { teamName, shortName, logoUrl, requestedSeasonId })`
- **สิทธิ์:** `role_team_manager`
- **พารามิเตอร์:** `@TeamName NVARCHAR(100)`, `@ShortName NVARCHAR(10)`, `@LogoUrl NVARCHAR(300)`, `@RequestedSeasonID INT`, `@CreatedBy INT`
- **พฤติกรรม:** ฤดูกาลต้องเป็น `Upcoming` สร้างทีมสถานะ `Pending` เสมอ
- **คืนค่า 1 แถว:** `TeamID INT`
- **Error:** 51020, 51027 รวมถึง 51032 จาก trigger และ 2627 `UQ_Teams_TeamName`

### usp_ApproveTeam

- **หน้าที่ใช้:** อนุมัติทีม `/admin/teams`
- **Repository:** `teams.reviewTeam(ctx, { teamId, approve })`
- **สิทธิ์:** `role_admin`
- **พารามิเตอร์:** `@TeamID INT`, `@Approve BIT`, `@ReviewedBy INT`
- **พฤติกรรม:** ทีมต้องเป็น `Pending` `@Approve = 1` ตั้ง `Approved` แล้ว `trg_Teams_Approved` เพิ่มเข้าฤดูกาล `@Approve = 0` ตั้ง `Rejected` ตั้ง `ReviewedBy`, `ReviewedAt` ทั้งสองกรณี การอนุมัติต้องตรวจว่าฤดูกาลเป็น `Upcoming` และยังไม่มีแมตช์ ส่วนการปฏิเสธทำได้เสมอ
- **คืนค่า:** ไม่มี
- **Error:** 51022, 51027, 51030, 51031

### usp_RegisterPlayer

- **หน้าที่ใช้:** เพิ่มนักกีฬา `/manager/teams/:id/players`
- **Repository:** `teams.registerPlayer(ctx, { teamId, nickname, position, jerseyNo })`
- **สิทธิ์:** `role_team_manager`
- **พารามิเตอร์:** `@TeamID INT`, `@Nickname NVARCHAR(50)`, `@Position VARCHAR(2)`, `@JerseyNo INT`, `@UserID INT`
- **พฤติกรรม:** ทีมต้องมีอยู่ เป็นของ `@UserID` (`Teams.CreatedBy`) และ `Approved` `@JerseyNo` รับเป็น `INT` ตรวจช่วง 1–99 ใน SP ถ้าผิด หรือชื่อเล่นว่าง ให้ THROW 51040
- **คืนค่า 1 แถว:** `PlayerID INT`
- **Error:** 51030, 51033, 51034, 51040 รวมถึง 2627 `UQ_Players_Team_Jersey`, 547 `CK_Players_Position`

### usp_SearchPlayers

- **หน้าที่ใช้:** ค้นหานักเตะ `/players/search`
- **Repository:** `teams.searchPlayers(ctx, keyword)`
- **สิทธิ์:** ทุก role
- **พารามิเตอร์:** `@Keyword NVARCHAR(50)`
- **พฤติกรรม:** ค้น `Nickname` แบบบางส่วนของคำ เฉพาะทีม `Approved` คำว่างคืนผลว่าง ห้ามใช้ dynamic SQL ที่ต่อสตริงจาก `@Keyword`
- **คืนค่าหลายแถว:** `PlayerID INT`, `Nickname NVARCHAR(50)`, `Position VARCHAR(2)`, `JerseyNo TINYINT`, `TeamID INT`, `TeamName NVARCHAR(100)`, `LogoUrl NVARCHAR(300)` เรียงตาม `Nickname`

### usp_GetUserForLogin

- **หน้าที่ใช้:** เข้าสู่ระบบ `/login` ใช้ pool `lb_viewer` เพราะยังไม่รู้ role
- **Repository:** `users.findForLogin(ctx, username)`
- **สิทธิ์:** ทุก role
- **พารามิเตอร์:** `@Username NVARCHAR(50)`
- **คืนค่า 0 หรือ 1 แถว:** `UserID INT`, `Username NVARCHAR(50)`, `PasswordHash CHAR(60)`, `DisplayName NVARCHAR(100)`, `Role VARCHAR(20)`
- **Error:** ไม่มี ถ้าไม่พบให้คืนผลว่าง เว็บตรวจรหัสผ่านด้วย bcrypt เอง

### usp_RegisterUser

- **หน้าที่ใช้:** สมัครสมาชิก `/register`
- **Repository:** `users.register(ctx, { username, passwordHash, displayName })`
- **สิทธิ์:** ทุก role
- **พารามิเตอร์:** `@Username NVARCHAR(50)`, `@PasswordHash CHAR(60)`, `@DisplayName NVARCHAR(100)`
- **พฤติกรรม:** สร้าง role `team_manager` เสมอ ไม่มีพารามิเตอร์ role เพื่อไม่ให้สมัครเป็น admin หรือ referee ได้ ชื่อผู้ใช้หรือชื่อที่แสดงว่างให้ THROW 51050
- **คืนค่า 1 แถว:** `UserID INT`
- **Error:** 51050, 2627 `UQ_Users_Username`

## 6. โครงสร้าง Repository

`repositories/mock/` และ `repositories/mssql/` ต้องมีฟังก์ชันชื่อเดียวกันทุกตัว

| โมดูล | ฟังก์ชัน |
|---|---|
| `seasons` | `listSeasons`, `createSeason`, `setSeasonStatus`, `generateFixtures`, `addTeamToSeason` |
| `standings` | `getLeagueTable`, `getTopScorers` |
| `matches` | `listMatches`, `getMatch`, `listRecent`, `listUpcoming`, `getHeadToHead`, `listEvents`, `recordResult`, `clearResult`, `addEvent`, `deleteEvent` |
| `teams` | `listTeams`, `getTeam`, `getRoster`, `searchPlayers`, `registerTeam`, `reviewTeam`, `registerPlayer` |
| `users` | `findForLogin`, `register` |
| `notifications` | `listNotifications` |
| `admin` | `listScoreAudit` |
| `system` | `checkDatabase` อ่าน metadata ผ่าน `lb_checker` ใช้กับหน้า `/db-check` |

ชื่อคอลัมน์ทั้งหมดของเว็บรวมอยู่ที่ `repositories/mssql/contract.js` ถ้าแก้ contract ต้องแก้ไฟล์นี้และโหมด mock พร้อมกัน แล้วรัน `npm test`

## 7. Mock Data

`mock-data/` มีไฟล์ละตาราง ใช้ชื่อตารางเป็นชื่อไฟล์ เช่น `Teams.json`, `SeasonTeams.json` แต่ละแถวใช้ชื่อคอลัมน์ตาม `db_design.md` ทุกตัวอักษร

- ผลลัพธ์ของ repository โหมด mock ต้องมีชื่อคอลัมน์เหมือนผลลัพธ์ของ view ในเอกสารนี้
- `GD` ไม่เก็บใน JSON เพราะเป็น computed column โหมด mock คำนวณเอง
- `RowVersion` ในโหมด mock เป็น hex ความยาว 16 ตัวอักษร และเปลี่ยนทุกครั้งที่แมตช์ถูกแก้
- `PasswordHash` เป็น bcrypt hash จริง รหัสผ่านทดสอบอยู่ใน `README.md` คัดลอกค่าไปใส่ `08_sample_data.sql` ได้เลย
- ข้อมูลมี 3 ฤดูกาล: ฤดูกาลที่จบแล้ว ฤดูกาลปัจจุบันที่แข่งไปครึ่งทาง และฤดูกาล `Upcoming` สำหรับเดโมการสมัครทีมและสร้างตารางแข่ง
