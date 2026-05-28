import { Layout } from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';

export function OwnerDashboardSkeleton() {
  return (
    <Layout>
      <div className="flex w-full min-h-[calc(100svh-4rem)]">
        {/* Sidebar skeleton */}
        <aside className="hidden md:flex flex-col gap-2 w-[16rem] border-r p-3">
          <Skeleton className="h-4 w-20 mb-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </aside>

        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b w-full px-4 md:px-6 py-3 flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-9" />
          </div>

          <div className="w-full px-4 md:px-6 py-6 md:py-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>

            <Skeleton className="h-20 w-full rounded-lg" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Skeleton className="h-64 rounded-lg lg:col-span-2" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}