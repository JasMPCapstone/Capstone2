import { useCallback, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import DocumentChecklistModal from '../components/DocumentChecklistModal';
import { DOCUMENT_TYPES, DOCUMENT_TAG_OPTIONS } from '../constants/documentsCatalog';

function stepBadge(n) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00684a] text-sm font-bold text-white">
      {n}
    </span>
  );
}

export default function DocumentUploadPage() {
  const [searchParams] = useSearchParams();
  const error = (searchParams.get('error') || '').trim();
  const [tagSlugs, setTagSlugs] = useState([]);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function toggleTag(slug) {
    setTagSlugs((prev) => {
      const lower = slug.toLowerCase();
      const has = prev.map((s) => s.toLowerCase()).includes(lower);
      if (has) return prev.filter((s) => s.toLowerCase() !== lower);
      return [...prev, lower];
    });
  }

  const tagsValue = tagSlugs.join(', ');

  const applyFile = useCallback((file) => {
    if (!file || !fileInputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    setFileName(file.name);
  }, []);

  function onFileInputChange(e) {
    const f = e.target.files?.[0];
    if (f) setFileName(f.name);
    else setFileName('');
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) applyFile(f);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload documents</h1>
            <button
              type="button"
              onClick={() => setChecklistOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-[#00684a] hover:text-[#00684a]"
              aria-label="Upload tips and document checklist"
              title="What to upload"
            >
              <span className="text-lg font-bold leading-none">?</span>
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Use the steps below or open the checklist with the ? icon.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0 shadow-sm">
        <form action="/documents/upload" method="post" encType="multipart/form-data" className="divide-y divide-slate-200">
          <input type="hidden" name="tags" value={tagsValue} />

          {/* Step 1 */}
          <section className="p-5 sm:p-6">
            <div className="flex gap-3">
              {stepBadge(1)}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">Select document type</h2>
                <p className="mt-0.5 text-sm text-slate-500">Choose the category that best matches this upload.</p>
                <label htmlFor="documentType" className="sr-only">
                  Document type
                </label>
                <select
                  id="documentType"
                  name="documentType"
                  required
                  className="mt-4 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose your document type
                  </option>
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="p-5 sm:p-6">
            <div className="flex gap-3">
              {stepBadge(2)}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">Upload file</h2>
                <p className="mt-0.5 text-sm text-slate-500">Drag a file here or browse from your device.</p>

                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`mt-4 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                    dragOver
                      ? 'border-[#00684a] bg-emerald-50/80'
                      : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="document"
                    name="document"
                    type="file"
                    required
                    onChange={onFileInputChange}
                    className="sr-only"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.csv,application/pdf,image/jpeg,image/png"
                  />
                  <label
                    htmlFor="document"
                    className="mx-auto flex max-w-sm cursor-pointer flex-col items-center gap-2"
                  >
                    <svg
                      className="h-10 w-10 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden
                    >
                      <path d="M12 16V4m0 0l4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 20h16" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm font-medium text-slate-700">
                      Drag and drop a file here <span className="font-normal text-slate-500">or</span>
                    </p>
                    <span className="rounded-lg bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005a40]">
                      Browse files
                    </span>
                    <p className="text-xs text-slate-500">PDF, DOCX, JPG, XLSX, CSV (max 10MB)</p>
                  </label>
                  {fileName ? (
                    <p className="mx-auto mt-3 max-w-full truncate rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[#00684a] ring-1 ring-slate-200">
                      Selected: {fileName}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section className="p-5 sm:p-6">
            <div className="flex gap-3">
              {stepBadge(3)}
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Document details</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Title and tags help others find this in the library.</p>
                </div>

                <div>
                  <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
                    Document title
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={255}
                    placeholder="Enter document title"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
                    Description <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={2000}
                    placeholder="Enter document description"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Tags</p>
                  <p className="mb-2 text-xs text-slate-500">Select any that apply — they power filters in the library.</p>
                  <div className="flex flex-wrap gap-2">
                    {DOCUMENT_TAG_OPTIONS.map((opt) => {
                      const active = tagSlugs.map((s) => s.toLowerCase()).includes(opt.slug);
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => toggleTag(opt.slug)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                            active
                              ? 'bg-[#00684a] text-white ring-[#00684a]'
                              : 'bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 bg-slate-50/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-xs text-slate-500">
              By uploading you confirm this file complies with your organization&apos;s policies.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/documents"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full min-w-[12rem] items-center justify-center rounded-lg bg-[#00684a] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#005a40] sm:w-auto"
              >
                {fileName ? `Upload “${fileName.length > 28 ? `${fileName.slice(0, 28)}…` : fileName}”` : 'Upload document'}
              </button>
            </div>
          </div>
        </form>
      </Card>

      <DocumentChecklistModal open={checklistOpen} onClose={() => setChecklistOpen(false)} />
    </div>
  );
}
