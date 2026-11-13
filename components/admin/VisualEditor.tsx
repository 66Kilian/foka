'use client';
// Oldal szerkesztő: balra a saját oldal (pont úgy, ahogy a vevő látja), jobbra annak a szerkesztője, amire rákattintottál.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { TargetEditor, targetTitle } from './editors';
import { useAdmin } from './state';
import type { EditTarget } from '../site/edit';
import type { FromPreview, ToPreview } from './PreviewFrame';

export function VisualEditor({ target, setTarget }: { target: EditTarget | null; setTarget: (t: EditTarget | null) => void }) {
  const { draft, status } = useAdmin();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [closedView, setClosedView] = useState(false);

  const send = useCallback((m: ToPreview) => frame.current?.contentWindow?.postMessage(m, location.origin), []);

  useEffect(() => {
    const onMsg = (e: MessageEvent<FromPreview>) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') setReady(true);
      if (e.data?.type === 'edit') setTarget(e.data.target);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [setTarget]);

  // Minden módosítás azonnal látszik az előnézetben
  useEffect(() => {
    if (ready) send({ type: 'state', content: draft, status: { ...status, open: closedView ? false : status.open } });
  }, [ready, draft, status, closedView, send]);
  useEffect(() => { if (ready) send({ type: 'active', target }); }, [ready, target, send]);

  // A panelből megnyitott elemhez odagörgetünk
  const open = (t: EditTarget) => { setTarget(t); send({ type: 'active', target: t, scroll: true }); };

  return (
    <div className={`ved${target ? ' has-panel' : ''}`}>
      <div className="ved__stage">
        <div className="ved__tools">
          <p className="ved__hint"><Icon name="edit" />Kattints bármire az oldalon, és itt jobbra szerkesztheted.</p>
          <div className="aseg aseg--sm" role="group" aria-label="Nézet">
            <label><input type="radio" checked={device === 'desktop'} onChange={() => setDevice('desktop')} /><span>Gép</span></label>
            <label><input type="radio" checked={device === 'mobile'} onChange={() => setDevice('mobile')} /><span>Telefon</span></label>
          </div>
          <label className="ved__check"><input type="checkbox" checked={closedView} onChange={(e) => setClosedView(e.target.checked)} />Zárva nézet</label>
        </div>
        <div className={`ved__viewport ved__viewport--${device}`}>
          <iframe ref={frame} src="/admin/elonezet" title="A vásárlói oldal előnézete" />
          {!ready && <div className="ved__loading"><span className="kspin" />Előnézet betöltése…</div>}
        </div>
      </div>
      <aside className="ved__panel" aria-label="Szerkesztő">
        {target ? (
          <>
            <header className="ved__head">
              <h2>{targetTitle(target, draft)}</h2>
              <button type="button" className="kicon" aria-label="Szerkesztő bezárása" onClick={() => setTarget(null)}><Icon name="x" /></button>
            </header>
            <div className="ved__body" key={`${target.kind}:${'id' in target ? target.id : ''}`}>
              <TargetEditor target={target} onOpen={open} onClose={() => setTarget(null)} />
            </div>
          </>
        ) : (
          <div className="ved__empty">
            <Icon name="edit" className="ved__bigicon" />
            <h2>Mit szeretnél módosítani?</h2>
            <p>Kattints az oldalon egy pizzára, a slideshow-ra, egy kategória címére, a napi ajánlatra vagy a láblécre.</p>
            <ul className="alist">
              <li><button type="button" onClick={() => open({ kind: 'offers' })}><b>Napi ajánlatok</b><Icon name="right" /></button></li>
              <li><button type="button" onClick={() => draft.hero[0] && open({ kind: 'hero', id: draft.hero[0].id })}><b>Slideshow</b><Icon name="right" /></button></li>
              <li><button type="button" onClick={() => open({ kind: 'brand' })}><b>Név és logó</b><Icon name="right" /></button></li>
              <li><button type="button" onClick={() => open({ kind: 'contact' })}><b>Elérhetőség, lábléc</b><Icon name="right" /></button></li>
              <li><button type="button" onClick={() => open({ kind: 'texts' })}><b>Feliratok</b><Icon name="right" /></button></li>
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
