// แปลง error จากฐานข้อมูล (หรือจากโหมด mock ที่จำลองรูปแบบเดียวกัน) เป็นข้อความภาษาไทย
// ตารางทั้งหมดตรงกับ docs/db_contract.md หัวข้อ 2 ถ้าแก้ที่นี่ต้องแก้เอกสารด้วย

const BUSINESS = {
  51001: 'ไม่พบแมตช์นี้',
  51002: 'มีผู้อื่นแก้ไขแมตช์นี้ไปแล้ว กรุณาโหลดข้อมูลใหม่',
  51003: 'สกอร์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป',
  51004: 'ต้องบันทึกผลการแข่งขันก่อนเพิ่มเหตุการณ์',
  51005: 'ไม่พบเหตุการณ์นี้',
  51006: 'แมตช์นี้ยังไม่มีผลให้ลบ',
  51007: 'ฤดูกาลนี้จบแล้ว แก้ไขผลไม่ได้',
  51010: 'นักกีฬาต้องอยู่ในทีมเหย้าหรือทีมเยือนของแมตช์นี้',
  51020: 'ไม่พบฤดูกาลนี้',
  51022: 'ฤดูกาลนี้สร้างตารางแข่งแล้ว',
  51023: 'ต้องมีอย่างน้อย 2 ทีมจึงจะสร้างตารางแข่งได้',
  51024: 'ยังไม่มีข้อมูลสนามแข่ง',
  51025: 'เปลี่ยนสถานะฤดูกาลไม่ได้ในตอนนี้',
  51026: 'มีฤดูกาลที่กำลังแข่งอยู่แล้ว',
  51027: 'ทำรายการนี้ได้เฉพาะฤดูกาลที่ยังไม่เริ่ม',
  51030: 'ไม่พบทีมนี้',
  51031: 'ทีมนี้ได้รับการพิจารณาแล้ว',
  51032: 'คุณมีทีมครบจำนวนที่กำหนดแล้ว (สูงสุด 3 ทีม)',
  51033: 'คุณเพิ่มนักกีฬาได้เฉพาะทีมของตัวเอง',
  51034: 'ทีมนี้ยังไม่ได้รับการอนุมัติ',
  51035: 'ทีมนี้อยู่ในฤดูกาลแล้ว',
  51040: 'ข้อมูลนักกีฬาไม่ถูกต้อง เบอร์เสื้อต้องอยู่ระหว่าง 1–99',
  51050: 'กรุณากรอกชื่อผู้ใช้และชื่อที่แสดง',
};

const CONSTRAINTS = {
  UQ_Users_Username: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว',
  UQ_Seasons_SeasonName: 'ชื่อฤดูกาลนี้มีอยู่แล้ว',
  UX_Seasons_OneActive: 'มีฤดูกาลที่กำลังแข่งอยู่แล้ว',
  UQ_Teams_TeamName: 'ชื่อทีมนี้ถูกใช้แล้ว',
  UQ_Players_Team_Jersey: 'เบอร์เสื้อนี้มีผู้เล่นในทีมใช้แล้ว',
  UQ_Matches_Season_Pair: 'คู่แข่งขันนี้มีอยู่ในฤดูกาลแล้ว',
  CK_Seasons_Dates: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
  CK_Players_Position: 'ตำแหน่งไม่ถูกต้อง',
  CK_Matches_DifferentTeams: 'ทีมเหย้าและทีมเยือนต้องเป็นคนละทีม',
  CK_Matches_ScoreNonNegative: 'สกอร์ต้องไม่ติดลบ',
  CK_Matches_FinishedHasScore: 'แมตช์ที่จบแล้วต้องมีสกอร์ครบ',
  CK_MatchEvents_Type: 'ชนิดเหตุการณ์ไม่ถูกต้อง',
  CK_MatchEvents_Minute: 'นาทีต้องอยู่ระหว่าง 0–120',
  FK_Matches_HomeTeam: 'ทีมนี้ไม่ได้อยู่ในฤดูกาล',
  FK_Matches_AwayTeam: 'ทีมนี้ไม่ได้อยู่ในฤดูกาล',
  FK_Matches_UpdatedBy: 'ไม่พบผู้ใช้ที่ทำรายการ กรุณาเข้าสู่ระบบใหม่',
  FK_MatchEvents_Users: 'ไม่พบผู้ใช้ที่ทำรายการ กรุณาเข้าสู่ระบบใหม่',
  FK_MatchEvents_Players: 'ไม่พบนักกีฬา',
};

const CONNECTION_CODES = new Set(['ELOGIN', 'ESOCKET', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP']);

function fromConstraint(message) {
  const name = Object.keys(CONSTRAINTS).find((key) => String(message).includes(key));
  return name ? CONSTRAINTS[name] : 'ข้อมูลไม่ถูกต้องตามเงื่อนไขของระบบ';
}

function translateError(err) {
  const number = err.number;
  if (BUSINESS[number]) return { code: 'BUSINESS', status: 400, message: BUSINESS[number] };
  if (number >= 51000 && number <= 51999) return { code: 'BUSINESS', status: 400, message: err.message };
  if (number === 2627 || number === 2601) return { code: 'UNIQUE', status: 400, message: fromConstraint(err.message) };
  if (number === 547) return { code: 'CHECK_FK', status: 400, message: fromConstraint(err.message) };
  if (number === 515) return { code: 'NOT_NULL', status: 400, message: 'กรุณากรอกข้อมูลให้ครบ' };
  if (number === 513) return { code: 'RULE', status: 400, message: 'เบอร์เสื้อต้องอยู่ระหว่าง 1–99' };
  if (number === 229) return { code: 'PERMISSION', status: 403, message: 'คุณไม่มีสิทธิ์ทำรายการนี้ (Permission denied)' };
  if (number === 1205) return { code: 'DEADLOCK', status: 503, message: 'ระบบกำลังทำงานหนัก กรุณาลองใหม่อีกครั้ง' };
  if (CONNECTION_CODES.has(err.code)) return { code: 'CONNECTION', status: 503, message: 'เชื่อมต่อฐานข้อมูลไม่ได้' };
  return { code: 'UNKNOWN', status: 500, message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' };
}

module.exports = { translateError };
