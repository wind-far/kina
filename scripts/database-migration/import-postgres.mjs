#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const targetUrl = String(process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim()
const inputDir = path.resolve(process.argv[2] || 'migration-export')
if (!targetUrl) throw new Error('缺少 TARGET_DATABASE_URL 或 DATABASE_URL')

const { Client } = pg
const quoteIdentifier = value => `"${String(value).replaceAll('"', '""')}"`
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

const restoreTaggedValue = value => {
  if (Array.isArray(value)) return value.map(restoreTaggedValue)
  if (value && typeof value === 'object') {
    if (value.$type === 'bigint') return String(value.value)
    if (value.$type === 'buffer') return Buffer.from(String(value.value), 'base64')
    if (value.$type === 'date') return String(value.value)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreTaggedValue(item)]))
  }
  return value
}

const convertForPostgres = (value, dataType) => {
  const restored = restoreTaggedValue(value)
  if (restored === null || restored === undefined) return null
  if (dataType === 'boolean') return restored === true || restored === 1 || restored === '1'
  if (dataType === 'json' || dataType === 'jsonb') {
    // node-postgres 会把 JS 数组编码成 PostgreSQL array（例如 {"CHAT",...}），
    // 即使目标列是 jsonb 也不会自动改用 JSON。统一传入合法 JSON 文本，
    // 同时兼容 MySQL 驱动返回对象、数组或已经序列化的 JSON 字符串。
    if (typeof restored === 'string') {
      try {
        JSON.parse(restored)
        return restored
      } catch {
        return JSON.stringify(restored)
      }
    }
    return JSON.stringify(restored)
  }
  return restored
}

const manifestBody = await fs.readFile(path.join(inputDir, 'manifest.json'), 'utf8')
const expectedManifestHash = (await fs.readFile(path.join(inputDir, 'MANIFEST.sha256'), 'utf8')).trim().split(/\s+/)[0]
if (sha256(manifestBody) !== expectedManifestHash) throw new Error('manifest.json SHA256 校验失败')
const manifest = JSON.parse(manifestBody)
if (manifest.format !== 'canvasmind-mysql-export-v1') throw new Error(`不支持的迁移格式：${manifest.format}`)

const client = new Client({ connectionString: targetUrl })
await client.connect()

const validateForeignKeys = async () => {
  const result = await client.query(`
    SELECT
      con.conname,
      child.relname AS child_table,
      parent.relname AS parent_table,
      json_agg(child_col.attname ORDER BY child_key.ordinality) AS child_columns,
      json_agg(parent_col.attname ORDER BY child_key.ordinality) AS parent_columns
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace AND ns.nspname = 'public'
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY child_key(attnum, ordinality) ON true
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY parent_key(attnum, ordinality)
      ON parent_key.ordinality = child_key.ordinality
    JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = child_key.attnum
    JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = parent_key.attnum
    WHERE con.contype = 'f'
    GROUP BY con.conname, child.relname, parent.relname
    ORDER BY child.relname, con.conname
  `)

  for (const foreignKey of result.rows) {
    const childColumns = foreignKey.child_columns
    const parentColumns = foreignKey.parent_columns
    const nonNull = childColumns.map(column => `c.${quoteIdentifier(column)} IS NOT NULL`).join(' AND ')
    const equality = childColumns.map((column, index) => (
      `p.${quoteIdentifier(parentColumns[index])} = c.${quoteIdentifier(column)}`
    )).join(' AND ')
    const orphanResult = await client.query(`
      SELECT COUNT(*)::bigint AS count
      FROM ${quoteIdentifier(foreignKey.child_table)} c
      WHERE ${nonNull}
        AND NOT EXISTS (
          SELECT 1 FROM ${quoteIdentifier(foreignKey.parent_table)} p WHERE ${equality}
        )
    `)
    if (BigInt(orphanResult.rows[0].count) !== 0n) {
      throw new Error(`外键 ${foreignKey.conname} 存在 ${orphanResult.rows[0].count} 条孤儿记录`)
    }
  }
}

try {
  const targetTablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `)
  const sourceTables = manifest.tables.map(table => table.name).sort()
  const targetTables = targetTablesResult.rows.map(row => row.table_name).sort()
  if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) {
    throw new Error(`源/目标表集合不一致：source=${sourceTables.length}, target=${targetTables.length}`)
  }

  for (const table of manifest.tables) {
    const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table.name)}`)
    if (BigInt(result.rows[0].count) !== 0n) throw new Error(`目标表 ${table.name} 非空，拒绝覆盖导入`)
  }

  await client.query('BEGIN')
  await client.query('SET LOCAL session_replication_role = replica')

  for (const table of manifest.tables) {
    const body = await fs.readFile(path.join(inputDir, table.filename), 'utf8')
    if (sha256(body) !== table.sha256) throw new Error(`${table.filename} SHA256 校验失败`)
    const targetColumnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table.name])
    const targetColumns = new Map(targetColumnsResult.rows.map(column => [column.column_name, column.data_type]))
    const sourceColumns = table.columns.map(column => column.name)
    const missing = sourceColumns.filter(column => !targetColumns.has(column))
    if (missing.length) throw new Error(`${table.name} 目标表缺少列：${missing.join(', ')}`)

    const lines = body.trim() ? body.trimEnd().split('\n') : []
    for (const line of lines) {
      const row = JSON.parse(line)
      const values = sourceColumns.map(column => convertForPostgres(row[column], targetColumns.get(column)))
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
      await client.query(
        `INSERT INTO ${quoteIdentifier(table.name)} (${sourceColumns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`,
        values,
      )
    }
  }

  await client.query('SET LOCAL session_replication_role = origin')
  for (const table of manifest.tables) {
    const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table.name)}`)
    if (BigInt(result.rows[0].count) !== BigInt(table.rowCount)) {
      throw new Error(`${table.name} 行数不一致：expected=${table.rowCount}, actual=${result.rows[0].count}`)
    }
  }
  await validateForeignKeys()
  await client.query('COMMIT')
  console.log(JSON.stringify({ tableCount: manifest.tables.length, totalRows: manifest.totalRows, status: 'committed' }, null, 2))
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  await client.end()
}
