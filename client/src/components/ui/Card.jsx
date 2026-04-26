/**
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

/**
 * @param {{ title: string, description?: string, action?: import('react').ReactNode, className?: string }} props
 */
export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * @param {{
 *   label: string
 *   value: import('react').ReactNode
 *   hint?: import('react').ReactNode
 *   variant?: 'default' | 'amber' | 'emerald' | 'rose'
 *   className?: string
 * }} props
 */
export function KpiCard({ label, value, hint, variant = 'default', className = '' }) {
  const variants = {
    default: 'border-slate-200 bg-white',
    amber: 'border-amber-200 bg-amber-50/80',
    emerald: 'border-emerald-200 bg-emerald-50/80',
    rose: 'border-rose-200 bg-rose-50/80',
  };
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${variants[variant]} ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint != null && hint !== '' ? (
        <div className="mt-2 text-xs text-slate-600 [&_a]:font-semibold">{hint}</div>
      ) : null}
    </div>
  );
}
