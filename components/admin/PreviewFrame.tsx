'use client';
// Az „Oldal szerkesztő” iframe-jében futó vásárlói oldal. A szülő ablakkal üzenetekkel beszél.
import { useEffect, useState } from 'react';
import { SiteView } from '../site/SiteView';
import type { EditTarget } from '../site/edit';
import type { Content, Status } from '@/lib/types';

export type ToPreview =
  | { type: 'state'; content: Content; status: Status }
  | { type: 'active'; target: EditTarget | null; scroll?: boolean };
export type FromPreview = { type: 'ready' } | { type: 'edit'; target: EditTarget };

export function PreviewFrame() {
  const [state, setState] = useState<{ content: Content; status: Status } | null>(null);
  const [active, setActive] = useState<EditTarget | null>(null);

  useEffect(() => {
    const send = (m: FromPreview) => window.parent.postMessage(m, location.origin);
    const onMsg = (e: MessageEvent<ToPreview>) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data;
      if (m?.type === 'state') setState({ content: m.content, status: m.status });
      if (m?.type === 'active') {
        setActive(m.target);
        if (m.scroll && m.target) {
          const key = `${m.target.kind}:${'id' in m.target ? m.target.id : ''}`;
          requestAnimationFrame(() => document.querySelector(`[data-ed-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        }
      }
    };
    window.addEventListener('message', onMsg);
    send({ type: 'ready' });
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!state) return <p style={{ padding: 40, fontFamily: 'system-ui' }}>Előnézet betöltése…</p>;
  return (
    <SiteView
      content={state.content}
      status={state.status}
      edit={{ active, open: (target) => { setActive(target); window.parent.postMessage({ type: 'edit', target } satisfies FromPreview, location.origin); } }}
    />
  );
}
