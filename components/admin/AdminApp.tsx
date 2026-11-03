'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../Icon';
import { ToastProvider, useToast } from '../toast';
import { AdminProvider, useAdmin } from './state';
import { ACTIVE, Board, type Patch } from './Board';
import { DayPane, MenuPane, OffersPane, SettingsPane } from './Panes';
import { VisualEditor } from './VisualEditor';
import type { EditTarget } from '../site/edit';
import { api, ApiError, chime, unlockAudio } from '@/lib/client';
import { hhmmss } from '@/lib/format';
import type { Content, Order, Status } from '@/lib/types';

type Tab = 'pult' | 'szerkeszto' | 'ajanlatok' | 'etlap' | 'beallitasok' | 'forgalom';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'pult', label: 'Pult', icon: 'bell' },
  { id: 'szerkeszto', label: 'Oldal szerkesztő', icon: 'edit' },
  { id: 'ajanlatok', label: 'Napi ajánlat', icon: 'star' },
  { id: 'etlap', label: 'Étlap', icon: 'pizza' },
  { id: 'beallitasok', label: 'Beállítások', icon: 'gear' },
  { id: 'forgalom', label: 'Forgalom', icon: 'chart' },
];

export function AdminApp({ content, status }: { content: Content; status: Status }) {
  return (
    <div className="adm">
      <ToastProvider>
        <WithToast content={content} status={status} />
      </ToastProvider>
    </div>
  );
}

function WithToast({ content, status }: { content: Content; status: Status }) {
  const toast = useToast();
  return <AdminProvider initial={content} initialStatus={status} toast={toast}><Shell /></AdminProvider>;
}

function Clock() {
  const [t, setT] = useState('');
  useEffect(() => { const f = () => setT(hhmmss(Date.now())); f(); const i = setInterval(f, 1000); return () => clearInterval(i); }, []);
  return <time className="bar__clock" suppressHydrationWarning>{t}</time>;
}

