// ตรวจว่าฐานข้อมูลมีทุกอย่างตาม contract.js ใช้ร่วมกันโดย npm run db:check และหน้า /db-check
const contract = require('./contract');

const QUERIES = {
  objects: `SELECT o.name, RTRIM(o.type) AS type FROM sys.objects o WHERE o.is_ms_shipped = 0`,
  columns: `SELECT OBJECT_NAME(c.object_id) AS objectName, c.name, TYPE_NAME(c.system_type_id) AS baseType,
              TYPE_NAME(c.user_type_id) AS userType, c.is_computed AS isComputed
            FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id
            WHERE o.is_ms_shipped = 0`,
  parameters: `SELECT OBJECT_NAME(p.object_id) AS objectName, p.name
               FROM sys.parameters p JOIN sys.objects o ON o.object_id = p.object_id
               WHERE o.is_ms_shipped = 0 AND p.parameter_id > 0`,
  triggers: `SELECT t.name, OBJECT_NAME(t.parent_id) AS parentName FROM sys.triggers t WHERE t.parent_class = 1`,
  indexes: `SELECT i.name FROM sys.indexes i JOIN sys.objects o ON o.object_id = i.object_id
            WHERE o.is_ms_shipped = 0 AND i.name IS NOT NULL`,
  types: `SELECT t.name, t.rule_object_id AS ruleId, t.default_object_id AS defaultId
          FROM sys.types t WHERE t.is_user_defined = 1`,
  roles: `SELECT name FROM sys.database_principals WHERE type = 'R'`,
  optional: `SELECT
            (SELECT COUNT(*) FROM sys.service_queues WHERE is_ms_shipped = 0) AS queues,
            (SELECT COUNT(*) FROM sys.fulltext_catalogs) AS fulltextCatalogs,
            (SELECT COUNT(*) FROM sys.synonyms) AS synonyms,
            (SELECT COUNT(*) FROM sys.filegroups) AS filegroups,
            CONVERT(NVARCHAR(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation')) AS collation`,
};

async function readSchema(pool) {
  const entries = await Promise.all(Object.entries(QUERIES).map(async ([key, statement]) => {
    const result = await pool.request().query(statement);
    return [key, result.recordset];
  }));
  return Object.fromEntries(entries);
}

