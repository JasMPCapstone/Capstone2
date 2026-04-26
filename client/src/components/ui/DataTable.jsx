/**
 * @template T
 * @param {{
 *   columns: { id: string, header: string, className?: string, headerClassName?: string, cell: (row: T) => import('react').ReactNode }[]
 *   rows: T[]
 *   rowId: (row: T) => string | number
 *   emptyMessage?: string
 *   flush?: boolean
 * }} props
 */
export default function DataTable({ columns, rows, rowId, emptyMessage = 'No rows.', flush = false }) {
  if (rows.length === 0) {
    return (
      <div
        className={`px-6 py-14 text-center text-sm text-slate-500 ${
          flush ? '' : 'rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]'
        }`}
      >
        {emptyMessage}
      </div>
    );
  }

  const inner = (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col.id} className={`whitespace-nowrap px-4 py-3 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={String(rowId(row))} className="hover:bg-slate-50/90">
                {columns.map((col) => (
                  <td key={col.id} className={`px-4 py-3 align-middle ${col.className || ''}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );

  if (flush) {
    return inner;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]">{inner}</div>
  );
}
