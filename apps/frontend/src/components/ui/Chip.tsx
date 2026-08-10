import type { ButtonHTMLAttributes } from 'react';

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean };

// Chip loc tuong tac: sang len (navy) khi active.
export default function Chip({ active = false, className = '', type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`cl-press inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
        active ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
      } ${className}`}
      {...rest}
    />
  );
}
