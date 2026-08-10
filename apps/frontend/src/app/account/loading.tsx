import { Skeleton } from '@/components/ui';

// Skeleton dieu huong cho /account — the ho so + cac o form.
export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50 py-5 sm:py-6">
      <div className="mx-auto max-w-2xl space-y-4 px-3 sm:space-y-5 sm:px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 shrink-0" rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton h={18} w="50%" />
              <Skeleton h={14} w="35%" />
            </div>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton h={12} w={90} />
              <Skeleton h={42} rounded="rounded-lg" />
            </div>
          ))}
          <Skeleton h={44} w={140} rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}
