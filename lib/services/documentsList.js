const { isSystemAdmin, isClientAdmin } = require('../roles');

const DOCUMENT_TYPES = [
  'Facility Accreditation Certificate',
  'Procurement Policy',
  'Floor Plan',
  'Inventory Report',
  'Compliance Certificate',
  'Other',
];

/** Lowercase slugs stored in DB (comma-separated). Labels are Title Case in UI. */
const TAG_LABELS = {
  compliance: 'Compliance',
  inventory: 'Inventory',
  accreditation: 'Accreditation',
  safety: 'Safety',
  quality: 'Quality',
  procurement: 'Procurement',
  regulatory: 'Regulatory',
  financial: 'Financial',
  other: 'Other',
};

const TAG_SLUGS = Object.keys(TAG_LABELS);

const TAG_OPTIONS = TAG_SLUGS.map((slug) => ({ slug, label: TAG_LABELS[slug] }));

/** @deprecated use TAG_SLUGS */
const TAGS = TAG_SLUGS;

function buildDocumentsListUrl(query, overrides) {
  const merged = { ...(query || {}) };
  Object.assign(merged, overrides || {});
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, 'tab')) {
    delete merged.approvalStatus;
  }
  if (merged.tab === 'all' || merged.tab === '') {
    delete merged.tab;
  }
  const parts = [];
  for (const key of Object.keys(merged)) {
    const val = merged[key];
    if (val === '' || val === undefined || val === null) continue;
    if (key === 'tags' && Array.isArray(val)) {
      val.forEach((t) => {
        if (t !== '' && t != null) parts.push(`tags=${encodeURIComponent(String(t))}`);
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.length ? `/documents?${parts.join('&')}` : '/documents';
}

/**
 * Same SQL and filters as GET /documents (RBAC-safe list).
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ userId: number, role: string, companyId: number|null }} sessionCtx
 * @param {object} query req.query
 */
async function queryDocumentList(pool, sessionCtx, query) {
  const userId = sessionCtx.userId;
  const role = sessionCtx.role;
  const q = (query.q || '').toString().trim();
  const documentType = (Array.isArray(query.documentType) ? query.documentType[0] : query.documentType || '')
    .toString()
    .trim();
  const tagsParam = query.tags;
  const tags = Array.isArray(tagsParam) ? tagsParam : tagsParam ? [tagsParam] : [];
  const dateFrom = (query.dateFrom || '').trim();
  const dateTo = (query.dateTo || '').trim();
  const sort = (query.sort || 'date').toLowerCase();

  let baseWhere = '';
  const baseParams = [];
  if (isSystemAdmin(role)) {
    const rawCid = (query.companyId || '').toString().trim();
    if (rawCid) {
      const cid = parseInt(rawCid, 10);
      if (!Number.isNaN(cid) && cid > 0) {
        baseWhere += ' AND u.company_id = ?';
        baseParams.push(cid);
      }
    }
  } else if (isClientAdmin(role) && sessionCtx.companyId) {
    baseWhere = ' AND u.company_id = ?';
    baseParams.push(sessionCtx.companyId);
  } else {
    baseWhere = ' AND d.user_id = ?';
    baseParams.push(userId);
  }

  let hasDocumentType = true;
  try {
    await pool.query('SELECT document_type FROM documents LIMIT 1');
  } catch (colErr) {
    if (colErr.code === 'ER_BAD_FIELD_ERROR') hasDocumentType = false;
  }

  let hasApprovalStatus = true;
  try {
    await pool.query('SELECT approval_status FROM documents LIMIT 1');
  } catch (colErr) {
    if (colErr.code === 'ER_BAD_FIELD_ERROR') hasApprovalStatus = false;
  }

  const docTypeSelect = hasDocumentType ? 'd.document_type, ' : '';
  const approvalSelect = hasApprovalStatus ? 'd.approval_status, d.approval_rejection_reason, ' : '';
  const selectList = `
      SELECT d.id, d.user_id, d.filename, d.original_filename, d.file_type, d.file_extension, d.file_size, d.title, d.description, ${docTypeSelect}${approvalSelect}d.tags, d.created_at, d.updated_at,
             u.full_name AS owner_name, u.email AS owner_email, u.company_id AS owner_company_id,
             comp.name AS company_name
    `;
  let fromWhereSql = `
      FROM documents d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN companies comp ON comp.id = u.company_id
      WHERE d.deleted_at IS NULL
    `;
  fromWhereSql += baseWhere;
  const params = [...baseParams];

  if (q) {
    fromWhereSql += ` AND (
      d.original_filename LIKE ? OR d.title LIKE ? OR COALESCE(d.description, '') LIKE ?
      OR u.full_name LIKE ? OR COALESCE(u.email, '') LIKE ?
      OR COALESCE(comp.name, '') LIKE ?
      OR COALESCE(d.tags, '') LIKE ?
    )`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like);
  }
  if (hasDocumentType && documentType && DOCUMENT_TYPES.includes(documentType)) {
    fromWhereSql += ' AND LOWER(TRIM(COALESCE(d.document_type, ""))) = LOWER(?)';
    params.push(documentType);
  }
  if (tags.length > 0) {
    const validTags = tags
      .map((tag) => (tag || '').toString().trim().toLowerCase())
      .filter((t) => TAG_SLUGS.includes(t));
    if (validTags.length > 0) {
    const tagConditions = validTags
      .map(
        () => `(
        LOWER(TRIM(d.tags)) = ? OR
        LOWER(d.tags) LIKE CONCAT(?, ',%') OR
        LOWER(d.tags) LIKE CONCAT('%,', ?, ',%') OR
        LOWER(d.tags) LIKE CONCAT('%,', ?)
      )`
      )
      .join(' OR ');
      fromWhereSql += ` AND (${tagConditions})`;
      validTags.forEach((t) => params.push(t, t, t, t));
    }
  }
  if (dateFrom) {
    fromWhereSql += ' AND d.created_at >= ?';
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    fromWhereSql += ' AND d.created_at <= ?';
    params.push(`${dateTo} 23:59:59`);
  }

  const approvalStatusParam = (query.approvalStatus || '').toString().trim().toUpperCase();
  const rawTab = (query.tab || '').toString().toLowerCase();
  let approvalToFilter = null;
  if (hasApprovalStatus) {
    if (rawTab === 'review') approvalToFilter = 'PENDING';
    else if (rawTab === 'approved') approvalToFilter = 'APPROVED';
    else if (rawTab === 'rejected') approvalToFilter = 'REJECTED';
    else if (['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatusParam)) {
      approvalToFilter = approvalStatusParam;
    }
  }
  if (approvalToFilter) {
    fromWhereSql += ' AND d.approval_status = ?';
    params.push(approvalToFilter);
  }

  let activeTab = 'all';
  if (hasApprovalStatus) {
    if (['review', 'approved', 'rejected'].includes(rawTab)) activeTab = rawTab;
    else if (approvalToFilter === 'PENDING') activeTab = 'review';
    else if (approvalToFilter === 'APPROVED') activeTab = 'approved';
    else if (approvalToFilter === 'REJECTED') activeTab = 'rejected';
  }

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total ${fromWhereSql}`, params);
  const total = Number(countRow.total) || 0;

  let page = parseInt(String(query.page ?? '1'), 10);
  if (Number.isNaN(page) || page < 1) page = 1;
  let pageSize = parseInt(String(query.pageSize ?? '10'), 10);
  if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 10;
  pageSize = Math.min(100, pageSize);

  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * pageSize;

  const orderBy =
    sort === 'name' ? 'd.title ASC, d.original_filename ASC' : sort === 'size' ? 'd.file_size DESC' : 'd.updated_at DESC';
  const dataSql = `${selectList} ${fromWhereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(dataSql, [...params, pageSize, offset]);

  let companiesForFilter = [];
  if (isSystemAdmin(role)) {
    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
    companiesForFilter = companies;
  }

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages,
    hasApprovalStatus,
    hasDocumentType,
    activeTab,
    companiesForFilter,
    availableTags: [...TAG_SLUGS],
    tagOptions: TAG_OPTIONS,
    documentTypes: [...DOCUMENT_TYPES],
  };
}

module.exports = {
  DOCUMENT_TYPES,
  TAGS,
  TAG_SLUGS,
  TAG_LABELS,
  TAG_OPTIONS,
  buildDocumentsListUrl,
  queryDocumentList,
};