function Shell() {
  const { status, setStatus, patchStatus, dirty, saving, saveError, publish, discard, toast } = useAdmin();
  const [tab, setTabState] = useState<Tab>('pult');
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(false);
  const [netErr, setNetErr] = useState('');
  const [storage, setStorage] = useState('redis');
  const [days, setDays] = useState(1);
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(false);
  soundRef.current = sound;

  // fül ↔ URL (#pult), hogy újratöltés után is ott maradjon
  useEffect(() => {
    const h = location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === h)) setTabState(h);
  }, []);
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, '', `#${t}`); };

  const ring = useCallback(() => { if (soundRef.current) chime([880, 1174.66, 880, 1174.66], 0.18); }, []);

  // Rendelések: pár másodpercenként frissül
  const pullDays = tab === 'forgalom' ? days : 1;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const pull = async () => {
      try {
        const r = await api<{ orders: Order[]; status: Status; storage: string }>(`/api/admin/orders?days=${pullDays}`);
        if (!alive) return;
        setNetErr('');
        setStorage(r.storage);
        setStatus(r.status);
        const ids = new Set(r.orders.map((o) => o.id));
        if (seen.current) {
          const nw = r.orders.filter((o) => !seen.current!.has(o.id));
          if (nw.length) {
            setFresh(new Set(nw.map((o) => o.id)));
            if (nw.some((o) => o.status === 'NEW')) {
              ring();
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                try { new Notification('Új rendelés!', { body: nw.map((o) => `#${o.code} ${o.customerName}`).join(', ') }); } catch { /* */ }
              }
            }
          }
        }
        seen.current = ids;
        setOrders(r.orders);
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) { location.href = '/admin/login'; return; }
        setNetErr('Megszakadt a kapcsolat – újrapróbálkozunk…');
      }
      timer = setTimeout(pull, document.hidden ? 10000 : 4000);
    };
    pull();
    return () => { alive = false; clearTimeout(timer); };
  }, [pullDays, ring, setStatus]);

  // Amíg van el nem fogadott rendelés, 15 mp-enként újra szól
  useEffect(() => {
    const t = setInterval(() => { if (orders.some((o) => o.status === 'NEW')) ring(); }, 15000);
    return () => clearInterval(t);
  }, [orders, ring]);

  // A képernyő ne aludjon el a konyhai tableten
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const req = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* */ } };
    void req();
    const onVis = () => { if (!document.hidden && (!lock || lock.released)) void req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); };
  }, []);

  const change = useCallback(async (o: Order, p: Patch, msg: string) => {
    const prev = Object.fromEntries(Object.keys(p).map((k) => [k, (o as Record<string, unknown>)[k] ?? null])) as Patch;
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...p } : x)));
    try {
      const saved = await api<Order>(`/api/admin/orders/${o.id}`, { method: 'PATCH', json: p });
      setOrders((list) => list.map((x) => (x.id === o.id ? saved : x)));
    } catch (e) {
      setOrders((list) => list.map((x) => (x.id === o.id ? o : x)));
      toast(`Nem sikerült menteni: ${e instanceof Error ? e.message : 'hiba'}. Próbáld újra.`);
      return false;
    }
    toast(msg, {
      action: 'Visszavonás', ms: 6000,
      onAction: () => {
        setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...prev } : x)));
        api(`/api/admin/orders/${o.id}`, { method: 'PATCH', json: prev }).catch(() => toast('A visszavonás nem sikerült.'));
      },
    });
    return true;
  }, [toast]);

  const soundOn = () => {
    unlockAudio();
    setSound(true);
    chime([660, 880]);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };

  const activeCount = orders.filter((o) => ACTIVE.includes(o.status)).length;
  const newCount = orders.filter((o) => o.status === 'NEW').length;
  useEffect(() => { document.title = newCount ? `(${newCount}) Új rendelés – Admin` : 'Admin – rendelések és oldal'; }, [newCount]);

  return (
    <>
      <header className="bar">
        <div className="bar__brand"><span className="login__mark login__mark--sm" aria-hidden="true">Z</span><b>Admin</b></div>
        <nav className="tabs" aria-label="Admin részei">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /><span>{t.label}</span>
              {t.id === 'pult' && activeCount > 0 && <span className={`tabs__n${newCount ? ' is-new' : ''}`}>{activeCount}</span>}
            </button>
          ))}
        </nav>
        <div className="bar__tools">
          <button className={`ktoggle${status.open ? '' : ' is-off'}`} type="button" aria-pressed={status.open}
            onClick={() => {
              if (status.open && !confirm('Lezárod az online rendelést? A vásárlók nem tudnak rendelni, amíg újra ki nem nyitod.')) return;
              void patchStatus({ open: !status.open });
            }}>
            <span className="ktoggle__dot" /><span>Rendelésfogadás: {status.open ? 'NYITVA' : 'ZÁRVA'}</span>
          </button>
          <label className="kselect">
            <span>Plusz várakozás</span>
            <select value={String(status.extraWait || 0)} onChange={(e) => patchStatus({ extraWait: +e.target.value })}>
              {[0, 10, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m ? `+${m} perc` : 'nincs'}</option>)}
            </select>
          </label>
          <button className={`kicon${sound ? ' is-on' : ''}`} type="button" aria-pressed={sound} aria-label={sound ? 'Hang kikapcsolása' : 'Hang bekapcsolása'} onClick={() => (sound ? setSound(false) : soundOn())}>
            <Icon name={sound ? 'volume' : 'mute'} />
          </button>
          <Clock />
          <button className="kicon" type="button" aria-label="Kijelentkezés" onClick={async () => {
            if (dirty && !confirm('Van még nem közzétett módosításod. Biztosan kilépsz?')) return;
            await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
            location.href = '/admin/login';
          }}><Icon name="logout" /></button>
        </div>
      </header>

      {!sound && (
        <div className="soundwarn">
          <Icon name="volume" />
          <span>A hang ki van kapcsolva – így nem hallod az új rendeléseket.</span>
          <button className="kbtn kbtn--go" type="button" onClick={soundOn}>Hang bekapcsolása</button>
        </div>
      )}
      {netErr && <div className="errbar" role="alert">{netErr}</div>}

      <main className={`amain amain--${tab}`}>
        {tab === 'pult' && <Board orders={orders} fresh={fresh} change={change} />}
        {tab === 'szerkeszto' && <VisualEditor target={target} setTarget={setTarget} />}
        {tab === 'ajanlatok' && <OffersPane />}
        {tab === 'etlap' && <MenuPane />}
        {tab === 'beallitasok' && <SettingsPane storage={storage} />}
        {tab === 'forgalom' && <DayPane orders={orders} days={days} setDays={setDays} />}
      </main>

      {(dirty || saveError) && (
        <div className="pubbar" role="region" aria-label="Közzététel">
          <span className="pubbar__dot" aria-hidden="true" />
          <p>{saveError ? <span className="pubbar__err">{saveError}</span> : <>Nem közzétett módosítások – a vevők még a régit látják.</>}</p>
          <button type="button" className="kbtn kbtn--link" disabled={saving} onClick={() => { if (confirm('Elveted az összes nem közzétett módosítást?')) discard(); }}><Icon name="undo" />Elvetés</button>
          <button type="button" className="kbtn kbtn--go" disabled={saving || !dirty} onClick={() => publish()}>
            {saving ? <><span className="kspin" />Mentés…</> : <><Icon name="check" />Közzététel</>}
          </button>
        </div>
      )}
    </>
  );
}
