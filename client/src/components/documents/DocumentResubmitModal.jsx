import { useEffect, useId, useRef, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { DOCUMENT_TYPES, DOCUMENT_TAG_OPTIONS } from '../../constants/documentsCatalog';
import { formatFileSize } from '../../lib/format';
import { documentSupportsInlineBrowserPreview } from '../../lib/documentPreview';

function IconEye({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconArrowUpTray({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Circular arrows — resubmit / send again (distinct from first-time upload). */
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

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Client admin: update metadata, tags, optional new file; returns to dashboard via returnTo.
 * @param {{ document: object | null, onClose: () => void }} props
 */
export default function DocumentResubmitModal({ document: doc, onClose }) {
  const titleId = useId();
  const [tagSlugs, setTagSlugs] = useState([]);
  const [replaceFileName, setReplaceFileName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteFormRef = useRef(null);

  useEffect(() => {
    if (!doc) return;
    const raw = (doc.tags || '').toString().trim();
    const slugs = raw ? raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
    setTagSlugs(slugs);
    setReplaceFileName('');
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.document.addEventListener('keydown', onKey);
    return () => window.document.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  function toggleTag(slug) {
    const lower = slug.toLowerCase();
    setTagSlugs((prev) => {
      const has = prev.map((s) => s.toLowerCase()).includes(lower);
      if (has) return prev.filter((s) => s.toLowerCase() !== lower);
      return [...prev, lower];
    });
  }

  const tagsValue = tagSlugs.join(', ');
  const currentType = (doc.document_type || '').toString();
  const typeInList = DOCUMENT_TYPES.includes(currentType);
  const selectDefault = typeInList ? currentType : currentType || DOCUMENT_TYPES[0];

  const viewUrl = `/documents/${doc.id}/view`;
  const downloadUrl = `/documents/${doc.id}/download`;
  const canInlinePreview = documentSupportsInlineBrowserPreview(doc);

  return (
    <>
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
          aria-label="Close"
          onClick={onClose}
        />
        <div className="relative z-10 flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                Update & resubmit
              </h2>
              <p className="mt-1 truncate text-sm text-slate-600" title={(doc.title || doc.original_filename || '').toString()}>
                {(doc.title || doc.original_filename || 'Document').toString()}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Saving sends the document back to <span className="font-medium text-slate-700">pending review</span>. Optional:
                attach a corrected file.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {canInlinePreview ? (
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <IconEye className="h-4 w-4 text-[#00684a]" aria-hidden />
                  Preview
                </a>
              ) : (
                <a
                  href={downloadUrl}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <IconDownload className="h-4 w-4 text-[#00684a]" aria-hidden />
                  Download
                </a>
              )}
            </div>

            <form
              key={doc.id}
              action={`/documents/${doc.id}/edit`}
              method="post"
              encType="multipart/form-data"
              className="space-y-4"
            >
              <input type="hidden" name="returnTo" value="/" />
              <input type="hidden" name="tags" value={tagsValue} />

              <div>
                <label htmlFor={`${titleId}-title`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </label>
                <input
                  id={`${titleId}-title`}
                  name="title"
                  type="text"
                  required
                  maxLength={255}
                  defaultValue={(doc.title || doc.original_filename || '').toString()}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                />
              </div>

              <div>
                <label htmlFor={`${titleId}-desc`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  id={`${titleId}-desc`}
                  name="description"
                  rows={3}
                  maxLength={2000}
                  defaultValue={(doc.description || '').toString()}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                />
              </div>

              <div>
                <label htmlFor={`${titleId}-dtype`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document type
                </label>
                <select
                  id={`${titleId}-dtype`}
                  name="documentType"
                  required
                  defaultValue={selectDefault}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
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
                      PDF, DOCX, JPG, PNG, XLSX, CSV — max 10MB. Skip this if you are only updating title, type, or tags. You
                      can also use <span className="font-medium text-slate-700">Remove document</span> below to delete this file
                      first, then upload a new one from the library.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`${titleId}-file`}
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#00684a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                      >
                        Choose replacement file
                      </label>
                      <input
                        id={`${titleId}-file`}
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-xs font-semibold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800"
                >
                  Remove document…
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00523c]"
                  >
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
              <input type="hidden" name="returnTo" value="/" />
            </form>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Remove this document?"
        message="This permanently deletes the file and its record. You can upload a new document afterward if needed."
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
    </>
  );
}

/** Compact actions for dashboard table: preview + open resubmit modal */
export function ManagerDocActionButtons({ row, onResubmit }) {
  const docTitle = (row.title || row.original_filename || 'Untitled').toString();
  const canInline = documentSupportsInlineBrowserPreview(row);
  const fileHref = canInline ? `/documents/${row.id}/view` : `/documents/${row.id}/download`;
  const fileActionLabel = canInline ? 'Preview' : 'Download';
  return (
    <div className="inline-flex flex-nowrap items-center gap-1.5">
      <a
        href={fileHref}
        {...(canInline ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#00684a] hover:text-[#00684a]"
        title={fileActionLabel}
        aria-label={`${fileActionLabel} ${docTitle}`}
      >
        {canInline ? <IconEye className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}
      </a>
      <button
        type="button"
        onClick={() => onResubmit(row)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#00684a] hover:text-[#00684a]"
        title="Resubmit for review"
        aria-label={`Resubmit for review: ${docTitle}`}
      >
        <IconResubmit className="h-4 w-4" />
      </button>
    </div>
  );
}
