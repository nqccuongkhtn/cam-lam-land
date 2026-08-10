import { Skeleton } from '@/components/ui';

// Skeleton dieu huong cho /cam-nang — tieu de + luoi dich vu + luoi bai cam nang.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4 sm:py-8">
      <Skeleton h={28} w="60%" />
      <Skeleton className="mt-3" h={14} w="90%" />
      <Skeleton className="mt-1.5" h={14} w="75%" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[534/510] w-full" rounded="rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-8" h={22} w="40%" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <Skeleton h={18} w="80%" />
            <Skeleton h={13} w="100%" />
            <Skeleton h={13} w="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}
