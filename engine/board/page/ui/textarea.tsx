import { cn } from 'cn';
import type * as React from 'react';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content max-h-42 min-h-11 w-full resize-none border-0 bg-transparent px-3.5 pt-[11px] pb-1 text-foreground caret-ring outline-none [font:inherit] placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
