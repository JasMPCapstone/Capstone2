import { describeAuditAction } from './auditLabels';
import { roleLabel } from './roles';

const ring = 'ring-1 ring-inset';

const BADGE = {
  uploaded: `${ring} bg-blue-100 text-blue-900 ring-blue-200/80`,
  approved: `${ring} bg-green-100 text-green-900 ring-green-200/80`,
  rejected: `${ring} bg-rose-100 text-rose-900 ring-rose-200/80`,
  edited: `${ring} bg-yellow-100 text-yellow-900 ring-yellow-200/80`,
  resubmitted: `${ring} bg-violet-100 text-violet-900 ring-violet-200/80`,
  pending: `${ring} bg-amber-100 text-amber-950 ring-amber-200/80`,
  downloaded: `${ring} bg-slate-100 text-slate-800 ring-slate-200/80`,
  deleted: `${ring} bg-red-100 text-red-900 ring-red-200/80`,
  fallback: `${ring} bg-slate-100 text-slate-800 ring-slate-200/80`,
};

function approvalStatusFromDetails(details) {
  const m = /\bstatus=(APPROVED|REJECTED|PENDING)\b/i.exec((details || '').toString());
  return m ? m[1].toUpperCase() : null;
}

function fileReplacedFromDetails(details) {
  return /\bfile_replace=true\b/i.test((details || '').toString());
}

/**
 * Human-readable badge for document-scoped audit rows (history panel).
 * @param {string | null | undefined} action
 * @param {string | null | undefined} details
 * @returns {{ label: string, badgeClass: string }}
 */
export function getDocumentHistoryPresentation(action, details) {
  const code = (action || '').trim();
  const d = (details || '').toString();

  switch (code) {
    case 'DOCUMENT_UPLOAD':
      return { label: 'Document Uploaded', badgeClass: BADGE.uploaded };
    case 'DOCUMENT_EDIT':
      if (fileReplacedFromDetails(d)) {
        return { label: 'Document Resubmitted', badgeClass: BADGE.resubmitted };
      }
      return { label: 'Document Edited', badgeClass: BADGE.edited };
    case 'DOCUMENT_APPROVAL_SET': {
      const st = approvalStatusFromDetails(d);
      if (st === 'APPROVED') return { label: 'Document Approved', badgeClass: BADGE.approved };
      if (st === 'REJECTED') return { label: 'Document Rejected', badgeClass: BADGE.rejected };
      if (st === 'PENDING') return { label: 'Document Pending Review', badgeClass: BADGE.pending };
      return { label: 'Document Status Updated', badgeClass: BADGE.fallback };
    }
    case 'DOCUMENT_DOWNLOAD':
      return { label: 'Document Downloaded', badgeClass: BADGE.downloaded };
    case 'DOCUMENT_DELETE':
      return { label: 'Document Deleted', badgeClass: BADGE.deleted };
    default: {
      const fb = describeAuditAction(code);
      return { label: fb.label, badgeClass: fb.badgeClass };
    }
  }
}

/** Short role text for history lines, e.g. "Client Admin", "System Admin". */
function historyRoleLabel(role) {
  const r = (role || '').toString().trim().toUpperCase();
  if (r === 'SYSTEM_ADMIN' || r === 'ADMIN') return 'System Admin';
  if (r === 'CLIENT_ADMIN') return 'Client Admin';
  if (r === 'CLIENT') return 'Client';
  if (!r) return '';
  return roleLabel(role);
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} email
 * @param {string | null | undefined} role
 */
export function formatHistoryActor(name, email, role) {
  const display = ((name || email || '').toString() || '').trim() || 'Unknown user';
  const rl = historyRoleLabel(role);
  return rl ? `${display}(${rl})` : display;
}
