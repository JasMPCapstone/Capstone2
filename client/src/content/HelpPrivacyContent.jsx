const iconClass = 'h-6 w-6 text-[#00684a]';

function IconInfo() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 4v10M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h6" strokeLinecap="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function HelpPanel({ icon, title, children }) {
  return (
    <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </article>
  );
}

/** Shared help copy for the full Help route and Settings modal. */
export function HelpCentreContent() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <HelpPanel icon={<IconInfo />} title="Getting Started">
        <p>
          Accounts are created by your organization (not self-registration). After your first sign-in you will set a
          permanent password, complete your profile, and turn on two-factor authentication. Then use the{' '}
          <strong className="font-semibold text-slate-800">Dashboard</strong>,{' '}
          <strong className="font-semibold text-slate-800">Upload Document</strong>, and{' '}
          <strong className="font-semibold text-slate-800">My Documents</strong> (or{' '}
          <strong className="font-semibold text-slate-800">Company documents</strong> if you are a client admin).
        </p>
      </HelpPanel>
      <HelpPanel icon={<IconUpload />} title="Uploading Documents">
        <p>
          Go to <strong className="font-semibold text-slate-800">Upload Document</strong> and follow the steps: choose
          document type, upload the file, and add details (title, tag, description). Supported formats include PDF,
          Word (.doc, .docx), images, and CSV.
        </p>
      </HelpPanel>
      <HelpPanel icon={<IconDocument />} title="Document Types & Tags">
        <p>
          Select the appropriate document type (e.g. Invoice, Contract, Certificate) and tag (e.g. Financial,
          Compliance, Other) when uploading. Use the checklist (&quot;?&quot; icon) for guidance on required documents.
        </p>
      </HelpPanel>
      <HelpPanel icon={<IconLock />} title="Security & 2FA">
        <p>
          Clients and client admins must use two-factor authentication after completing their profile. Open{' '}
          <strong className="font-semibold text-slate-800">Edit Profile</strong> (pencil on your dashboard card) and use
          the <strong className="font-semibold text-slate-800">2FA</strong> button, or go to the two-factor settings page
          when the system prompts you.
        </p>
      </HelpPanel>
    </div>
  );
}

export function PrivacyContent() {
  return (
    <p>
      This portal uses secure sessions and stores documents according to your organization&apos;s policies. Do not share
      your password. Sign out on shared devices.
    </p>
  );
}
