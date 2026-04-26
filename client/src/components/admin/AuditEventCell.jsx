import { describeAuditAction } from '../../lib/auditLabels';

/**
 * @param {{ action: string | null | undefined }} props
 */
export default function AuditEventCell({ action }) {
  const { label, badgeClass } = describeAuditAction(action);
  return (
    <span className={`inline-flex max-w-[16rem] rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
      {label}
    </span>
  );
}
