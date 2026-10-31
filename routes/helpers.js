// แปลงค่าจากฟอร์ม/URL เป็นจำนวนเต็ม ค่าที่ไม่ใช่ตัวเลขเป็น null แล้วให้ SP หรือ constraint เป็นผู้ปฏิเสธ
function toInt(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return /^-?\d{1,9}$/.test(text) ? Number(text) : null;
}

const text = (value) => String(value === undefined || value === null ? '' : value).trim();

function pickSeason(seasons, requestedId) {
  const requested = seasons.find((s) => s.SeasonID === toInt(requestedId));
  return requested || seasons.find((s) => s.Status === 'Active') || seasons[0] || null;
}

module.exports = { toInt, text, pickSeason };
