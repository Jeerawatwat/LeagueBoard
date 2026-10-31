// ตัวช่วยจัดรูปแบบสำหรับ EJS ไม่มีการคำนวณคะแนนในไฟล์นี้

const TZ = 'Asia/Bangkok';

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleString('th-TH', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

const POSITIONS = { GK: 'ผู้รักษาประตู', DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };
const EVENTS = { Goal: 'ประตู', Yellow: 'ใบเหลือง', Red: 'ใบแดง' };
const SEASON_STATUS = { Upcoming: 'ยังไม่เริ่ม', Active: 'กำลังแข่ง', Finished: 'จบแล้ว' };
const TEAM_STATUS = { Pending: 'รออนุมัติ', Approved: 'อนุมัติแล้ว', Rejected: 'ไม่อนุมัติ' };
const ROLES = { admin: 'ผู้ดูแลระบบ', referee: 'ผู้ตัดสิน', team_manager: 'ผู้จัดการทีม' };

const logo = (url) => url || '/logos/default.svg';
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const score = (value) => (value === null || value === undefined ? '-' : value);

module.exports = {
  formatDate,
  formatDateTime,
  formatTime,
  logo,
  signed,
  score,
  positionLabel: (code) => POSITIONS[code] || code,
  eventLabel: (code) => EVENTS[code] || code,
  seasonStatusLabel: (code) => SEASON_STATUS[code] || code,
  teamStatusLabel: (code) => TEAM_STATUS[code] || code,
  roleLabel: (code) => ROLES[code] || code,
  POSITIONS,
  EVENTS,
};
