# database/

โฟลเดอร์นี้เก็บสคริปต์ SQL ของฐานข้อมูล LeagueBoard ผู้รับผิดชอบฐานข้อมูลเป็นคนเขียนตาม `docs/db_design.md` และ `docs/db_contract.md` ขั้นตอนทั้งหมดอยู่ใน `docs/FOR_DB_TEAM.md`

## ไฟล์ที่ต้องสร้าง

รันตามลำดับนี้ ทุกไฟล์ต้องรันซ้ำบนฐานข้อมูลว่างได้โดยไม่ error

| ลำดับ | ไฟล์ | เนื้อหา | อ้างอิง |
|---|---|---|---|
| 0 | `00_create_database.sql` | สร้างฐานข้อมูล collation `Thai_100_CI_AS` | `db_design.md` หัวข้อ 1 |
| 1 | `01_types_rules_defaults.sql` | Type, Rule, Default และการผูก | หัวข้อ 2 |
| 2 | `02_tables.sql` | 12 ตาราง, constraint, index | หัวข้อ 3 |
| 3 | `03_functions.sql` | Function 3 ตัว | หัวข้อ 5, `db_contract.md` หัวข้อ 4 |
| 4 | `04_views.sql` | View 10 ตัว | `db_contract.md` หัวข้อ 3 |
| 5 | `05_procedures.sql` | SP 14 ตัว | `db_contract.md` หัวข้อ 5 |
| 6 | `06_triggers.sql` | Trigger 5 ตัว | `db_design.md` หัวข้อ 6 |
| 7 | `07_security.sql` | Role, login, user, สิทธิ์ | หัวข้อ 7 |
| 8 | `08_sample_data.sql` | ข้อมูลตัวอย่างจาก `mock-data/` | หัวข้อถัดไป |

ไฟล์ 01 ต้องมาก่อน 02 เพราะ `CREATE TABLE` อ้างถึง type และ Rule/Default ต้องผูกกับ type ก่อนสร้างตาราง

## 08_sample_data.sql

ใช้ข้อมูลจาก `mock-data/*.json` เพื่อให้ผลตรงกับโหมด mock

- เพิ่มตามลำดับเดียวกับการสร้างตาราง ใช้ `SET IDENTITY_INSERT` เพื่อคงเลข ID เดิม
- ข้อความไทยต้องมี `N` นำหน้า
- `PasswordHash` คัดลอกจาก `mock-data/Users.json` ได้เลย หรือสร้างใหม่ด้วย `npm run hash -- รหัสผ่าน`
- ไม่ต้องใส่ `RowVersion` และ `GD` ฐานข้อมูลสร้างให้เอง
- ไม่ต้องเพิ่ม `Standings` ด้วยมือ เพราะ `trg_Matches_UpdateStandings` คำนวณให้เมื่อเพิ่ม `Matches` แต่ต้องเพิ่ม `SeasonTeams` ก่อน `Matches`
- `trg_Teams_Approved` ไม่ทำงานตอน INSERT จึงต้องเพิ่ม `SeasonTeams` เอง
- `trg_Teams_LimitPerUser` ยังทำงาน ข้อมูลตัวอย่างผ่านอยู่แล้ว เพราะไม่มีผู้ใช้คนใดมีเกิน 3 ทีม
- ฤดูกาล Upcoming ไม่มีทีม ไม่มีแมตช์ เพื่อใช้เดโมการอนุมัติทีมและสร้างตารางแข่ง
