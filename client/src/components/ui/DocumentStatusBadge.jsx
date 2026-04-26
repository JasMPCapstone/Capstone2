const styles = {
  PENDING: 'bg-amber-50 text-amber-900 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-900 ring-rose-200',
};

const shortLabels = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * Approval workflow status from API `approval_status`.
 * @param {{ status?: string|null, compact?: boolean }} props
 */
export default function DocumentStatusBadge({ status, compact = true }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const key = String(status).toUpperCase();
  const cls = styles[key] || 'bg-slate-50 text-slate-800 ring-slate-200';
  const label = compact
    ? shortLabels[key] || String(status)
    : key === 'PENDING'
      ? 'Pending review'
      : key === 'APPROVED'
        ? 'Approved'
        : key === 'REJECTED'
          ? 'Rejected'
          : String(status);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}
