import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-3 py-5 sm:gap-6 sm:px-4 sm:py-8 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Skeleton h={28} w="70%" />
        <Skeleton h={14} w="95%" />
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={44} rounded="rounded-lg" />
          ))}
          <Skeleton h={46} w={160} rounded="rounded-xl" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Skeleton h={18} w={140} />
          <Skeleton h={13} w="100%" />
          <Skeleton h={13} w="80%" />
          <Skeleton h={13} w="90%" />
        </div>
      </div>
    </div>
  );
}
