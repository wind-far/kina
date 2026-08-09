#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import mariadb from 'mariadb'

const sourceUrl = String(process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL || '').trim()
const outputDir = path.resolve(process.argv[2] || 'migration-export')
const EXCLUDED_TABLES = new Set(['_prisma_migrations'])

if (!sourceUrl) throw new Error('缺少 SOURCE_DATABASE_URL 或 DATABASE_URL')

const parsed = new URL(sourceUrl)
if (parsed.protocol !== 'mysql:') throw new Error('源数据库必须是 mysql:// 连接串')

const quoteIdentifier = value => `\`${String(value).replaceAll('`', '``')}\``
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

const normalizeValue = value => {
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() }
  if (Buffer.isBuffer(value)) return { $type: 'buffer', value: value.toString('base64') }
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() }
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]))
  }
  return value
}

const connection = await mariadb.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.slice(1)),
  dateStrings: true,
  bigIntAsNumber: false,
  decimalAsNumber: false,
})

try {
  await fs.mkdir(outputDir, { recursive: true, mode: 0o700 })
  const tableRows = await connection.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const tables = tableRows.map(row => String(row.TABLE_NAME || row.table_name)).filter(name => !EXCLUDED_TABLES.has(name))
  const manifest = {
    format: 'canvasmind-mysql-export-v1',
    createdAt: new Date().toISOString(),
    sourceDatabase: decodeURIComponent(parsed.pathname.slice(1)),
    excludedTables: [...EXCLUDED_TABLES],
    totalRows: 0,
    tables: [],
  }

  for (const table of tables) {
    const columnRows = await connection.query(`
      SELECT column_name, data_type, is_nullable, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position
    `, [table])
    const rows = await connection.query(`SELECT * FROM ${quoteIdentifier(table)}`)
    const body = rows.map(row => JSON.stringify(normalizeValue(row))).join('\n') + (rows.length ? '\n' : '')
    const filename = `${table}.ndjson`
    await fs.writeFile(path.join(outputDir, filename), body, { mode: 0o600 })
    manifest.totalRows += rows.length
    manifest.tables.push({
      name: table,
      filename,
      rowCount: rows.length,
      sha256: sha256(body),
      columns: columnRows.map(column => ({
        name: String(column.COLUMN_NAME || column.column_name),
        dataType: String(column.DATA_TYPE || column.data_type),
        nullable: String(column.IS_NULLABLE || column.is_nullable) === 'YES',
      })),
    })
  }

  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`
  await fs.writeFile(path.join(outputDir, 'manifest.json'), manifestBody, { mode: 0o600 })
  await fs.writeFile(path.join(outputDir, 'MANIFEST.sha256'), `${sha256(manifestBody)}  manifest.json\n`, { mode: 0o600 })
  console.log(JSON.stringify({ outputDir, tableCount: manifest.tables.length, totalRows: manifest.totalRows }, null, 2))
} finally {
  await connection.end()
}
