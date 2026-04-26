import { documentSupportsInlineBrowserPreview } from '../lib/documentPreview';

/**
 * Full-screen modal: iframe to /documents/:id/view for types the browser can show inline;
 * otherwise a message + Download only (no automatic file fetch).
 */
export default function DocumentPreviewModal({ documentId, title, fileType, fileExtension, onClose }) {
  if (documentId == null) return null;

  const docShape = { file_type: fileType, file_extension: fileExtension };
  const inlineOk = documentSupportsInlineBrowserPreview(docShape);
  const viewUrl = `/documents/${documentId}/view`;
  const downloadUrl = `/documents/${documentId}/download`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id="doc-preview-title" className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {title || 'Document preview'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-2">
          {inlineOk ? (
            <iframe
              title="Document preview"
              src={viewUrl}
              className="h-[min(75vh,720px)] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex h-[min(75vh,720px)] flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white px-6 text-center">
              <p className="max-w-md text-sm text-slate-600">
                In-browser preview isn&apos;t available for this file type (for example Word or Excel). Nothing was
                downloaded automatically — use the button below when you want a copy.
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center justify-center rounded-md border border-[#00684a] bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
              >
                Download file
              </a>
            </div>
          )}
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
          {inlineOk
            ? 'Preview uses the same access rules as download. Some formats may not display inline.'
            : 'Download uses the same access rules as the document library.'}
        </p>
      </div>
    </div>
  );
}
