/**
 * Canonical portal operator organization for system administrators.
 */
const MEDSUPPLY_ORGANIZATION_NAME = 'MedSupply Innovations';

/** Previous display names — renamed in DB on startup so existing installs stay on one company row. */
const LEGACY_MEDSUPPLY_ORGANIZATION_NAMES = ['Med Supply Innovation', 'MedSupply Organization'];

/**
 * Ensure the MedSupply Innovations row exists; return its id.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<number>}
 */
async function ensureMedSupplyCompany(pool) {
  for (const legacy of LEGACY_MEDSUPPLY_ORGANIZATION_NAMES) {
    await pool.query('UPDATE companies SET name = ? WHERE name = ?', [MEDSUPPLY_ORGANIZATION_NAME, legacy]);
  }
  const [rows] = await pool.query('SELECT id FROM companies WHERE name = ? LIMIT 1', [MEDSUPPLY_ORGANIZATION_NAME]);
  if (rows.length) return rows[0].id;
  const [ins] = await pool.query('INSERT INTO companies (name) VALUES (?)', [MEDSUPPLY_ORGANIZATION_NAME]);
  return ins.insertId;
}

module.exports = { MEDSUPPLY_ORGANIZATION_NAME, ensureMedSupplyCompany };
