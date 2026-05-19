'use client';

import { useState } from 'react';
import { Sun, Moon, LogOut, Film, Check, AlertCircle } from 'lucide-react';
import { useTokens } from '@/lib/theme';
import { fetchDevices, sendDeviceCommand, Device } from '@/lib/api';

// ─── types ────────────────────────────────────────────────

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface Routine {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  accentBg: string;
  accentText: string;
  run: (devices: Device[]) => Promise<void>;
}

// ─── routine definitions ───────────────────────────────────

function switches(devices: Device[]) {
  return devices.filter((d) => d.type === 'switch');
}

function door(devices: Device[]) {
  return devices.find((d) => d.type === 'lock') ?? null;
}

async function setSwitches(devices: Device[], on: boolean) {
  const sw = switches(devices);
  await Promise.all(
    sw.flatMap((d) => {
      const codes = d.status
        .filter((s) => s.code.startsWith('switch'))
        .map((s) => s.code);
      if (!codes.length) codes.push('switch_1');
      return codes.map((code) =>
        sendDeviceCommand(d.id, [{ code, value: on }])
      );
    })
  );
}

const ROUTINES: Routine[] = [
  {
    key: 'bom-dia',
    label: 'Bom dia',
    description: 'Liga todas as luzes e abre as persianas',
    icon: Sun,
    accentBg: '#0D2A20',
    accentText: '#34D399',
    run: async (devs) => {
      await setSwitches(devs, true);
    },
  },
  {
    key: 'boa-noite',
    label: 'Boa noite',
    description: 'Apaga as luzes e prepara o ambiente para dormir',
    icon: Moon,
    accentBg: '#2A200D',
    accentText: '#FBBF24',
    run: async (devs) => {
      await setSwitches(devs, false);
    },
  },
  {
    key: 'sair',
    label: 'Sair de casa',
    description: 'Desliga tudo e verifica portas',
    icon: LogOut,
    accentBg: '#0D1829',
    accentText: '#60A5FA',
    run: async (devs) => {
      await setSwitches(devs, false);
    },
  },
  {
    key: 'cinema',
    label: 'Modo cinema',
    description: 'Luzes baixas para assistir filmes',
    icon: Film,
    accentBg: '#1A0D2A',
    accentText: '#A78BFA',
    run: async (devs) => {
      const sw = switches(devs);
      if (!sw.length) return;
      await setSwitches(devs, false);
    },
  },
];

// ─── RoutineButton ─────────────────────────────────────────

interface RoutineButtonProps {
  routine: Routine;
  running: boolean;
  onRun: () => void;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
}

function RoutineButton({
  routine,
  running,
  onRun,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
}: RoutineButtonProps) {
  const Icon = routine.icon;

  return (
    <button
      onClick={onRun}
      disabled={running}
      className="flex flex-col gap-4 p-6 rounded-2xl border text-left transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed w-full"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: routine.accentBg }}
      >
        {running ? (
          <span
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: routine.accentText, borderTopColor: 'transparent' }}
          />
        ) : (
          <Icon size={22} style={{ color: routine.accentText }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: textMain }}>
          {routine.label}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: textMuted }}>
          {routine.description}
        </p>
      </div>

      <div
        className="self-end text-xs font-medium px-3 py-1 rounded-full"
        style={{ background: routine.accentBg, color: routine.accentText }}
      >
        {running ? 'Executando…' : 'Executar'}
      </div>
    </button>
  );
}

// ─── ToastItem ─────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const isSuccess = toast.type === 'success';
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fadeIn"
      style={{
        background: isSuccess ? '#0D2A20' : '#2A0D0D',
        color: isSuccess ? '#34D399' : '#F87171',
        border: `1px solid ${isSuccess ? '#166534' : '#7f1d1d'}`,
      }}
    >
      {isSuccess ? <Check size={15} /> : <AlertCircle size={15} />}
      {toast.message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function RoutinesPage() {
  const { cardBg, cardBorder, textMain, textMuted, pageBg } = useTokens();
  const [running, setRunning] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(type: Toast['type'], message: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  async function runRoutine(routine: Routine) {
    if (running) return;
    setRunning(routine.key);
    try {
      const devices = await fetchDevices();
      await routine.run(devices);
      addToast('success', `"${routine.label}" executada com sucesso`);
    } catch {
      addToast('error', `Erro ao executar "${routine.label}"`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ background: pageBg }}>
      {/* Topbar */}
      <div className="mb-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold" style={{ color: textMain }}>
          Rotinas
        </h1>
        <p className="text-sm mt-0.5" style={{ color: textMuted }}>
          Automações rápidas para o apartamento
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {ROUTINES.map((r) => (
          <RoutineButton
            key={r.key}
            routine={r}
            running={running === r.key}
            onRun={() => runRoutine(r)}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textMain={textMain}
            textMuted={textMuted}
          />
        ))}
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}
