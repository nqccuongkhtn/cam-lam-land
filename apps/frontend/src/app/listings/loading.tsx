import { Skeleton } from '@/components/ui';

// Skeleton dieu huong tuc thi cho /listings (Next hien ngay khi bam, truoc khi page mount).
// Khop hinh thanh tim kiem + the feed de chuyen lien mach sang skeleton trong trang.
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl space-y-2 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 flex-1" rounded="rounded-full" />
            <Skeleton className="h-11 w-24 shrink-0" rounded="rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 shrink-0" rounded="rounded-full" />
            <Skeleton className="h-8 w-28 shrink-0" rounded="rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-3 pb-24 pt-5 sm:px-4">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="md:hidden">
                <Skeleton className="aspect-[16/9] w-full" rounded="rounded-none" />
                <div className="space-y-2.5 p-2.5">
                  <Skeleton h={16} w="80%" />
                  <Skeleton h={20} w="55%" />
                  <Skeleton h={12} w="62%" />
                </div>
              </div>
              <div className="hidden gap-3 md:flex">
                <Skeleton className="h-32 w-48 shrink-0" rounded="rounded-none" />
                <div className="flex-1 space-y-2.5 py-3 pr-3">
                  <Skeleton h={16} w="75%" />
                  <Skeleton h={20} w="50%" />
                  <Skeleton h={12} w="66%" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
