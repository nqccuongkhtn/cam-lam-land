import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 shrink-0" rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton h={22} w="45%" />
              <Skeleton h={14} w="30%" />
              <Skeleton h={12} w="60%" />
            </div>
          </div>
        </div>
        <Skeleton h={20} w={160} className="mt-6" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Skeleton className="aspect-[16/10] w-full" rounded="rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton h={14} w="90%" />
                <Skeleton h={16} w="50%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
