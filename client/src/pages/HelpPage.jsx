import PageHeader from '../components/ui/PageHeader';
import { HelpCentreContent } from '../content/HelpPrivacyContent';

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-full max-w-5xl space-y-6 overflow-y-auto px-4 py-4 sm:py-6">
      <PageHeader title="Help" subtitle="MedSupply Innovations Management Portal" />
      <HelpCentreContent />
    </div>
  );
}
