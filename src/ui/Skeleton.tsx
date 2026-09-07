export interface SkeletonProps {
  lines?: number;
  className?: string;
}

function SkeletonLines({ lines = 1, className = "" }: SkeletonProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()} role="presentation" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton h-3 w-full"
          style={index === lines - 1 && lines > 1 ? { width: "70%" } : undefined}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card" role="presentation" aria-hidden="true">
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton mt-3 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-4/5" />
    </div>
  );
}

/** <Skeleton lines={3} /> for text placeholders, <Skeleton.Card /> for a
 *  bordered card placeholder. */
export const Skeleton = Object.assign(SkeletonLines, { Card: SkeletonCard });
