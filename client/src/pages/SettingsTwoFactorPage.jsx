import TwoFactorSettingsPanel from '../components/TwoFactorSettingsPanel';

export default function SettingsTwoFactorPage() {
  return (
    <div className="mx-auto max-w-xl pb-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg sm:p-8">
        <TwoFactorSettingsPanel variant="page" />
      </div>
    </div>
  );
}
