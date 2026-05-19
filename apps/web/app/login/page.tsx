'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

// ─── Google SVG logo ─────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ─── Spinner ─────────────────────────────────────────────

function Spinner() {
  return (
    <span
      className="w-[18px] h-[18px] rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
      style={{ borderColor: '#71717a', borderTopColor: 'transparent' }}
    />
  );
}

// ─── Inner component (needs useSearchParams — wrapped in Suspense) ────

function LoginCard() {
  const searchParams = useSearchParams();
  const isAccessDenied = searchParams.get('error') === 'AccessDenied';
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    await signIn('google');
    // Navigation is handled by NextAuth redirect
  }

  const cardBg      = '#1A1D27';
  const border      = '1px solid #2A2D3A';
  const textMain    = '#ffffff';
  const textMuted   = '#71717a';
  const secondaryBg = '#13151F';

  return (
    <div
      style={{
        background: cardBg,
        border,
        borderRadius: 14,
        width: '100%',
        maxWidth: 360,
        padding: '36px 28px 28px',
      }}
    >
      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-7">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
          style={{ background: '#0D2A20' }}
        >
          🏠
        </div>
        <div className="text-center">
          <p style={{ fontSize: 18, fontWeight: 600, color: textMain, lineHeight: 1.2 }}>
            Meu Apartamento
          </p>
          <p style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>
            Painel de automação residencial
          </p>
        </div>
      </div>

      {/* Access denied error */}
      {isAccessDenied && (
        <div
          className="flex items-start gap-3 rounded-xl p-3.5 mb-5"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <ShieldAlert size={16} style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#F87171' }}>Acesso negado</p>
            <p style={{ fontSize: 12, color: '#FCA5A5', marginTop: 2 }}>
              Esta conta Google não está autorizada.
            </p>
          </div>
        </div>
      )}

      {/* Info box */}
      {!isAccessDenied && (
        <div
          className="flex items-start gap-3 rounded-xl p-3.5 mb-5"
          style={{ background: secondaryBg, border }}
        >
          <AlertTriangle size={14} style={{ color: '#60A5FA', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: textMuted, lineHeight: 1.5 }}>
            Acesso restrito. Apenas contas autorizadas conseguem entrar.
          </p>
        </div>
      )}

      {/* Google button */}
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl transition-all disabled:opacity-60"
        style={{
          background: secondaryBg,
          border: `1.5px solid ${loading ? '#2A2D3A' : '#2A2D3A'}`,
          padding: '11px 16px',
          color: textMain,
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.borderColor = '#4285F4'); }}
        onMouseLeave={(e) => { (e.currentTarget.style.borderColor = '#2A2D3A'); }}
      >
        {loading ? <Spinner /> : <GoogleLogo />}
        <span>{loading ? 'Redirecionando…' : isAccessDenied ? 'Tentar com outra conta' : 'Entrar com Google'}</span>
      </button>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-3 mt-6">
        {[
          { emoji: '🛡️', label: 'Acesso restrito' },
          { emoji: '🔒', label: 'Criptografado' },
          { emoji: '👁️', label: 'Privado' },
        ].map(({ emoji, label }) => (
          <span
            key={label}
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: '#3f3f46' }}
          >
            {emoji} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0F1117' }}
    >
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
