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

    const adminHash = bcrypt.hashSync('admin123', 10);
    const clientHash = bcrypt.hashSync('client123', 10);

    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, 'ADMIN', 1) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['admin@medsupply.com', adminHash, 'Admin User']
    );
    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, 'CLIENT', 1) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['client@example.com', clientHash, 'Test Client']
    );
    console.log('Seed users created/updated.');
    console.log('  Admin:  admin@medsupply.com / admin123');
    console.log('  Client: client@example.com / client123');
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
