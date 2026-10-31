# LeagueBoard — การใช้งาน Database Object ในระบบ

ทุก object ในฐานข้อมูลต้องถูกใช้จริง ตารางนี้ใช้ตรวจสอบและอ้างอิงในเล่มรายงาน รหัส T-xx คือกรณีทดสอบใน `db_design.md` หัวข้อ 9

ไฟล์ repository ระบุแบบ `repositories/mssql/<โมดูล>.js` โหมด mock มีฟังก์ชันชื่อเดียวกันใน `repositories/mock/` ชื่อไฟล์ route เป็นแผนจากเฟส 2–5 ถ้าเปลี่ยนต้องแก้ตารางนี้ด้วย

## View

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `vw_LeagueTable` | View | ตารางคะแนน อันดับ Form โซนสี | `/standings`, `/`, `/teams/:id` — `routes/public.js`, `repositories/mssql/standings.js` | เปิดหน้าตารางคะแนน เทียบกับ T-40, T-46 |
| `vw_UpcomingMatches` | View | แมตช์ถัดไป | `/` — `routes/public.js`, `repositories/mssql/matches.js` | เปิดหน้าแรก เทียบกับ T-47 |
| `vw_TopScorers` | View | อันดับดาวซัลโว | `/top-scorers` — `routes/public.js`, `repositories/mssql/standings.js` | เปิดหน้าดาวซัลโว เทียบกับ T-45 |
| `vw_TeamRoster` | View | รายชื่อนักเตะในทีม | `/teams/:id`, `/manager/teams/:id/players`, `/referee/matches/:id` — `routes/public.js`, `routes/manager.js`, `routes/referee.js`, `repositories/mssql/teams.js` | เปิดหน้าทีม จำนวนนักเตะตรงกับ `Players` |
| `vw_MatchList` | View | รายการแมตช์พร้อมชื่อทีม | `/matches`, `/matches/:id`, `/teams/:id`, `/`, `/referee` — `routes/public.js`, `routes/referee.js`, `repositories/mssql/matches.js` | กรองฤดูกาลและรอบบนหน้าโปรแกรม |
| `vw_MatchEventDetails` | View | เหตุการณ์ในแมตช์ | `/matches/:id`, `/referee/matches/:id` — `routes/public.js`, `routes/referee.js`, `repositories/mssql/matches.js` | เพิ่มเหตุการณ์แล้วดูหน้ารายละเอียดแมตช์ |
| `vw_TeamList` | View | รายชื่อทีมทุกสถานะ | `/teams`, `/teams/:id`, `/manager`, `/admin/teams`, `/admin/seasons` — `routes/public.js`, `routes/manager.js`, `routes/admin.js`, `repositories/mssql/teams.js` | สมัครทีมแล้วเห็นในหน้าอนุมัติ แต่ไม่เห็นในหน้าสาธารณะ |
| `vw_SeasonList` | View | ฤดูกาลและจำนวนสรุป | dropdown ทุกหน้า, `/manager/teams/new`, `/admin/seasons` — `routes/public.js`, `routes/manager.js`, `routes/admin.js`, `repositories/mssql/seasons.js` | เปลี่ยนฤดูกาลใน dropdown แล้วข้อมูลเปลี่ยน |
| `vw_ScoreAudit` | View | ประวัติการแก้สกอร์ | `/admin/audit` — `routes/admin.js`, `repositories/mssql/admin.js` | แก้สกอร์แล้วดูหน้า audit, T-78, T-79 |
| `vw_Notifications` | View | การแจ้งเตือน | `/`, `/admin/notifications` — `routes/public.js`, `routes/admin.js`, `repositories/mssql/notifications.js` | บันทึกผลแล้วเห็นการแจ้งเตือนบนหน้าแรก |

## Function

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `fn_CalcPoints` | Scalar function | คำนวณแต้มจากประตูได้และเสีย | `trg_Matches_UpdateStandings` แสดงผลที่ `/standings` | T-43, T-20, T-21 |
| `fn_TeamForm` | Scalar function | ผล 5 นัดล่าสุด | `vw_LeagueTable` แสดงผลที่ `/standings` | T-41, T-42 |
| `fn_HeadToHead` | Table-valued function | สถิติพบกันระหว่างสองทีม | `/matches/:id` — `routes/public.js`, `repositories/mssql/matches.js` | T-44 และเปิดหน้ารายละเอียดแมตช์ |

