export default function Spinner({ className = '' }) {
  return (
    <div
      className={`inline-flex h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#00684a] ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
