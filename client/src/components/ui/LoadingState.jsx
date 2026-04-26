import Spinner from '../Spinner';

/**
 * @param {{ label?: string }} props
 */
export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}
