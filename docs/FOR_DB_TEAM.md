# คู่มือสำหรับผู้รับผิดชอบฐานข้อมูล

เว็บเขียนเสร็จแล้ว คุณมีหน้าที่สร้างฐานข้อมูลตามสเปก แล้วเชื่อมเว็บเข้ากับฐานข้อมูล ทำตามลำดับด้านล่าง ไม่ต้องแก้โค้ดเว็บ

**สิ่งที่ต้องมีในเครื่อง:** SQL Server 2019, SSMS, Node.js 20 ขึ้นไป และ Git

## 1. Clone และรันเว็บโหมด mock

```powershell
git clone <ลิงก์ repo>
cd LeagueBoard
npm install
copy .env.example .env
npm start
```

เปิด http://localhost:3000 แล้วลองกดดูทุกหน้า นี่คือพฤติกรรมที่ฐานข้อมูลของคุณต้องทำให้ได้ บัญชีทดสอบอยู่ใน `README.md`

## 2. อ่านสเปก

อ่านตามลำดับนี้

1. `docs/db_design.md` ตาราง กฎ trigger และกรณีทดสอบ
2. `docs/db_contract.md` สิ่งที่เว็บเรียก ชื่อต้องตรงทุกตัวอักษร
3. `docs/db_objects_usage.md` ใช้ตอนทำเล่มรายงาน
4. `database/README.md` ลำดับไฟล์ SQL

`repositories/mock/` มีตรรกะจำลองของ trigger และ SP ใช้ดูพฤติกรรมที่คาดหวังได้ แต่ของจริงต้องเขียนเป็น SQL

## 3. สร้างฐานข้อมูลใน SSMS

เขียนไฟล์ใน `database/` ตามลำดับใน `database/README.md` แล้วรันใน SSMS ด้วยบัญชีผู้ดูแล

ทุกครั้งที่สร้าง object เสร็จ ให้ทดสอบตามกรณีทดสอบ T-xx ที่เกี่ยวข้องใน `db_design.md` หัวข้อ 9

## 4. เปิด SQL Server Authentication

เว็บต่อด้วยชื่อผู้ใช้และรหัสผ่าน จึงต้องเปิดโหมดนี้

1. ใน SSMS คลิกขวาที่ชื่อ server แล้วเลือก **Properties**
2. หน้า **Security** เลือก **SQL Server and Windows Authentication mode** แล้วกด OK
3. คลิกขวาที่ชื่อ server แล้วเลือก **Restart**

## 5. เปิด TCP/IP

เว็บต่อผ่าน TCP เท่านั้น

1. เปิด **SQL Server Configuration Manager** (ต้อง Run as administrator)
2. ไปที่ **SQL Server Network Configuration** → **Protocols for MSSQLSERVER** (ถ้าใช้ Express จะเป็น `SQLEXPRESS`)
3. คลิกขวา **TCP/IP** แล้วเลือก **Enable**
4. เปิด Properties ของ TCP/IP แท็บ **IP Addresses** ส่วน **IPAll** ให้ลบค่า `TCP Dynamic Ports` และใส่ `TCP Port` เป็น `1433`
5. ไปที่ **SQL Server Services** แล้ว Restart บริการ SQL Server

## 6. สร้าง login สำหรับเว็บ

รัน `database/07_security.sql` เพื่อสร้าง login ทั้ง 5 ตัวตาม `db_design.md` หัวข้อ 7: `lb_viewer`, `lb_team_manager`, `lb_referee`, `lb_admin`, `lb_checker`

ตั้งรหัสผ่านจริงเฉพาะในเครื่องของคุณ ห้าม commit รหัสผ่านจริงลงไฟล์ SQL

## 7. ตั้งค่า .env

แก้ไฟล์ `.env` ทุกค่ามีคำอธิบายในไฟล์

- ใส่รหัสผ่านของ login ทั้ง 5 ตัวในช่อง `DB_..._PASSWORD`
- ตั้ง `SESSION_SECRET` ตามคำสั่งในไฟล์
- เปลี่ยน `DATA_SOURCE=mssql`

## 8. รัน db:check

```powershell
npm run db:check
```

คำสั่งนี้ต่อด้วย login ทั้ง 5 ตัว แล้วตรวจว่ามีตาราง คอลัมน์ view function SP trigger constraint และ role ครบตาม contract แล้วรายงานภาษาไทยว่าขาดอะไร

| ข้อความ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| ต่อ localhost:1433 ไม่ได้ | ยังไม่เปิด TCP/IP หรือยังไม่ restart | ทำขั้นตอนที่ 5 |
| ตรวจชื่อ/รหัสผ่านใน .env | รหัสผิด, ยังไม่เปิด SQL Authentication หรือยังไม่สร้าง login | ทำขั้นตอนที่ 4, 6, 7 |
| ไม่มีตาราง/view/SP ... | ยังไม่ได้สร้าง หรือชื่อไม่ตรง | เทียบกับ `db_contract.md` |
| มีพารามิเตอร์เกิน | SP มีพารามิเตอร์ที่เว็บไม่ได้ส่ง | ลบออกให้ตรง contract |
| ยังไม่ได้ผูก Rule | ไม่ได้เรียก `sp_bindrule` | แก้ `01_types_rules_defaults.sql` |
| ต้องเป็น NVARCHAR | ใช้ `VARCHAR` กับข้อความไทย | แก้ชนิดคอลัมน์ |
| โครงสร้างว่างทั้งหมดทั้งที่สร้างแล้ว | `lb_checker` ไม่มี `VIEW DEFINITION` | แก้ `07_security.sql` |

รายการ "ส่วนเสริม" ในคำเตือนไม่ทำให้ไม่ผ่าน

แก้จนขึ้น `โครงสร้างครบตาม contract` และ login ผ่านครบทั้ง 5 ตัว

## 9. ทดสอบกับเว็บจริง

1. รัน `npm start` ข้อความบรรทัดแรกต้องแสดง `(mssql)` และแถบ "โหมดสาธิต" บนหน้าเว็บต้องหายไป
2. login เป็นแอดมินแล้วเปิด `/db-check` กดปุ่ม "ลองแก้ผลในฐานะ viewer" ต้องได้ Permission denied
3. เดินตาม `docs/demo_script.md` ครบทุกขั้นตอน
4. ทดสอบกรณีที่เหลือใน `db_design.md` หัวข้อ 9

`db:check` ตรวจเฉพาะว่ามี object ครบ ไม่ได้ตรวจว่าทำงานถูก ต้องทดสอบตามขั้นตอนนี้ด้วย

ถ้าเว็บขึ้น "เกิดข้อผิดพลาดในระบบ" ให้ดูรายละเอียดในหน้าต่างที่รัน `npm start` ส่วนมากเป็นชื่อคอลัมน์หรือชนิดข้อมูลไม่ตรง contract

## 10. Commit สคริปต์ SQL

```powershell
git checkout -b database
git add database
git commit -m "feat: add database scripts"
git push -u origin database
```

ไฟล์ `.env` ถูกตั้งให้ไม่ขึ้น Git อยู่แล้ว ตรวจด้วย `git status` ก่อน commit ว่าไม่มีรหัสผ่านจริงในไฟล์ที่จะส่ง

## ถ้าอยากเปลี่ยนชื่อหรือพารามิเตอร์

ตกลงกับคนทำเว็บก่อน แล้วแก้พร้อมกันที่ `docs/db_contract.md`, `repositories/mssql/` และ `repositories/mock/` จากนั้นรัน `npm test`
