import type { ReactNode } from 'react';

type EmptyStateProps = { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string };

// Trang thai rong chuan: icon + tieu de + mo ta + hanh dong (tuy chon).
export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`grid place-items-center px-4 py-12 text-center ${className}`}>
      {icon && <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>}
      <p className="font-bold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
