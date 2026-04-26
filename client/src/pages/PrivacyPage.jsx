import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { PrivacyContent } from '../content/HelpPrivacyContent';

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-full max-w-3xl space-y-6 overflow-y-auto px-4 py-4 sm:py-6">
      <PageHeader title="Privacy" subtitle="How we handle your session and documents" />
      <Card className="p-6 text-sm leading-relaxed text-slate-700">
        <PrivacyContent />
      </Card>
    </div>
  );
}
