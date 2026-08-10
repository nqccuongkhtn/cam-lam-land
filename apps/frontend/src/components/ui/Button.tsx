import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'navy' | 'gold' | 'outline' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'rounded' | 'pill';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-red-600 text-white hover:bg-red-700',
  navy: 'bg-navy text-white hover:bg-navy/90',
  gold: 'bg-gold text-white hover:brightness-95',
  outline: 'bg-white text-slate-600 border border-slate-200 hover:border-navy hover:text-navy',
  ghost: 'text-slate-600 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};
const SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1',
  md: 'text-sm px-4 py-2.5 gap-1.5',
  lg: 'text-base px-5 py-3 gap-2',
};
const SHAPE: Record<ButtonShape, string> = { rounded: 'rounded-xl', pill: 'rounded-full' };

// Class chuan cho nut. Dung cho <Link>/<a> khi can:
//   <Link className={buttonClass({ variant: 'navy' })}>...</Link>
export function buttonClass(
  opts: { variant?: ButtonVariant; size?: ButtonSize; shape?: ButtonShape; block?: boolean; className?: string } = {},
): string {
  const { variant = 'primary', size = 'md', shape = 'rounded', block = false, className = '' } = opts;
  return [
    'cl-press inline-flex items-center justify-center font-bold whitespace-nowrap transition',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANT[variant],
    SIZE[size],
    SHAPE[shape],
    block ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export default function Button({ variant, size, shape, block, leftIcon, rightIcon, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, shape, block, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
