import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';

import TransferEntry from '@/exposes/Transfer';
import BeneficiariesEntry from '@/exposes/Beneficiaries';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// STANDALONE dev harness UI. This is ONLY used when the MFE runs on its own at
// :5172. It provides a minimal top bar + language switcher + routing so a
// developer can exercise both screens without the shell. The shell never
// renders this — it imports the exposed modules directly.
// ---------------------------------------------------------------------------

const LANGS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'mr', label: 'म(मराठी)' },
];

function TopBar() {
  const { i18n, t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-semibold">
            <Landmark className="h-5 w-5 text-primary" />
            SecureBank · Payments
          </span>
          <nav className="flex gap-4 text-sm">
            <NavLink
              to="/transfer"
              className={({ isActive }) =>
                cn('hover:text-primary', isActive && 'font-medium text-primary')
              }
            >
              {t('transfer.title')}
            </NavLink>
            <NavLink
              to="/beneficiaries"
              className={({ isActive }) =>
                cn('hover:text-primary', isActive && 'font-medium text-primary')
              }
            >
              {t('beneficiaries.title')}
            </NavLink>
          </nav>
        </div>
        {/* Language switcher — drives react-i18next (shared singleton). */}
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => void i18n.changeLanguage(l.code)}
              className={cn(
                'rounded px-2 py-1 text-xs',
                i18n.language === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="container py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/transfer" replace />} />
          <Route path="/transfer" element={<TransferEntry />} />
          <Route path="/beneficiaries" element={<BeneficiariesEntry />} />
        </Routes>
      </main>
    </div>
  );
}
