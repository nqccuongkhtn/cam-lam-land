import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <Skeleton h={28} w="55%" className="mx-auto" />
        <Skeleton h={14} w="80%" className="mx-auto mt-3" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-11 w-11" rounded="rounded-xl" />
              <Skeleton h={16} w="70%" />
              <Skeleton h={13} w="100%" />
              <Skeleton h={13} w="80%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
