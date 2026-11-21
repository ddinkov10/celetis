import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cn } from 'cn';
import type { ComponentProps } from 'react';

export function Sidebar({ className, ...props }: ComponentProps<'nav'>) {
  return (
    <nav
      data-slot="sidebar"
      className={cn(
        'col-start-1 row-start-1 flex min-h-0 flex-col gap-1.5 overflow-y-auto border-r border-border bg-background px-2.5 pt-3 pb-2.5',
        'rail:px-2 rail:pt-2.5 rail:pb-2',
        'phone:min-h-14 phone:flex-row phone:items-center phone:gap-2 phone:overflow-visible phone:border-r-0 phone:border-b phone:px-4 phone:py-1.5',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        'mb-1.5 flex min-h-9 min-w-0 items-center gap-2.5 px-1.5',
        'rail:min-h-0 rail:flex-col rail:gap-1.5 rail:px-0 rail:pt-0.5 rail:pb-1',
        'phone:m-0 phone:min-h-0 phone:flex-1 phone:p-0',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        'mt-auto flex flex-col items-stretch gap-0.5 border-t border-border px-0.5 pt-2.5 text-xs text-muted-foreground rail:hidden phone:hidden',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn(
        'm-0 mt-2 flex min-h-[calc(11px+2*34px+2px)] list-none flex-col gap-0.5 overflow-y-auto border-t border-border p-0 pt-2.5',
        'rail:min-h-[calc(11px+2*50px+2px)] phone:hidden',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('relative', className)} {...props} />;
}

export function SidebarMenuButton({ className, render, ...props }: useRender.ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'relative flex h-[34px] w-full items-center gap-2.5 rounded-lg border border-transparent bg-transparent pr-2 pl-2.5 text-left text-[0.78125rem] leading-none font-medium text-card-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-2px] focus-visible:outline-ring aria-[current=page]:border-border aria-[current=page]:bg-accent aria-[current=page]:text-foreground [&_.icon]:shrink-0',
          'rail:h-[50px] rail:flex-col rail:justify-center rail:gap-[5px] rail:px-0.5 rail:py-1.5 rail:text-center rail:text-[0.6875rem] rail:leading-[1.1]',
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: 'sidebar-menu-button' },
  });
}
