'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type T = { id: number; msg: string; action?: string; onAction?: () => void; out?: boolean };
type Opts = { action?: string; onAction?: () => void; ms?: number };
const Ctx = createContext<(msg: string, o?: Opts) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const close = useCallback((id: number) => {
    setList((l) => l.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 250);
  }, []);
  const toast = useCallback((msg: string, o: Opts = {}) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, msg, action: o.action, onAction: o.onAction }]);
    setTimeout(() => close(id), o.ms ?? 4500);
  }, [close]);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast${t.out ? ' is-out' : ''}`}>
            <span>{t.msg}</span>
            {t.action && <button type="button" onClick={() => { t.onAction?.(); close(t.id); }}>{t.action}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
