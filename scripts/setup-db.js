/**
 * Database setup: runs schema.sql and seeds admin + client accounts.
 * Prerequisites: MySQL running, database created (see README).
 * Usage: npm run setup-db   (after copying .env from .env.example)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'medsupply_portal';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  multipleStatements: true,
};

async function run() {
  let conn;
  try {
    // Connect without database first to create it if missing
    const { database: _db, ...configNoDb } = DB_CONFIG;
    const connNoDb = await mysql.createConnection(configNoDb);
    await connNoDb.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connNoDb.end();
    console.log(`Database '${DB_NAME}' ready.`);

    conn = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to MySQL.');

    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(schema);
    console.log('Schema applied.');

    const [coResult] = await conn.query("INSERT INTO companies (name) VALUES ('Demo Healthcare Org')");
    const companyId = coResult.insertId;

    const adminHash = bcrypt.hashSync('admin123', 10);
    const clientAdminHash = bcrypt.hashSync('clientadmin123', 10);
    const clientHash = bcrypt.hashSync('client123', 10);

    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'SYSTEM_ADMIN', 1, NULL, 0, 1, NULL)`,
      ['admin@medsupply.com', adminHash, 'System Admin']
    );
    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT_ADMIN', 1, ?, 0, 1, ?)`,
      ['clientadmin@example.com', clientAdminHash, 'Client Admin', companyId, 'Demo Healthcare Org']
    );
    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT', 1, ?, 0, 1, ?)`,
      ['client@example.com', clientHash, 'Staff User', companyId, 'Demo Healthcare Org']
    );
    console.log('Seed data created.');
    console.log('  System admin:   admin@medsupply.com / admin123');
    console.log('  Client admin:   clientadmin@example.com / clientadmin123');
    console.log('  Staff:          client@example.com / client123');
  } catch (err) {
    console.error('Setup failed:', err.message || err.code || String(err));
    if (err.code) console.error('Error code:', err.code);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
