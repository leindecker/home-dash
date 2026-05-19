'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { ThemeProvider, useTokens } from '@/lib/theme';
import Sidebar from '@/components/Sidebar';

function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pageBg, cardBg, cardBorder, textMain, textMuted } = useTokens();

  return (
    <div className="flex min-h-screen" style={{ background: pageBg }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar (hidden on md+) */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b md:hidden flex-shrink-0"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: textMuted }}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold" style={{ color: textMain }}>
            🏠 Meu Apartamento
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Shell>{children}</Shell>
    </ThemeProvider>
  );
}
