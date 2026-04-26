/**
 * @param {{ title?: string, message: string, onRetry?: () => void }} props
 */
export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 rounded-lg bg-rose-900 px-3 py-1.5 text-sm text-white hover:bg-rose-800"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
