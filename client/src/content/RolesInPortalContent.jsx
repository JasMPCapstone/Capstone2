/** Explanatory copy for system roles (Settings modal and any future reuse). */
export function RolesInPortalContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700">
      <p>
        <strong className="text-slate-900">System admin</strong> — Full access: all organizations, users, activity log, and
        document approval across the system.
      </p>
      <p>
        <strong className="text-slate-900">Client Admin</strong> — Manages one organization: team members, password
        resets for clients, and org-scoped documents.
      </p>
      <p>
        <strong className="text-slate-900">Client</strong> — Uploads and manages their own documents within the
        organization&apos;s policies.
      </p>
      <p className="text-slate-500">
        Legacy labels <code className="rounded bg-slate-100 px-1">ADMIN</code> may appear in older data; new accounts use
        the roles above.
      </p>
    </div>
  );
}
