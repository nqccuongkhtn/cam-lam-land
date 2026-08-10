import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
      <Skeleton h={28} w="65%" />
      <Skeleton className="mt-3" h={14} w="90%" />
      <div className="mt-6 space-y-1 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
            <Skeleton h={14} w="40%" />
            <Skeleton h={14} w={90} />
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <Skeleton h={18} w={160} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton h={42} rounded="rounded-lg" />
          <Skeleton h={42} rounded="rounded-lg" />
        </div>
        <Skeleton h={44} w={140} rounded="rounded-xl" />
      </div>
    </div>
  );
}
