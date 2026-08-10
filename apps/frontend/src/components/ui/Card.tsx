import type { HTMLAttributes } from 'react';

type Pad = 'none' | 'sm' | 'md' | 'lg';
const PAD: Record<Pad, string> = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-4 sm:p-5' };

type CardProps = HTMLAttributes<HTMLDivElement> & { pad?: Pad };

// The chuan cua app: nen trang, bo goc 2xl, vien slate mong.
export default function Card({ pad = 'lg', className = '', ...rest }: CardProps) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${PAD[pad]} ${className}`} {...rest} />;
}
