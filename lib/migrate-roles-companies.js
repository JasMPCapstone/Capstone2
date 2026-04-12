/**
 * Companies, multi-tenant roles (SYSTEM_ADMIN, CLIENT_ADMIN, CLIENT), onboarding columns.
 */
const { pool } = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows.length > 0;
}

async function ensureRolesAndCompanies() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [roleCol] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
  if (roleCol[0] && String(roleCol[0].Type || '').toLowerCase().includes('enum')) {
    await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'CLIENT'");
    console.log('Migration: users.role widened to VARCHAR for new roles.');
  }
  await pool.query("UPDATE users SET role = 'SYSTEM_ADMIN' WHERE role = 'ADMIN'");

  if (!(await columnExists('users', 'company_id'))) {
    await pool.query('ALTER TABLE users ADD COLUMN company_id INT UNSIGNED NULL');
    console.log('Migration: added users.company_id');
  }
  if (!(await columnExists('users', 'password_must_change'))) {
    await pool.query(
      'ALTER TABLE users ADD COLUMN password_must_change TINYINT(1) NOT NULL DEFAULT 0'
    );
    console.log('Migration: added users.password_must_change');
  }
  if (!(await columnExists('users', 'profile_completed'))) {
    await pool.query(
      'ALTER TABLE users ADD COLUMN profile_completed TINYINT(1) NOT NULL DEFAULT 0'
    );
    console.log('Migration: added users.profile_completed');
  }

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM companies');
  let firstCompanyId;
  if (n === 0) {
    const [r] = await pool.query("INSERT INTO companies (name) VALUES ('Default organization')");
    firstCompanyId = r.insertId;
  } else {
    const [[row]] = await pool.query('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
    firstCompanyId = row.id;
  }

  await pool.query(
    `UPDATE users SET company_id = ? WHERE company_id IS NULL AND role IN ('CLIENT', 'CLIENT_ADMIN')`,
    [firstCompanyId]
  );
  await pool.query(`UPDATE users SET company_id = NULL WHERE role = 'SYSTEM_ADMIN'`);

  await pool.query(`UPDATE users SET profile_completed = 1 WHERE role = 'SYSTEM_ADMIN'`);
  await pool.query(
    `UPDATE users SET profile_completed = 1 WHERE password_must_change = 0 AND profile_completed = 0`
  );
}

module.exports = { ensureRolesAndCompanies };
