'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

type Flags = Record<string, boolean>;
let cache: Flags | null = null;
let inflight: Promise<Flags> | null = null;

function load(): Promise<Flags> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) inflight = api<{ flags: Flags }>('/flags').then((r) => { cache = r.flags || {}; return cache; }).catch(() => { cache = {}; return cache!; });
  return inflight;
}

export function useFlags(): { flags: Flags; loaded: boolean } {
  const [s, setS] = useState<{ flags: Flags; loaded: boolean }>(cache ? { flags: cache, loaded: true } : { flags: {}, loaded: false });
  useEffect(() => { load().then((f) => setS({ flags: f, loaded: true })); }, []);
  return s;
}

export function refreshFlags() { cache = null; inflight = null; }
