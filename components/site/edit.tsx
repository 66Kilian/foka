'use client';
// Szerkesztő mód: az admin „Oldal szerkesztő” előnézetében bármire rá lehet kattintani.
import { cloneElement, createContext, isValidElement, useContext } from 'react';
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';

export type EditTarget =
  | { kind: 'brand' }
  | { kind: 'contact' }
  | { kind: 'texts' }
  | { kind: 'hero'; id: string }
  | { kind: 'fact'; id: string }
  | { kind: 'offers' }
  | { kind: 'offer'; id: string }
  | { kind: 'section'; id: string }
  | { kind: 'item'; id: string };

export const sameTarget = (a: EditTarget | null, b: EditTarget | null) =>
  !!a && !!b && a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '');

type Ctx = { open: (t: EditTarget) => void; active: EditTarget | null } | null;
export const EditCtx = createContext<Ctx>(null);
export const useEditing = () => useContext(EditCtx) !== null;

type AnyProps = { className?: string };

export function Editable({ target, label, children }: { target: EditTarget; label: string; children: ReactElement }) {
  const ed = useContext(EditCtx);
  if (!ed || !isValidElement<AnyProps>(children)) return children;
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation(); // a belső (pontosabb) elem nyer
    ed.open(target);
  };
  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    'data-edit': label,
    'data-ed-key': `${target.kind}:${'id' in target ? target.id : ''}`,
    className: `${children.props.className ?? ''} ed${sameTarget(ed.active, target) ? ' is-editing' : ''}`,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(e); },
  });
}
