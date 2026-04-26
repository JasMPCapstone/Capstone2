/** Grouped nav block in the app shell sidebar. */
export function SidebarSection({ title, hint, children, titleClassName }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-1 px-3">
        <p
          className={
            titleClassName ||
            'text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500'
          }
        >
          {title}
        </p>
        {hint ? <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{hint}</p> : null}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
