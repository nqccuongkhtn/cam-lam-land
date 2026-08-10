import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-10">
      <Skeleton h={14} w={120} className="mb-4" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="aspect-[16/9] w-full" rounded="rounded-lg" />
          <Skeleton className="mt-3" h={24} w="85%" />
          <Skeleton className="mt-2" h={14} w="100%" />
          <Skeleton className="mt-1.5" h={14} w="70%" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-14 w-20 shrink-0" rounded="rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton h={13} w="95%" />
                <Skeleton h={13} w="70%" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[16/10] w-full" rounded="rounded-lg" />
            <Skeleton className="mt-2.5" h={15} w="90%" />
            <Skeleton className="mt-1.5" h={12} w="55%" />
          </div>
        ))}
      </div>
    </div>
  );
}
