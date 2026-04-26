import { useEffect } from 'react';

/**
 * Reference checklist shown when the user clicks the help icon on upload.
 */
export default function DocumentChecklistModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id="checklist-modal-title" className="text-lg font-semibold text-slate-900">
            Document Checklist
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm leading-relaxed text-slate-600">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
            Complete each step on the upload page, then submit. Accepted file types: PDF, DOCX, JPG, XLSX, CSV (max 10MB).
          </p>
          <section>
            <p className="font-semibold text-slate-800">Required for document uploading:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Facility Accreditation Certificate (PDF)</li>
              <li>Procurement Policy Document (PDF/DOCX)</li>
              <li>Floor Plan or Storage Layout (PDF/JPG)</li>
              <li>Sample Inventory Report (CSV/XLSX)</li>
              <li>Compliance Certificates (e.g., ISO 13485, TGA) (PDF)</li>
              <li>Other relevant documents (please specify)</li>
            </ul>
          </section>

          <section>
            <p className="font-semibold text-slate-800">Optional:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>IT/Systems Integration Policy</li>
              <li>Recent Audit Reports</li>
              <li>Staff Training Certificates</li>
            </ul>
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
          <p>
            For assistance, email{' '}
            <a href="mailto:support@medsupply.com" className="font-medium text-sky-700 underline hover:text-sky-900">
              support@medsupply.com
            </a>{' '}
            or contact your MedSupply consultant.
          </p>
        </div>
      </div>
    </div>
  );
}
