// Modified by Kidzink for Kidzink AI (see DISTRO_NOTES.md).
import React from 'react';
import { KidzinkMark } from '../../distro/KidzinkMark';

type Props = React.ComponentPropsWithoutRef<'svg'>;

export function Geese({ className }: Props) {
  return <KidzinkMark className={className} />;
}