function compareSchema(actual, manifest = contract) {
  const missing = [];
  const warnings = [];
  const objects = new Map(actual.objects.map((o) => [o.name, o.type]));
  const columnsOf = (name) => actual.columns.filter((c) => c.objectName === name);
  const paramsOf = (name) => actual.parameters.filter((p) => p.objectName === name).map((p) => p.name);
  const hasType = (name, types) => types.includes(objects.get(name));

  const checkColumns = (label, name, expected) => {
    const present = columnsOf(name).map((c) => c.name);
    for (const column of expected) {
      if (!present.includes(column)) missing.push(`${label} ${name} ไม่มีคอลัมน์ ${column}`);
    }
  };
  const checkParams = (label, name, expected) => {
    const present = paramsOf(name);
    for (const param of expected) {
      if (!present.includes(param)) missing.push(`${label} ${name} ไม่มีพารามิเตอร์ ${param}`);
    }
    for (const param of present) {
      if (!expected.includes(param)) missing.push(`${label} ${name} มีพารามิเตอร์เกิน ${param} ซึ่งเว็บไม่ได้ส่ง`);
    }
  };

  for (const [table, columns] of Object.entries(manifest.tables)) {
    if (hasType(table, ['U'])) checkColumns('ตาราง', table, columns);
    else missing.push(`ไม่มีตาราง ${table}`);
  }
  for (const [view, columns] of Object.entries(manifest.views)) {
    if (hasType(view, ['V'])) checkColumns('view', view, columns);
    else missing.push(`ไม่มี view ${view}`);
  }
  for (const [fn, params] of Object.entries(manifest.scalarFunctions)) {
    if (hasType(fn, ['FN'])) checkParams('function', fn, params);
    else missing.push(`ไม่มี scalar function ${fn}`);
  }
  for (const [fn, spec] of Object.entries(manifest.tableFunctions)) {
    if (hasType(fn, ['IF', 'TF'])) {
      checkParams('function', fn, spec.params);
      checkColumns('function', fn, spec.columns);
    } else {
      missing.push(`ไม่มี table-valued function ${fn}`);
    }
  }
  for (const [proc, params] of Object.entries(manifest.procedures)) {
    if (hasType(proc, ['P'])) checkParams('stored procedure', proc, params);
    else missing.push(`ไม่มี stored procedure ${proc}`);
  }
  for (const [trigger, parent] of Object.entries(manifest.triggers)) {
    const found = actual.triggers.find((t) => t.name === trigger);
    if (!found) missing.push(`ไม่มี trigger ${trigger}`);
    else if (found.parentName !== parent) missing.push(`trigger ${trigger} ต้องอยู่บนตาราง ${parent} แต่อยู่บน ${found.parentName}`);
  }
  for (const constraint of manifest.constraints) {
    if (!objects.has(constraint) && !actual.indexes.some((i) => i.name === constraint)) {
      missing.push(`ไม่มี constraint ${constraint}`);
    }
  }
  for (const index of manifest.indexes) {
    if (!actual.indexes.some((i) => i.name === index)) missing.push(`ไม่มี index ${index}`);
  }
  for (const role of manifest.roles) {
    if (!actual.roles.some((r) => r.name === role)) missing.push(`ไม่มี database role ${role}`);
  }

  const jersey = actual.types.find((t) => t.name === 'JerseyNumber');
  if (!jersey) missing.push('ไม่มี User-Defined Type JerseyNumber');
  else if (!jersey.ruleId) missing.push('ยังไม่ได้ผูก Rule กับ type JerseyNumber');
  const status = actual.types.find((t) => t.name === 'MatchStatusType');
  if (!status) missing.push('ไม่มี User-Defined Type MatchStatusType');
  else if (!status.defaultId) missing.push('ยังไม่ได้ผูก Default กับ type MatchStatusType');

  const column = (table, name) => columnsOf(table).find((c) => c.name === name);
  const expectUserType = (table, name, type) => {
    const found = column(table, name);
    if (found && found.userType !== type) missing.push(`${table}.${name} ต้องเป็น ${type} แต่เป็น ${found.userType}`);
  };
  expectUserType('Players', 'JerseyNo', 'JerseyNumber');
  expectUserType('Matches', 'Status', 'MatchStatusType');
  const rowVersion = column('Matches', 'RowVersion');
  if (rowVersion && rowVersion.baseType !== 'timestamp') missing.push('Matches.RowVersion ต้องเป็น ROWVERSION');
  const gd = column('Standings', 'GD');
  if (gd && !gd.isComputed) missing.push('Standings.GD ต้องเป็น computed column');

  for (const entry of manifest.nvarcharColumns) {
    const [table, name] = entry.split('.');
    const found = column(table, name);
    if (found && found.baseType !== 'nvarchar') missing.push(`${entry} ต้องเป็น NVARCHAR ไม่เช่นนั้นภาษาไทยจะเพี้ยน`);
  }

  const optional = actual.optional[0];
  if (!String(optional.collation).startsWith('Thai')) warnings.push(`collation ของฐานข้อมูลเป็น ${optional.collation} สเปกกำหนด Thai_100_CI_AS`);
  if (!optional.queues) warnings.push('ส่วนเสริม: ยังไม่มี Service Broker queue');
  if (!optional.fulltextCatalogs) warnings.push('ส่วนเสริม: ยังไม่มี Full-Text Catalog');
  if (!optional.synonyms) warnings.push('ส่วนเสริม: ยังไม่มี Synonym');
  if (optional.filegroups < 2) warnings.push('ส่วนเสริม: ยังไม่มี filegroup แยก');

  return { missing, warnings };
}

module.exports = { readSchema, compareSchema };
