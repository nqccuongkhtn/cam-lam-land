import { Skeleton } from '@/components/ui';

// Skeleton dieu huong tuc thi cho trang chi tiet — khop khung that (anh + the thong tin + the lien he)
// nen chuyen lien mach sang skeleton trong trang, gan nhu khong giat layout (CLS).
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Skeleton className="aspect-[4/3] w-full sm:aspect-[16/10]" rounded="rounded-2xl" />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex gap-2">
              <Skeleton h={20} w={72} rounded="rounded-full" />
              <Skeleton h={20} w={56} rounded="rounded-full" />
            </div>
            <Skeleton className="mt-3" h={26} w="85%" />
            <Skeleton className="mt-3" h={30} w="45%" />
            <Skeleton className="mt-3" h={16} w="65%" />
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} h={44} rounded="rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <Skeleton h={18} w={140} />
            <Skeleton h={14} w="100%" />
            <Skeleton h={14} w="92%" />
            <Skeleton h={14} w="80%" />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0" rounded="rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton h={14} w="60%" />
                <Skeleton h={12} w="40%" />
              </div>
            </div>
            <Skeleton h={44} rounded="rounded-xl" />
            <Skeleton h={44} rounded="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
