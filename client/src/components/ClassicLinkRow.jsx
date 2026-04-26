import { Link } from 'react-router-dom';

/** Settings row linking to another in-app route. */
export default function ClassicLinkRow({ to, children }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
    >
      <span>{children}</span>
    </Link>
  );
}
