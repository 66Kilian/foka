'use client';
// Admin űrlap-elemek: egységes címke, súgó, hibaüzenet
import { useId, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { prepareImage } from '@/lib/image';
import { WEEKDAYS_SHORT } from '@/lib/menu';
import type { Img } from '@/lib/types';

type Base = { label: string; hint?: string; error?: string };

export function Text({ label, hint, error, value, onChange, multiline, ...rest }: Base & {
  value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; maxLength?: number; required?: boolean; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const id = useId();
  return (
    <div className="af">
      <label htmlFor={id} className="af__label">{label}{hint && <small>{hint}</small>}</label>
      {multiline
        ? <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} {...rest} />
        : <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} {...rest} />}
      {error && <p className="af__err">{error}</p>}
    </div>
  );
}

/** Szám mező: gépelés közben szövegként tartjuk, kilépéskor ellenőrizzük */
export function Num({ label, hint, value, onChange, min = 0, max = 1_000_000, step = 1, suffix, allowEmpty }: Base & {
  value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; suffix?: string; allowEmpty?: boolean;
}) {
  const id = useId();
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt ?? (value == null ? '' : String(value));
  const parsed = shown.trim() === '' ? null : Number(shown.replace(',', '.').replace(/\s/g, ''));
  const err = shown.trim() === '' ? (allowEmpty ? '' : 'Kötelező') : !Number.isFinite(parsed) ? 'Számot írj' : parsed! < min ? `Legalább ${min}` : parsed! > max ? `Legfeljebb ${max}` : '';
  return (
    <div className="af">
      <label htmlFor={id} className="af__label">{label}{hint && <small>{hint}</small>}</label>
      <div className="af__num">
        <input id={id} inputMode={step < 1 ? 'decimal' : 'numeric'} value={shown} aria-invalid={!!err || undefined}
          onChange={(e) => {
            setTxt(e.target.value);
            const t = e.target.value.trim();
            const n = Number(t.replace(',', '.').replace(/\s/g, ''));
            if (t === '' && allowEmpty) onChange(null);
            else if (t !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(step < 1 ? n : Math.round(n));
          }}
          onBlur={() => setTxt(null)} />
        {suffix && <span>{suffix}</span>}
      </div>
      {err && <p className="af__err">{err}</p>}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: Base & { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="atoggle" onClick={() => onChange(!checked)}>
      <span className="kswitch__track"><span className="kswitch__thumb" /></span>
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </button>
  );
}

export function Select<T extends string>({ label, hint, value, onChange, options }: Base & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className="af">
      <label htmlFor={id} className="af__label">{label}{hint && <small>{hint}</small>}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Szöveglista (pl. feltétek): soronként egy */
export function Lines({ label, hint, value, onChange, rows = 5 }: Base & { value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const id = useId();
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <div className="af">
      <label htmlFor={id} className="af__label">{label}<small>{hint ?? 'soronként egy'}</small></label>
      <textarea id={id} rows={rows} value={txt ?? value.join('\n')}
        onChange={(e) => { setTxt(e.target.value); onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)); }}
        onBlur={() => setTxt(null)} />
    </div>
  );
}

export function Days({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <fieldset className="af af--days">
      <legend className="af__label">Mely napokon? <small>{value.length ? '' : 'egyik sincs kijelölve = minden nap'}</small></legend>
      <div className="adays">
        {order.map((d) => (
          <label key={d}><input type="checkbox" checked={value.includes(d)} onChange={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])} /><span>{WEEKDAYS_SHORT[d]}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

export type Uploader = (file: File) => Promise<NonNullable<Img>>;

export function ImageField({ label, hint, value, onChange, upload, library, fallback }: {
  label: string; hint?: string; value: Img; onChange: (v: Img) => void; upload: Uploader; library: NonNullable<Img>[]; fallback?: Img;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [pick, setPick] = useState(false);
  const shown = value ?? fallback ?? null;

  async function take(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr('');
    try { onChange(await upload(f)); } catch (e) { setErr(e instanceof Error ? e.message : 'A feltöltés nem sikerült.'); } finally { setBusy(false); }
  }

  return (
    <div className="af">
      <span className="af__label">{label}{!value && fallback ? <small>most a termék képe látszik</small> : hint ? <small>{hint}</small> : null}</span>
      <div
        className={`aimg${drag ? ' is-drag' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown.src} alt="" /> : <span className="aimg__empty"><Icon name="image" />Nincs kép</span>}
        {busy && <span className="aimg__busy"><span className="kspin" />Feltöltés…</span>}
      </div>
      <div className="aimg__acts">
        <button type="button" className="kbtn kbtn--ghost" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />{shown ? 'Csere' : 'Feltöltés'}</button>
        {library.length > 0 && <button type="button" className="kbtn kbtn--ghost" aria-expanded={pick} onClick={() => setPick((p) => !p)}><Icon name="grid" />Meglévőből</button>}
        {value && <button type="button" className="kbtn kbtn--link" onClick={() => onChange(null)}>{fallback ? 'Vissza a termék képére' : 'Kép törlése'}</button>}
      </div>
      <p className="af__help">Húzd ide a képet, vagy válassz a telefonodról. Automatikusan kicsinyítjük.</p>
      {err && <p className="af__err" role="alert">{err}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      {pick && (
        <div className="alib" role="listbox" aria-label="Meglévő képek">
          {library.map((im) => (
            <button key={im.src} type="button" role="option" aria-selected={value?.src === im.src} onClick={() => { onChange(im); setPick(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Group({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="agroup">
      <h3>{title}</h3>
      {desc && <p className="agroup__desc">{desc}</p>}
      <div className="agroup__body">{children}</div>
    </section>
  );
}
