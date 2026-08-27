import type { HTMLAttributes, ReactNode } from 'react';

export type ContentDragProps = {
  dragHandle?: ReactNode;
} & Pick<
  HTMLAttributes<HTMLLIElement>,
  'draggable' | 'onDragStart' | 'onDragOver' | 'onDrop' | 'onDragEnd' | 'className'
>;
