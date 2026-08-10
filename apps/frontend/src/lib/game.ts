'use client';
import { api } from './api';

export interface LbRow { rank: number; name: string; phone: string; score: number; }

export async function getLeaderboard(): Promise<LbRow[]> {
  return (await api<{ items: LbRow[] }>('/game/leaderboard')).items || [];
}

export async function submitScore(name: string, phone: string, score: number): Promise<{ ok: boolean; rank: number | null }> {
  return await api('/game/score', { method: 'POST', body: JSON.stringify({ name, phone, score }) });
}
