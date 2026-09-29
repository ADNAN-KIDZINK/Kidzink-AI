// Modified by Kidzink for Kidzink AI (see DISTRO_NOTES.md).
import { KidzinkMark } from '../../distro/KidzinkMark';

export function Goose({ className = '' }) {
  return <KidzinkMark className={className} />;
}

// The hover rain animation belongs to the goose artwork; the Kidzink mark has none.
export function Rain(_props: { className?: string }) {
  return null;
}
