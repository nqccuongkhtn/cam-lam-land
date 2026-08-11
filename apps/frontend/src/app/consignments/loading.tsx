import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <Skeleton h={26} w={200} className="mb-4" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <Skeleton h={16} w="45%" />
                <Skeleton h={20} w={70} rounded="rounded-full" />
              </div>
              <Skeleton h={13} w="70%" />
              <Skeleton h={13} w="55%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
