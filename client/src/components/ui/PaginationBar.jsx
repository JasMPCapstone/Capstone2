/**
 * Returns page numbers and ellipsis markers for compact pagination UI.
 * @param {number} currentPage 1-based
 * @param {number} totalPages
 * @returns {(number|'ellipsis')[]}
 */
export function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ];
}

/**
 * @param {{
 *   currentPage: number,
 *   totalPages: number,
 *   totalRows: number,
 *   pageSize: number,
 *   onPageChange: (page: number) => void,
 *   className?: string,
 * }} props
 */
export default function PaginationBar({ currentPage, totalPages, totalRows, pageSize, onPageChange, className = '' }) {
  if (totalRows <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);
  const items = getPaginationItems(currentPage, totalPages);
  const btnClass =
    'min-w-[2.25rem] rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
  const activeClass = 'border-[#00684a] bg-[#00684a] text-white shadow-sm hover:bg-[#005a40]';

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-slate-600">
        Showing{' '}
        <span className="font-medium tabular-nums">{start}</span>
        –
        <span className="font-medium tabular-nums">{end}</span> of <span className="font-medium tabular-nums">{totalRows}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={btnClass}
        >
          Previous
        </button>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Page">
          {items.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1 text-sm text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={`${btnClass} ${item === currentPage ? activeClass : ''}`}
              >
                {item}
              </button>
            )
          )}
        </nav>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={btnClass}
        >
          Next
        </button>
      </div>
    </div>
  );
}
