import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-3xl px-3 sm:px-4">
        <Skeleton h={24} w={200} className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <Skeleton className="h-10 w-10 shrink-0" rounded="rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton h={14} w="40%" />
                <Skeleton h={12} w="60%" />
              </div>
              <Skeleton h={32} w={80} rounded="rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
