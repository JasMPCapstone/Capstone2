import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchDocument, fetchDocumentHistory, postNotificationsMarkDocumentRead } from '../lib/api';
import { formatDate, formatFileSize } from '../lib/format';
import { documentSupportsInlineBrowserPreview } from '../lib/documentPreview';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import DocumentStatusBadge from '../components/ui/DocumentStatusBadge';
import RejectionReasonDialog, { RejectionReasonIconButton } from '../components/ui/RejectionReasonDialog';
import DocumentHistoryModal from '../components/documents/DocumentHistoryModal';

/**
 * @param {{ label: string, children: import('react').ReactNode }} props
 */
function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100/90 py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:py-2">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm font-medium leading-snug text-slate-800 sm:max-w-[62%] sm:text-right">{children}</dd>
    </div>
  );
}

/**
 * @param {{ title: string, children: import('react').ReactNode, className?: string }} props
 */
function Panel({ title, children, className = '' }) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const btnOutline =
  'inline-flex items-center justify-center rounded-md border border-[#00684a]/35 bg-white px-3.5 py-2 text-sm font-semibold text-[#00684a] shadow-sm transition-colors hover:border-[#00684a] hover:bg-[#00684a]/[0.06]';

/** Viewport-locked row on large screens: header, main padding, Documentation title row, extra bottom breathing room */
const docGridViewportLg =
  'lg:h-[calc(100dvh-9.1rem)] lg:max-h-[calc(100dvh-9.1rem)] lg:min-h-0 lg:flex-none lg:overflow-hidden';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [historyState, setHistoryState] = useState({ loading: true, error: null, events: [] });
  const [rejectionDialog, setRejectionDialog] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchDocument(id);
      if (cancelled) return;
      if (result.kind === 'redirect' || result.kind === 'unauthorized') {
        setState({ loading: false, error: null, payload: null });
        return;
      }
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, payload: null });
        return;
      }
      setState({ loading: false, error: null, payload: result.data });
      const docId = result.data?.document?.id;
      if (docId) {
        postNotificationsMarkDocumentRead(docId).then((r) => {
          if (r.kind === 'ok') {
            window.dispatchEvent(new Event('medsupply:notifications-refresh'));
          }
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) {
      setHistoryState({ loading: false, error: null, events: [] });
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setHistoryState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchDocumentHistory(id);
      if (cancelled) return;
      if (result.kind === 'redirect' || result.kind === 'unauthorized') {
        setHistoryState({ loading: false, error: null, events: [] });
        return;
      }
      if (result.kind === 'error') {
        setHistoryState({ loading: false, error: result.error, events: [] });
        return;
      }
      setHistoryState({ loading: false, error: null, events: result.data?.events ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) {
    return <LoadingState label="Loading document…" />;
  }

  if (state.error) {
    return (
      <ErrorState title="Could not open document" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  const doc = state.payload?.document;
  if (!doc) {
    return <ErrorState title="Document" message="Not found." onRetry={() => window.location.reload()} />;
  }

  const title = (doc.title || doc.original_filename || 'Document').toString();
  const viewUrl = `/documents/${doc.id}/view`;
  const downloadUrl = `/documents/${doc.id}/download`;
  const inlinePreviewOk = documentSupportsInlineBrowserPreview(doc);
  const ext = (doc.file_extension || '').toString().toUpperCase() || '—';
  const created = formatDate(doc.created_at);

  const backToList = (
    <Link
      to="/documents"
      className="text-xs font-medium text-slate-500 transition-colors hover:text-[#00684a] sm:text-sm"
    >
      ← Back to list
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col pb-6 lg:min-h-0 lg:overflow-hidden lg:pb-9">
      <div className="mb-3 flex shrink-0 flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Documentation</h1>
        <div className="sm:shrink-0">{backToList}</div>
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)] lg:gap-5 lg:items-stretch ${docGridViewportLg}`}
      >
        <div className="order-2 flex min-h-0 min-w-0 flex-col lg:order-1 lg:h-full lg:max-h-full lg:overflow-hidden">
          <Panel title="Document details" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                <dl className="px-4 pb-2 pt-1">
                  <DetailRow label="Title">{title}</DetailRow>
                  <DetailRow label="File name">{(doc.original_filename || '—').toString()}</DetailRow>
                  <DetailRow label="Document type">{(doc.document_type || '—').toString()}</DetailRow>
                  <DetailRow label="Format">{ext}</DetailRow>
                  <DetailRow label="File size">{formatFileSize(doc.file_size)}</DetailRow>
                  <DetailRow label="Organization">{(doc.company_name || '—').toString()}</DetailRow>
                  <DetailRow label="Uploaded by">
                    <span className="block sm:text-right">{(doc.owner_name || '—').toString()}</span>
                    {doc.owner_email ? (
                      <span className="mt-1 block text-xs font-normal text-slate-500 sm:text-right">
                        {(doc.owner_email || '').toString()}
                      </span>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="Status">
                    <span className="inline-flex justify-end sm:w-full [&_span]:px-2.5 [&_span]:py-1 [&_span]:text-sm">
                      <DocumentStatusBadge status={doc.approval_status} />
                    </span>
                  </DetailRow>
                  {String(doc.approval_status || '').toUpperCase() === 'REJECTED' ? (
                    <DetailRow label="Rejection reason">
                      <div className="flex items-start justify-end gap-2 sm:w-full">
                        <span className="line-clamp-2 text-right text-sm leading-snug text-slate-700 sm:max-w-[14rem]">
                          {(doc.approval_rejection_reason || '').toString().trim() || '—'}
                        </span>
                        <RejectionReasonIconButton
                          label="View full rejection reason"
                          onClick={() =>
                            setRejectionDialog({
                              documentTitle: title,
                              reason: (doc.approval_rejection_reason || '').toString(),
                            })
                          }
                        />
                      </div>
                    </DetailRow>
                  ) : null}
                  <DetailRow label="Date uploaded">{created}</DetailRow>
                </dl>
                {doc.description ? (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Description</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{doc.description}</p>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-100 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/documents/${doc.id}/edit`} className={btnOutline}>
                      Edit
                    </Link>
                    <a href={downloadUrl} className={btnOutline}>
                      Download
                    </a>
                    {inlinePreviewOk ? (
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-[#00684a] bg-[#00684a] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                      >
                        Open preview
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryModalOpen(true)}
                    className="shrink-0 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[#00684a] hover:decoration-[#00684a]"
                  >
                    View Document History
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="order-1 flex min-h-0 min-w-0 lg:order-2 lg:h-full lg:min-h-0 lg:max-h-full">
          <div className="flex h-full w-full min-h-[min(42vh,24rem)] flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:min-h-0">
            <div className="flex min-h-0 flex-1 bg-[#e8eaed]/60 p-1.5">
              <div className="h-full min-h-0 w-full overflow-hidden rounded-md bg-white shadow-inner ring-1 ring-slate-200/80">
                {inlinePreviewOk ? (
                  <iframe title="Document preview" src={viewUrl} className="h-full w-full border-0" />
                ) : (
                  <div className="flex h-full min-h-[min(42vh,18rem)] flex-col items-center justify-center gap-3 px-4 text-center">
                    <p className="max-w-sm text-sm text-slate-600">
                      In-browser preview isn&apos;t available for this file type (for example Word or Excel). Use{' '}
                      <strong className="font-semibold text-slate-800">Download</strong> when you want to open the file
                      on your device — nothing is downloaded automatically.
                    </p>
                    <a
                      href={downloadUrl}
                      className="inline-flex items-center justify-center rounded-md border border-[#00684a] bg-[#00684a] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                    >
                      Download file
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <RejectionReasonDialog
        open={!!rejectionDialog}
        documentTitle={rejectionDialog?.documentTitle}
        reason={rejectionDialog?.reason ?? ''}
        onClose={() => setRejectionDialog(null)}
      />

      <DocumentHistoryModal
        open={historyModalOpen}
        documentTitle={title}
        loading={historyState.loading}
        error={historyState.error}
        events={historyState.events}
        onClose={() => setHistoryModalOpen(false)}
      />
    </div>
  );
}