## Stored Procedure

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `usp_RecordMatchResult` | SP | บันทึกหรือแก้ผล | `/referee/matches/:id` — `routes/referee.js`, `repositories/mssql/matches.js` | T-50 ถึง T-55 |
| `usp_ClearMatchResult` | SP | ลบผลแมตช์ | `/referee/matches/:id` — `routes/referee.js`, `repositories/mssql/matches.js` | T-67 |
| `usp_AddMatchEvent` | SP | เพิ่มเหตุการณ์ | `/referee/matches/:id` — `routes/referee.js`, `repositories/mssql/matches.js` | T-29, T-66 |
| `usp_DeleteMatchEvent` | SP | ลบเหตุการณ์ | `/referee/matches/:id` — `routes/referee.js`, `repositories/mssql/matches.js` | ลบเหตุการณ์แล้วจำนวนประตูในดาวซัลโวลดลง |
| `usp_GenerateFixtures` | SP | สร้างตารางแข่งพบกันหมด | `/admin/seasons` — `routes/admin.js`, `repositories/mssql/seasons.js` | T-56 ถึง T-59 |
| `usp_CreateSeason` | SP | สร้างฤดูกาล | `/admin/seasons` — `routes/admin.js`, `repositories/mssql/seasons.js` | T-68 |
| `usp_SetSeasonStatus` | SP | เปิดหรือปิดฤดูกาล | `/admin/seasons` — `routes/admin.js`, `repositories/mssql/seasons.js` | T-64, T-65 |
| `usp_AddTeamToSeason` | SP | เพิ่มทีมเดิมเข้าฤดูกาล | `/admin/seasons` — `routes/admin.js`, `repositories/mssql/seasons.js` | เพิ่มทีมแล้ว `TeamCount` เพิ่มขึ้น และเพิ่มซ้ำแล้วได้ 51035 |
| `usp_RegisterTeam` | SP | สมัครทีมสถานะรออนุมัติ | `/manager/teams/new` — `routes/manager.js`, `repositories/mssql/teams.js` | สมัครทีมแล้วได้ `Pending`, T-33 |
| `usp_ApproveTeam` | SP | อนุมัติหรือปฏิเสธทีม | `/admin/teams` — `routes/admin.js`, `repositories/mssql/teams.js` | T-31, T-63 |
| `usp_RegisterPlayer` | SP | เพิ่มนักกีฬาในทีมตัวเอง | `/manager/teams/:id/players` — `routes/manager.js`, `repositories/mssql/teams.js` | T-60 ถึง T-62 |
| `usp_SearchPlayers` | SP | ค้นหานักเตะ | `/players/search` — `routes/public.js`, `repositories/mssql/teams.js` | T-69 |
| `usp_GetUserForLogin` | SP | อ่านข้อมูลผู้ใช้ตอน login | `/login` — `routes/auth.js`, `repositories/mssql/users.js` | login สำเร็จ, T-73 |
| `usp_RegisterUser` | SP | สมัครสมาชิก | `/register` — `routes/auth.js`, `repositories/mssql/users.js` | สมัครด้วยชื่อซ้ำแล้วเห็นข้อความไทย |

## Trigger

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `trg_Matches_UpdateStandings` | Trigger AFTER INSERT, UPDATE, DELETE | คำนวณตารางคะแนนใหม่ทั้งฤดูกาล | ทำงานเมื่อ `usp_RecordMatchResult`, `usp_ClearMatchResult`, `usp_GenerateFixtures` แก้ `Matches` | T-20 ถึง T-26 |
| `trg_Matches_AuditScore` | Trigger AFTER UPDATE, DELETE | บันทึกประวัติการแก้สกอร์ | ทำงานเมื่อ `usp_RecordMatchResult`, `usp_ClearMatchResult` แก้สกอร์ แสดงที่ `/admin/audit` | T-24, T-27, T-28 |
| `trg_MatchEvents_ValidatePlayer` | Trigger AFTER INSERT, UPDATE | นักเตะต้องอยู่ในทีมของแมตช์ | ทำงานเมื่อ `usp_AddMatchEvent` | T-29, T-30 |
| `trg_Teams_Approved` | Trigger AFTER UPDATE | เพิ่มทีมที่อนุมัติเข้าฤดูกาล | ทำงานเมื่อ `usp_ApproveTeam` | T-31, T-32 |
| `trg_Teams_LimitPerUser` | Trigger AFTER INSERT | จำกัดจำนวนทีมต่อผู้ใช้ | ทำงานเมื่อ `usp_RegisterTeam` | T-33, T-34 |

## Type, Rule และ Default

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `JerseyNumber` | User-Defined Type | ชนิดของ `Players.JerseyNo` | `usp_RegisterPlayer` | T-02 |
| `rule_JerseyNumber` | Rule | จำกัดเบอร์ 1–99 | `Players.JerseyNo` | T-02 |
| `MatchStatusType` | User-Defined Type | ชนิดของ `Matches.Status` | `usp_GenerateFixtures` | T-08 |
| `dft_MatchStatus` | Default | ค่าเริ่มต้น `Scheduled` | `usp_GenerateFixtures` ไม่ต้องระบุ `Status` | T-08 |

## Security

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| `role_viewer` / `lb_viewer` | Role / Login | ผู้เข้าชมที่ยังไม่ login | ทุกหน้าสาธารณะ — pool ใน `repositories/mssql/` | T-70 ถึง T-73 |
| `role_team_manager` / `lb_team_manager` | Role / Login | จัดการทีมตัวเอง | `/manager/*` | T-76, T-77 |
| `role_referee` / `lb_referee` | Role / Login | กรอกผลและเหตุการณ์ | `/referee/*` | T-74, T-75, T-79 |
| `role_admin` / `lb_admin` | Role / Login | จัดการระบบ | `/admin/*` | T-78 |
| `role_checker` / `lb_checker` | Role / Login | ตรวจโครงสร้างฐานข้อมูล | `/db-check`, `npm run db:check` | T-80 |

## ส่วนเสริม

เติมแถวเมื่อทำจริง ถ้าไม่ได้ทำให้ลบแถวนั้นออกก่อนส่งงาน

| Object | ประเภท | หน้าที่ | ถูกเรียกที่หน้า / ไฟล์ | วิธีทดสอบ |
|---|---|---|---|---|
| Service Broker | Queue / Service | ส่งการแจ้งเตือนเมื่อแมตช์จบ | `usp_RecordMatchResult` | บันทึกผลแล้วมีแถวใน `Notifications` |
| Full-Text Catalog | Full-Text | ค้นชื่อนักเตะ | `usp_SearchPlayers` | T-69 |
| Synonym | Synonym | ระบุเมื่อทำจริง | ระบุเมื่อทำจริง | ระบุเมื่อทำจริง |
| Filegroup แยก | Storage | ระบุเมื่อทำจริง | `00_create_database.sql` | ดู `sys.filegroups` |
