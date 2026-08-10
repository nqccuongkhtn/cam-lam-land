import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton h={26} w={180} />
          <Skeleton h={40} w={140} rounded="rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton h={90} rounded="rounded-2xl" />
          <Skeleton h={90} rounded="rounded-2xl" />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Skeleton className="h-28 w-40 shrink-0" rounded="rounded-none" />
              <div className="flex-1 space-y-2.5 py-3 pr-3">
                <Skeleton h={16} w="70%" />
                <Skeleton h={18} w="45%" />
                <Skeleton h={12} w="60%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
