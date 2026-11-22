import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from 'cn';

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('group/tabs flex', className)} {...props} />;
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-[9px] border border-border bg-secondary p-0.5 phone:flex-1',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex min-h-[26px] flex-none items-center gap-1.5 rounded-[7px] border-0 bg-transparent px-2.5 py-0 text-[0.78125rem] leading-none font-medium whitespace-nowrap text-muted-foreground focus-visible:-outline-offset-2 aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-raise [&:hover]:text-foreground phone:min-h-11 phone:flex-[1_0_auto] phone:justify-center',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent(props: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
