import { useEffect, useState } from 'react'

export default function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/health', { credentials: 'include' })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }))
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-[#00684a]">
          Med Supply Innovation
        </h1>
        <p className="mt-2 text-slate-600">
          React client shell (strangler migration). API health:{' '}
          <span className="font-semibold">
            {health === null ? '…' : health.ok ? 'ok' : 'unreachable'}
          </span>
        </p>
        <p className="mt-6 text-sm text-slate-500">
          Session-based flows remain on EJS routes. In development, run the API on port 3000 and{' '}
          <code className="rounded bg-white px-1 py-0.5 text-slate-800 shadow-sm">npm run dev</code>{' '}
          here so <code className="rounded bg-white px-1 py-0.5">/api</code> proxies to Express.
        </p>
      </main>
    </div>
  )
}
