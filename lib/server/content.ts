import 'server-only';
import { db } from './db';
import { SEED } from '../seed';
import type { Content, Status } from '../types';

const K_CONTENT = 'content:v1';
const K_STATUS = 'status:v1';
const DEFAULT_STATUS: Status = { open: true, extraWait: 0, soldOut: [] };

/** Az új mezők (későbbi frissítésekből) a kezdő tartalomból egészülnek ki */
function withDefaults(c: Partial<Content>): Content {
  const out = { ...SEED, ...c } as Content;
  for (const k of ['brand', 'contact', 'seo', 'texts', 'options', 'pricing', 'delivery', 'sms'] as const) {
    (out as Record<string, unknown>)[k] = { ...SEED[k], ...(c[k] ?? {}) };
  }
  return out;
}

export async function getContent(): Promise<Content> {
  const c = await db.get<Content>(K_CONTENT);
  return c ? withDefaults(c) : SEED;
}

export async function saveContent(c: Content): Promise<Content> {
  const next = { ...c, updatedAt: Date.now() };
  await db.set(K_CONTENT, next);
  return next;
}

export async function getStatus(): Promise<Status> {
  return { ...DEFAULT_STATUS, ...((await db.get<Status>(K_STATUS)) ?? {}) };
}

export async function setStatus(patch: Partial<Status>): Promise<Status> {
  const next = { ...(await getStatus()), ...patch };
  await db.set(K_STATUS, next);
  return next;
}

export const storageKind = () => db.kind;
