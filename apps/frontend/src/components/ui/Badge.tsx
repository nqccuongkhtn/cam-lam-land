import type { HTMLAttributes } from 'react';

export type BadgeTone = 'red' | 'emerald' | 'navy' | 'gold' | 'slate' | 'amber' | 'sky';

const SOLID: Record<BadgeTone, string> = {
  red: 'bg-red-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  navy: 'bg-navy text-white',
  gold: 'bg-gold text-white',
  slate: 'bg-slate-600 text-white',
  amber: 'bg-amber-500 text-white',
  sky: 'bg-sky-600 text-white',
};
const SOFT: Record<BadgeTone, string> = {
  red: 'bg-red-50 text-red-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  navy: 'bg-navy/5 text-navy',
  gold: 'bg-gold/10 text-[#8a6d1f]',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; soft?: boolean };

export default function Badge({ tone = 'slate', soft = false, className = '', ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none ${(soft ? SOFT : SOLID)[tone]} ${className}`}
      {...rest}
    />
  );
}
