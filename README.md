# LeagueBoard

ระบบจัดการทีมกีฬาและการแข่งขัน งานกลุ่มวิชา Database ใช้ Node.js, Express, EJS, Bootstrap 5 และ SQL Server 2019

เว็บเลือกแหล่งข้อมูลจาก `DATA_SOURCE` ใน `.env`

| โหมด | ใช้เมื่อ | ต้องมี SQL Server |
|---|---|---|
| `mock` | ดูเว็บ พัฒนาหน้าจอ เดโมก่อนมีฐานข้อมูล | ไม่ต้อง |
| `mssql` | ใช้งานจริงกับฐานข้อมูล LeagueBoard | ต้อง |

## ติดตั้ง

ต้องมี Node.js 20 ขึ้นไป

```powershell
npm install
copy .env.example .env
```

## รันโหมด mock

ค่าเริ่มต้นใน `.env` เป็น mock อยู่แล้ว

```powershell
npm start
```

เปิด http://localhost:3000

การกรอกข้อมูลในโหมดนี้จะแก้ไฟล์ใน `mock-data/` ถ้าอยากคืนข้อมูลเริ่มต้นให้รัน `git restore mock-data` หรือ `npm run mock:reset` และอย่า commit ไฟล์ที่เปลี่ยนจากการทดลอง

## รันโหมด mssql

1. สร้างฐานข้อมูลตาม `docs/FOR_DB_TEAM.md`
2. แก้ `.env` ใส่ค่าการเชื่อมต่อ รหัสผ่านของ login ทั้ง 5 ตัว และตั้ง `DATA_SOURCE=mssql`
3. ตรวจฐานข้อมูลด้วย `npm run db:check`
4. รันเว็บด้วย `npm start`

## บัญชีทดสอบ

ใช้ได้ในโหมด mock และในโหมด mssql เมื่อใช้ข้อมูลตัวอย่างจาก `mock-data/`

| ชื่อผู้ใช้ | รหัสผ่าน | Role | ใช้ทำอะไร |
|---|---|---|---|
| `admin` | `Admin#2026` | admin | จัดการฤดูกาล อนุมัติทีม ดู audit และการแจ้งเตือน |
| `referee` | `Referee#2026` | referee | กรอกผลและเหตุการณ์ แก้ผลย้อนหลัง |
| `manager` | `Manager#2026` | team_manager | ทีมวิศวกรรมศาสตร์ สมัครทีม เพิ่มนักกีฬา |
| `manager2`, `manager3`, `manager4` | `Manager#2026` | team_manager | ผู้จัดการของทีมอื่น |

รหัสเหล่านี้ใช้สำหรับทดสอบเท่านั้น ห้ามใช้กับระบบจริง

## คำสั่ง

| คำสั่ง | หน้าที่ |
|---|---|
| `npm start` | รันเว็บ |
| `npm run dev` | รันเว็บและรีสตาร์ตเมื่อแก้ไฟล์ |
| `npm test` | ทดสอบเว็บโหมด mock และตรวจ `repositories/mssql` เทียบกับ contract |
| `npm run mock:reset` | สร้างข้อมูลจำลองใหม่ |
| `npm run db:check` | ตรวจว่าฐานข้อมูลครบตาม contract |
| `npm run hash -- รหัสผ่าน` | สร้าง bcrypt hash |

## โครงสร้าง

```
server.js            จุดเริ่มต้นของเว็บ
config/              อ่านค่าจาก .env
middleware/          login, role, CSRF, ข้อความแจ้งผล, หน้า error
routes/              แยกตามกลุ่มผู้ใช้
services/            แปล error เป็นภาษาไทย จัดรูปแบบข้อความ
repositories/
  index.js           เลือก mock หรือ mssql จุดเดียว
  mock/              จำลอง view, SP และ trigger ด้วย JSON
  mssql/             เรียก view, function และ SP จริง
views/               หน้าเว็บ EJS
public/              CSS และโลโก้
mock-data/           ข้อมูลจำลอง ไฟล์ละตาราง
scripts/             สคริปต์ npm
database/            สคริปต์ SQL ของผู้รับผิดชอบฐานข้อมูล
docs/                สเปกและคู่มือ
test/                ชุดทดสอบ
```

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| `docs/FOR_DB_TEAM.md` | คู่มือสร้างและเชื่อมฐานข้อมูลทีละขั้น |
| `docs/db_design.md` | ตาราง ER trigger สิทธิ์ และกรณีทดสอบ |
| `docs/db_contract.md` | สิ่งที่เว็บเรียกจากฐานข้อมูลและรูปแบบ error |
| `docs/db_objects_usage.md` | object แต่ละตัวถูกใช้ที่ไหน |
| `docs/demo_script.md` | ขั้นตอนเดโม |
| `database/README.md` | ลำดับไฟล์ SQL |

## ส่งขึ้น GitHub แบบ private

1. สร้าง repository ใหม่ที่ https://github.com/new เลือก **Private** และไม่ต้องติ๊กเพิ่ม README
2. รันในโฟลเดอร์นี้ โดยแทนที่ `<ชื่อผู้ใช้>` ด้วยชื่อบัญชี GitHub

   ```powershell
   git remote add origin https://github.com/<ชื่อผู้ใช้>/LeagueBoard.git
   git push -u origin main
   ```

3. ที่หน้า repository ไปที่ **Settings** → **Collaborators** → **Add people** แล้วใส่ชื่อบัญชีเพื่อน
4. ส่งลิงก์ repo และบอกให้เพื่อนเริ่มที่ `docs/FOR_DB_TEAM.md`
