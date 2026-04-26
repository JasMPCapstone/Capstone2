import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const sent = searchParams.get('sent') === '1';
  const message = useMemo(() => (searchParams.get('message') || '').trim(), [searchParams]);
  const err = searchParams.get('error') === '1';

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the email address for your account. If it&apos;s registered and active, we&apos;ll email you a link to set a new
          password. The link expires in 1 hour.
        </p>

        {sent ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            If that email is on file, we&apos;ve sent a message with a reset link. Check your inbox and spam folder. You can
            close this page.
          </div>
        ) : null}

        {message && err ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">{message}</div>
        ) : null}

        {!sent ? (
          <form method="post" action="/forgot-password" className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#00684a] py-2.5 text-sm font-semibold text-white hover:bg-[#00523c]"
            >
              Send reset link
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-[#00684a] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
