// จุดเดียวที่เลือกแหล่งข้อมูล ทุก route import จากไฟล์นี้เท่านั้น
const { dataSource } = require('../config');

module.exports = dataSource === 'mssql' ? require('./mssql') : require('./mock');
