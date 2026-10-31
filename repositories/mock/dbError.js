// ของจำลอง: สร้าง error หน้าตาเดียวกับที่ driver mssql ส่งมา (มี .number และชื่อ constraint ใน .message)
// เพื่อให้ services/errors.js แปลงภาษาไทยด้วยตารางเดียวกันทั้งสองโหมด
class DbError extends Error {
  constructor(number, message) {
    super(message);
    this.name = 'DbError';
    this.number = number;
  }
}

const business = (number) => new DbError(number, `business error ${number}`);
const unique = (constraint) => new DbError(2627, `Violation of UNIQUE KEY constraint '${constraint}'.`);
const uniqueIndex = (index) => new DbError(2601, `Cannot insert duplicate key row with unique index '${index}'.`);
const check = (constraint) => new DbError(547, `The statement conflicted with the constraint "${constraint}".`);
const notNull = (column) => new DbError(515, `Cannot insert the value NULL into column '${column}'.`);
const denied = (object) => new DbError(229, `The EXECUTE permission was denied on the object '${object}'.`);

module.exports = { DbError, business, unique, uniqueIndex, check, notNull, denied };
