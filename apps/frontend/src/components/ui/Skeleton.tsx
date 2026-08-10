type SkeletonProps = { className?: string; w?: string | number; h?: string | number; rounded?: string };

// Dung class .skeleton co san trong globals.css (pulse nhe).
export default function Skeleton({ className = '', w, h, rounded = 'rounded-lg' }: SkeletonProps) {
  return <span aria-hidden className={`skeleton block ${rounded} ${className}`} style={{ width: w, height: h }} />;
}
