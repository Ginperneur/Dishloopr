import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useEffect } from 'react';

export interface OwnerHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Open snel zoeken (command palette)' },
  { keys: ['⌘', '⇧', '1'], label: 'Ga naar Overzicht' },
  { keys: ['⌘', '⇧', '2'], label: 'Ga naar Content' },
  { keys: ['⌘', '⇧', '3'], label: 'Ga naar Inzichten' },
  { keys: ['⌘', '⇧', '4'], label: 'Ga naar Marketing' },
  { keys: ['⌘', '⇧', '5'], label: 'Ga naar Markt' },
  { keys: ['⌘', '⇧', '6'], label: 'Ga naar Facturen' },
  { keys: ['?'], label: 'Toon deze hulp' },
  { keys: ['Esc'], label: 'Sluit dialogen en menu\u2019s' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function OwnerHelpDialog({ open, onOpenChange }: OwnerHelpDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (target?.isContentEditable ?? false);
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sneltoetsen</DialogTitle>
          <DialogDescription>
            Werk sneller in het dashboard met deze toetscombinaties.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-foreground">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Tip: gebruik <Kbd>Ctrl</Kbd> in plaats van <Kbd>⌘</Kbd> op Windows en Linux.
        </p>
      </DialogContent>
    </Dialog>
  );
}