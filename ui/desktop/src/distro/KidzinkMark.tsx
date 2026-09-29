import { cn } from '../utils';

// Path data from distro/assets/logo/kidzink-mark.svg (the kidzink.com favicon).
const K_DOT =
  'M6.83 30.93c0 1.56-1.32 2.88-2.88 2.88s-2.88-1.2-2.88-2.88 1.32-2.88 2.88-2.88 2.88 1.32 2.88 2.88';
const K_LETTER =
  'M25.79 36.35v-.12l-.01-.02-14.75-21.59-3 3.24v8.88H0L.12 5.39l7.8-1.68v5.28L15.24 0h9.83l-8.16 9.72 18.83 26.63z';

export function KidzinkMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="-0.3 0 36.35 36.35"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('fill-brand', className)}
      role="img"
      aria-label="Kidzink"
    >
      <path d={K_DOT} />
      <path d={K_LETTER} />
    </svg>
  );
}
