import { cn } from '@/lib/utils';

// shadcn/ui Skeleton — a pulsing placeholder shown while data loads.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
