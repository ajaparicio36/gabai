import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-primary/10', className)}
      {...props}
    />
  );
}

export { Skeleton };
