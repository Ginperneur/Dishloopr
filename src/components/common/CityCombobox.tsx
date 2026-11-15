import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { filterCities, sortCities } from '@/lib/cityOrder';

interface City { id: string; name: string; slug?: string | null }

/** City picker you can type in: the 7 largest cities first, then A to Z. */
export function CityCombobox({ cities, value, onChange, placeholder = 'Kies een stad', id }: {
  cities: City[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => sortCities(cities), [cities]);
  const shown = useMemo(() => filterCities(sorted, query), [sorted, query]);
  const selected = cities.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="min-h-11 w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Typ een stad" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Geen stad gevonden.</CommandEmpty>
            <CommandGroup>
              {shown.map(c => (
                <CommandItem key={c.id} value={c.id} onSelect={() => { onChange(c.id); setOpen(false); setQuery(''); }}>
                  <Check className={cn('mr-2 h-4 w-4', c.id === value ? 'opacity-100' : 'opacity-0')} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
