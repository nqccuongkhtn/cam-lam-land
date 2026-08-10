import { Skeleton } from '@/components/ui';

// Skeleton dieu huong tuc thi cho /map — khung full-height (thanh cong cu + vung ban do).
// Map la route nang nen phan hoi tuc thi o day co gia tri nhat.
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-lg" />
        <Skeleton className="h-9 flex-1" rounded="rounded-lg" />
        <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-lg" />
      </div>
      <div className="relative flex-1 bg-slate-100">
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
            <span className="text-sm">Đang tải bản đồ…</span>
          </div>
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <Skeleton className="h-9 w-9" rounded="rounded-lg" />
          <Skeleton className="h-9 w-9" rounded="rounded-lg" />
        </div>
      </div>
    </div>
  );
}
