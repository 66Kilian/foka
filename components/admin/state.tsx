'use client';
// Az admin közös állapota: a szerkesztett (még nem közzétett) tartalom, a napi állapot és a képfeltöltés.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { prepareImage } from '@/lib/image';
import type { Content, Img, Status } from '@/lib/types';
import type { Uploader } from './forms';

type Ctx = {
  draft: Content;
  published: Content;
  dirty: boolean;
  saving: boolean;
  saveError: string;
  update: (fn: (d: Content) => Content) => void;
  publish: (force?: boolean) => Promise<boolean>;
  discard: () => void;
  status: Status;
  setStatus: (s: Status) => void;
  patchStatus: (p: Partial<Status>) => Promise<void>;
  upload: Uploader;
  library: NonNullable<Img>[];
  toast: (msg: string, o?: { action?: string; onAction?: () => void; ms?: number }) => void;
};

const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('AdminCtx hiányzik');
  return c;
};

const DRAFT_KEY = 'zolgiz_admin_draft';
export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export function AdminProvider({ initial, initialStatus, toast, children }: {
  initial: Content; initialStatus: Status; toast: Ctx['toast']; children: React.ReactNode;
}) {
  const [published, setPublished] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [uploaded, setUploaded] = useState<NonNullable<Img>[]>([]);
  const restored = useRef(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(published), [draft, published]);

  // A félkész szerkesztés túléli az oldal újratöltését (ugyanazon a gépen)
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { base: number; draft: Content };
      if (saved.base === initial.updatedAt && JSON.stringify(saved.draft) !== JSON.stringify(initial)) {
        setDraft(saved.draft);
        toast('Visszatöltöttük a még nem közzétett módosításaidat.', { ms: 6000 });
      }
    } catch { /* */ }
  }, [initial, toast]);
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: published.updatedAt, draft }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* */ }
  }, [draft, dirty, published.updatedAt]);

  // Figyelmeztetés, ha mentetlen módosítással zárná be a lapot
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = useCallback((fn: (d: Content) => Content) => { setSaveError(''); setDraft((d) => fn(d)); }, []);

  const publish = useCallback(async (force = false) => {
    setSaving(true);
    setSaveError('');
    try {
      const saved = await api<Content>('/api/admin/content', { method: 'PUT', json: { content: draft, baseUpdatedAt: published.updatedAt, force } });
      setPublished(saved);
      setDraft(saved);
      toast('Közzétéve – a vásárlói oldal már az újat mutatja.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'A mentés nem sikerült.';
      setSaveError(msg);
      if (e instanceof ApiError && e.status === 409) {
        toast(msg, { action: 'Felülírom', ms: 12000, onAction: () => { void publish(true); } });
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, published.updatedAt, toast]);

  const discard = useCallback(() => setDraft(published), [published]);

  const patchStatus = useCallback(async (p: Partial<Status>) => {
    const prev = status;
    setStatus((s) => ({ ...s, ...p }));
    try {
      setStatus(await api<Status>('/api/admin/status', { method: 'PATCH', json: p }));
    } catch (e) {
      setStatus(prev);
      toast(e instanceof Error ? `Nem sikerült menteni: ${e.message}` : 'Nem sikerült menteni.');
    }
  }, [status, toast]);

  const upload = useCallback<Uploader>(async (file) => {
    const { full, thumb } = await prepareImage(file);
    const fd = new FormData();
    fd.append('full', full, 'full');
    fd.append('thumb', thumb, 'thumb');
    const r = await api<NonNullable<Img> & { temporary?: boolean }>('/api/admin/upload', { method: 'POST', body: fd });
    if (r.temporary) toast('Figyelem: nincs képtárhely bekötve (Vercel Blob), a kép csak ideiglenesen látszik. Lásd README.', { ms: 9000 });
    const img = { src: r.src, thumb: r.thumb };
    setUploaded((u) => [img, ...u]);
    return img;
  }, [toast]);

  const library = useMemo(() => {
    const seen = new Map<string, NonNullable<Img>>();
    const add = (i: Img) => { if (i && !seen.has(i.src)) seen.set(i.src, i); };
    uploaded.forEach(add);
    draft.items.forEach((i) => add(i.image));
    draft.offers.forEach((o) => add(o.image));
    draft.hero.forEach((h) => add(h.image));
    add(draft.brand.logo ?? null);
    add(draft.seo.image ?? null);
    return [...seen.values()];
  }, [draft, uploaded]);

  const value: Ctx = { draft, published, dirty, saving, saveError, update, publish, discard, status, setStatus, patchStatus, upload, library, toast };
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}
