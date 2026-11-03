'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Editable, useEditing } from './edit';
import { heroSlides } from '@/lib/menu';
import { ft } from '@/lib/format';
import type { Content } from '@/lib/types';

export function Hero({ c, onAdd, soldOut }: { c: Content; onAdd: (itemId: string) => void; soldOut: Set<string> }) {
  const slides = heroSlides(c);
  const editing = useEditing();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const swipe = useRef<number | null>(null);
  const n = slides.length;
  const cur = n ? ((idx % n) + n) % n : 0;

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  }, []);
  useEffect(() => { if (idx >= n && n) setIdx(0); }, [idx, n]);

  if (!n) return null;
  const go = (i: number) => setIdx(((i % n) + n) % n);
  const stopped = paused || editing;

  return (
    <section
      ref={ref}
      className={`hero${stopped ? ' is-paused' : ''}${hold ? ' is-hold' : ''}`}
      aria-roledescription="körhinta"
      aria-label="Kiemelt ételeink"
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); }}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setHold(false); }}
    >
      <h1 className="sr">{c.brand.name}, {c.contact.town} – online rendelés</h1>
      <div
        className="hero__stage"
        onPointerDown={(e) => { swipe.current = e.clientX; }}
        onPointerUp={(e) => {
          if (swipe.current == null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
        }}
      >
        {slides.map((s, i) => {
          const on = i === cur;
          const out = soldOut.has(s.item.id);
          return (
            <Editable key={s.slide.id} target={{ kind: 'hero', id: s.slide.id }} label="Kiemelt dia">
              <article
                className={`slide${on ? ' is-active' : ''}`}
                role="group"
                aria-roledescription="dia"
                aria-label={`${i + 1} / ${n}: ${s.title}`}
                aria-hidden={on ? undefined : true}
                inert={!on}
              >
                {s.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="slide__img" src={s.image.src} alt="" fetchPriority={i === 0 ? 'high' : undefined} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                )}
                <div className="slide__copy">
                  {s.slide.kicker && <p className="slide__kicker">{s.slide.kicker}</p>}
                  <h2 className="slide__name">{s.title}</h2>
                  <p className="slide__desc">{s.text}</p>
                  <div className="slide__buy">
                    <span className="slide__price">{ft(s.item.price)}</span>
                    <button className="btn btn--primary btn--lg" type="button" disabled={out} onClick={() => !editing && onAdd(s.item.id)}>
                      <Icon name="plus" /><span>{out ? 'Elfogyott' : 'Kosárba'}</span>
                    </button>
                  </div>
                </div>
              </article>
            </Editable>
          );
        })}
      </div>
      <div className="hero__ui">
        <div className="hero__controls">
          <button className="hero__arrow" type="button" aria-label="Előző" onClick={() => go(cur - 1)}><Icon name="left" /></button>
          <button className="hero__arrow" type="button" aria-label="Következő" onClick={() => go(cur + 1)}><Icon name="right" /></button>
          {!editing && (
            <button className="hero__pause" type="button" aria-label={paused ? 'Automatikus lapozás indítása' : 'Automatikus lapozás megállítása'} onClick={() => setPaused((p) => !p)}>
              <Icon name={paused ? 'play' : 'pause'} />
            </button>
          )}
        </div>
        <ol className="hero__rail" aria-label="Diák">
          {slides.map((s, i) => (
            <li key={s.slide.id}>
              <button
                type="button"
                className={`rail__item${i === cur ? ' is-active' : ''}`}
                aria-current={i === cur ? 'true' : undefined}
                onClick={() => go(i)}
              >
                {s.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image.thumb} alt="" loading="lazy" width={48} height={48} />
                )}
                <span className="rail__txt"><b>{s.title}</b><span>{ft(s.item.price)}</span></span>
                {/* Az aktív sáv animációjának vége lapoz tovább → szünet = az animáció megáll */}
                <span className="rail__bar"><i onAnimationEnd={() => i === cur && go(cur + 1)} /></span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
