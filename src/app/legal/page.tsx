import { Suspense } from 'react';
import LegalPageContent from './LegalPageContent';

export default function LegalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0e] flex items-center justify-center text-zinc-400 text-sm">
        Loading legal information…
      </div>
    }>
      <LegalPageContent />
    </Suspense>
  );
}