// Modified by Kidzink for Kidzink AI (see DISTRO_NOTES.md).
import { KidzinkMark } from '../distro/KidzinkMark';

interface FlyingBirdProps {
  className?: string;
  cycleInterval?: number; // kept for call-site compatibility; the Kidzink mark pulses instead
}

export default function FlyingBird({ className = '' }: FlyingBirdProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      <KidzinkMark className="w-4 h-4" />
    </div>
  );
}
