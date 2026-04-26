/**
 * Browsers generally cannot render Word/Excel/PowerPoint inside an iframe; loading /view often triggers a download.
 * Only use inline iframe preview for types that typically display in-page.
 */

const OFFICE_EXTENSIONS = new Set([
  'doc',
  'docx',
  'dot',
  'dotx',
  'xls',
  'xlsx',
  'xlsm',
  'xlsb',
  'ppt',
  'pptx',
  'pps',
  'ppsx',
  'odt',
  'ods',
  'odp',
  'rtf',
]);

function normalizeMime(m) {
  if (!m || typeof m !== 'string') return '';
  return m.split(';')[0].trim().toLowerCase();
}

function normalizeExt(doc) {
  const raw = (doc.file_extension || '').toString().trim().toLowerCase();
  return raw.replace(/^\./, '');
}

/**
 * @param {{ file_type?: string | null, file_extension?: string | null }} doc
 * @returns {boolean}
 */
export function documentSupportsInlineBrowserPreview(doc) {
  if (!doc) return false;
  const ext = normalizeExt(doc);
  if (ext && OFFICE_EXTENSIONS.has(ext)) return false;

  const mime = normalizeMime(doc.file_type);
  if (mime) {
    if (
      mime === 'application/msword' ||
      mime.startsWith('application/vnd.ms-excel') ||
      mime.startsWith('application/vnd.ms-powerpoint')
    ) {
      return false;
    }
    if (mime.startsWith('application/vnd.openxmlformats-officedocument')) return false;
  }

  if (mime === 'application/pdf') return true;
  if (mime.startsWith('image/')) return true;
  if (mime === 'text/plain' || mime === 'text/html' || mime === 'text/csv') return true;

  if (ext === 'pdf') return true;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return true;
  if (['txt', 'text', 'html', 'htm', 'csv'].includes(ext)) return true;

  return false;
}
