import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn('restaurant-card rounded-2xl overflow-hidden', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Restaurant wordt geladen"
    >
      {/* Image Skeleton */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        <div className="absolute inset-0 shimmer-effect" />
      </div>
      
      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title + Rating */}
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 bg-muted rounded-md w-3/4 shimmer-effect" />
          <div className="h-5 bg-muted rounded-md w-16 shimmer-effect" />
        </div>
        
        {/* Location */}
        <div className="h-4 bg-muted rounded-md w-2/3 shimmer-effect" />
        
        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded-full w-16 shimmer-effect" />
          <div className="h-6 bg-muted rounded-full w-20 shimmer-effect" />
          <div className="h-6 bg-muted rounded-full w-14 shimmer-effect" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRestaurantPage() {
  return (
    <div className="animate-fade-in">
      {/* Hero Skeleton */}
      <div className="relative h-[40vh] md:h-[50vh] bg-muted overflow-hidden">
        <div className="absolute inset-0 shimmer-effect" />
      </div>
      
      <div className="container px-4 md:px-6 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="h-10 bg-muted rounded-lg w-3/4 shimmer-effect" />
            <div className="h-4 bg-muted rounded-md w-1/2 shimmer-effect" />
            <div className="flex gap-2">
              <div className="h-8 bg-muted rounded-full w-20 shimmer-effect" />
              <div className="h-8 bg-muted rounded-full w-24 shimmer-effect" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-md w-full shimmer-effect" />
              <div className="h-4 bg-muted rounded-md w-full shimmer-effect" />
              <div className="h-4 bg-muted rounded-md w-2/3 shimmer-effect" />
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="h-48 bg-muted rounded-xl shimmer-effect" />
            <div className="h-32 bg-muted rounded-xl shimmer-effect" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonReviewCard() {
  return (
    <div className="p-4 border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted rounded-full shimmer-effect" />
        <div className="space-y-1 flex-1">
          <div className="h-4 bg-muted rounded-md w-24 shimmer-effect" />
          <div className="h-3 bg-muted rounded-md w-16 shimmer-effect" />
        </div>
        <div className="h-6 bg-muted rounded-md w-12 shimmer-effect" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded-md w-full shimmer-effect" />
        <div className="h-4 bg-muted rounded-md w-4/5 shimmer-effect" />
      </div>
    </div>
  );
}

export function SkeletonTrendingDish() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0 w-20">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted shimmer-effect" />
      <div className="h-3 bg-muted rounded-md w-14 shimmer-effect" />
    </div>
  );
}
