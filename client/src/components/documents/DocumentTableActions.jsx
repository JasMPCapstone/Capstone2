import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../ui/ConfirmDialog';

const icon = 'inline-block h-[0.875rem] w-[0.875rem] shrink-0';

function IconEye({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {{ id: number, showEdit?: boolean, showDelete?: boolean, onPreview?: () => void }} props
 */
export default function DocumentTableActions({ id, showEdit = true, showDelete = true, onPreview }) {
  const deleteFormRef = useRef(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const previewControl =
    typeof onPreview === 'function' ? (
      <button
        type="button"
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#00684a]"
        title="Preview"
        aria-label="Preview document"
        onClick={onPreview}
      >
        <IconEye className={icon} />
      </button>
    ) : (
      <Link
        to={`/documents/${id}`}
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#00684a]"
        title="View"
        aria-label="View document"
      >
        <IconEye className={icon} />
      </Link>
    );

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {previewControl}
        {showEdit ? (
          <Link
            to={`/documents/${id}/edit`}
            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#00684a]"
            title="Edit"
            aria-label="Edit document"
          >
            <IconPencil className={icon} />
          </Link>
        ) : null}
        {showDelete ? (
          <form ref={deleteFormRef} method="post" action={`/documents/${id}/delete`} className="inline">
            <button
              type="button"
              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
              title="Delete"
              aria-label="Delete document"
              onClick={() => setDeleteOpen(true)}
            >
              <IconTrash className={icon} />
            </button>
          </form>
        ) : null}
      </div>
      {showDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          title="Delete document?"
          message="This document will be permanently deleted and cannot be recovered."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          tone="rose"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            deleteFormRef.current?.submit();
          }}
        />
      ) : null}
    </>
  );
}
