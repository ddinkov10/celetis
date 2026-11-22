import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { cn } from 'cn';

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  anchor,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, 'anchor' | 'align' | 'side' | 'sideOffset'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        anchor={anchor}
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={12}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'max-h-(--available-height) w-max min-w-60 max-w-[min(340px,calc(100vw-16px))] overflow-auto rounded-xl bg-popover p-[5px] text-popover-foreground shadow-float outline-none phone:max-w-[calc(100vw-24px)]',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'grid min-h-8 w-full cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[7px] px-[9px] py-1.5 text-left text-[0.8125rem] outline-none [&:hover]:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-45 phone:min-h-11 [&_.icon]:size-3.5 [&_.icon]:text-muted-foreground [&_kbd]:min-h-5 [&_kbd]:min-w-5 [&_kbd]:text-[0.6875rem] [&_kbd]:text-card-foreground pointer-coarse:[&_kbd]:hidden phone:[&_kbd]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('mx-1 my-[5px] h-px bg-border', className)}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger };
