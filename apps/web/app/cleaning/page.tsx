'use client';

import { useTokens } from '@/lib/theme';
import VacuumCard from '@/components/VacuumCard';

export default function CleaningPage() {
  const { pageBg, textMain, textMuted } = useTokens();

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ background: pageBg }}>
      <div className="mb-6 max-w-[600px] mx-auto">
        <h1 className="text-xl font-bold" style={{ color: textMain }}>Limpeza</h1>
        <p className="text-sm mt-0.5" style={{ color: textMuted }}>Xiaomi Robot Vacuum S20 Pro</p>
      </div>

      <div className="max-w-[600px] mx-auto">
        <VacuumCard />
      </div>
    </div>
  );
}
