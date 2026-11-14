export const heatmapStyles = {
  scroll: 'max-w-full overflow-x-auto px-1 py-1 scrollbar-thin',
  canvas: 'w-max mx-auto',
  months: 'ml-10 grid gap-1 pb-2 text-xs text-muted-foreground',
  weekdays:
    'sticky left-0 z-10 grid w-9 grid-rows-[repeat(7,20px)] gap-1 bg-card pr-2 text-xs text-muted-foreground md:grid-rows-[repeat(7,28px)]',
  grid: 'grid grid-flow-col grid-rows-[repeat(7,20px)] gap-1 md:grid-rows-[repeat(7,28px)]',
  cell: 'h-5 w-5 rounded-[4px] border border-transparent p-0 transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary md:h-7 md:w-7',
  selected: 'outline outline-2 outline-offset-1 outline-primary',
  levels: [
    'bg-muted',
    'bg-primary/20',
    'bg-primary/40',
    'bg-primary/65',
    'bg-primary/90',
  ],
};
