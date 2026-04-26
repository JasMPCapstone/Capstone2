import DocumentStatusBadge from './ui/DocumentStatusBadge';

/** Longer labels for dashboard copy. */
export default function ApprovalBadge(props) {
  return <DocumentStatusBadge {...props} compact={false} />;
}
