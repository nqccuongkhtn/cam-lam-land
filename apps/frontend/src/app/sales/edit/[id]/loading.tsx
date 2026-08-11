import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4 px-3 sm:space-y-5 sm:px-4">
        <Skeleton h={26} w={180} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Skeleton h={14} w={120} className="mb-3" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" rounded="rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton h={12} w={90} />
              <Skeleton h={42} rounded="rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton h={48} w={160} rounded="rounded-xl" />
          <Skeleton h={48} w={90} rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}
