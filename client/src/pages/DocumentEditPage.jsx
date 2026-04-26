import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchDocument } from '../lib/api';
import { DOCUMENT_TYPES, DOCUMENT_TAG_OPTIONS } from '../constants/documentsCatalog';
import { formatFileSize } from '../lib/format';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';

function IconArrowUpTray({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function IconResubmit({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]';

export default function DocumentEditPage() {
  const { id } = useParams();
  const formId = useId();
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [tagSlugs, setTagSlugs] = useState([]);
  const [replaceFileName, setReplaceFileName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteFormRef = useRef(null);

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
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doc = state.payload?.document;
  useEffect(() => {
    if (!doc) return;
    const raw = (doc.tags || '').toString().trim();
    const slugs = raw ? raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
    setTagSlugs(slugs);
    setReplaceFileName('');
  }, [doc]);

  if (state.loading) {
    return <LoadingState label="Loading…" />;
  }

  if (state.error) {
    return (
      <ErrorState title="Cannot edit document" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  if (!doc) {
    return <ErrorState title="Document" message="Not found." onRetry={() => window.location.reload()} />;
  }

  const currentType = (doc.document_type || '').toString();
  const typeInList = DOCUMENT_TYPES.includes(currentType);
  const typeSelectDefault = typeInList ? currentType : currentType || DOCUMENT_TYPES[0];
  const tagsValue = tagSlugs.join(', ');
  const detailUrl = `/documents/${doc.id}`;

  function toggleTag(slug) {
    const lower = slug.toLowerCase();
    setTagSlugs((prev) => {
      const has = prev.map((s) => s.toLowerCase()).includes(lower);
      if (has) return prev.filter((s) => s.toLowerCase() !== lower);
      return [...prev, lower];
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="space-y-3">
        <Link
          to="/documents"
          className="inline-block text-xs font-medium text-slate-500 transition-colors hover:text-[#00684a]"
        >
          ← Back to list
        </Link>
        <PageHeader title="Edit document" subtitle={(doc.title || doc.original_filename || '').toString()} />
      </div>

      <Card className="overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <CardHeader
          title="Document details"
          description="Save to update the library record. A new file or changes after rejection return the item to pending review when your organization uses approvals."
        />
        <div className="px-5 pb-6 pt-2">
          <form
            key={doc.id}
            id={formId}
            action={`/documents/${doc.id}/edit`}
            method="post"
            encType="multipart/form-data"
            className="space-y-5"
          >
            <input type="hidden" name="returnTo" value={detailUrl} />
            <input type="hidden" name="tags" value={tagsValue} />

            <div>
              <label htmlFor={`${formId}-title`} className={labelClass}>
                Title
              </label>
              <input
                id={`${formId}-title`}
                name="title"
                type="text"
                required
                maxLength={255}
                defaultValue={(doc.title || doc.original_filename || '').toString()}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={`${formId}-desc`} className={labelClass}>
                Description
              </label>
              <textarea
                id={`${formId}-desc`}
                name="description"
                rows={4}
                maxLength={2000}
                defaultValue={(doc.description || '').toString()}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={`${formId}-dtype`} className={labelClass}>
                Document type
              </label>
              <select
                id={`${formId}-dtype`}
                name="documentType"
                required
                defaultValue={typeSelectDefault}
                className={fieldClass}
              >
                {!typeInList && currentType ? (
                  <option value={currentType}>{currentType} (current)</option>
                ) : null}
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className={labelClass}>Tags</p>
              <p className="mb-2 text-xs text-slate-500">Select all that apply (stored with the document in the library).</p>
              <div className="flex flex-wrap gap-2">
                {DOCUMENT_TAG_OPTIONS.map(({ slug, label }) => {
                  const on = tagSlugs.map((s) => s.toLowerCase()).includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleTag(slug)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on
                          ? 'border-[#00684a] bg-[#00684a]/10 text-[#00684a]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
              <div className="flex items-start gap-2">
                <IconArrowUpTray className="mt-0.5 h-5 w-5 shrink-0 text-[#00684a]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">File on record</p>
                  <div className="mt-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                    <p className="break-all text-sm font-medium text-slate-900">
                      {(doc.original_filename || doc.filename || '—').toString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(doc.file_size)}
                      {doc.file_extension ? ` · ${String(doc.file_extension).toUpperCase()}` : ''}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">Replace with a new file (optional)</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    PDF, DOCX, JPG, PNG, XLSX, CSV — max 10MB. Leave this empty to keep the current file. New uploads return to
                    pending review when approvals are enabled.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={`${formId}-file`}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#00684a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                    >
                      Choose replacement file
                    </label>
                    <input
                      id={`${formId}-file`}
                      name="document"
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setReplaceFileName(f ? f.name : '');
                      }}
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.csv,application/pdf,image/jpeg,image/png"
                    />
                    <span className="min-w-0 flex-1 text-xs text-slate-600">
                      {replaceFileName ? (
                        <span className="font-medium text-[#00684a]">Replacing with: {replaceFileName}</span>
                      ) : (
                        <span className="text-slate-500">Keeping the file on record (no new file selected).</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-xs font-semibold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800"
              >
                Remove document…
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={detailUrl}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  View details
                </Link>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                >
                  <IconResubmit className="h-4 w-4" aria-hidden />
                  Save changes
                </button>
              </div>
            </div>
          </form>

          <form
            ref={deleteFormRef}
            method="post"
            action={`/documents/${doc.id}/delete`}
            className="hidden"
            aria-hidden
          >
            <input type="hidden" name="returnTo" value="/documents" />
          </form>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Remove this document?"
        message="This permanently deletes the file and its record. You can upload a new document from the library if needed."
        confirmLabel="Delete document"
        cancelLabel="Keep"
        tone="rose"
        icon="trash"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          deleteFormRef.current?.submit();
        }}
      />
    </div>
  );
}
