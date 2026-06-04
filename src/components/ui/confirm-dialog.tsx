import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

let globalConfirm: ConfirmFn | null = null;

export function openConfirm(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { description: opts } : opts;
  if (globalConfirm) return globalConfirm(o);
  return Promise.resolve(window.confirm(o.description || o.title || 'Weet je het zeker?'));
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolverRef = useRef<(value: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    globalConfirm = confirm;
    return () => { if (globalConfirm === confirm) globalConfirm = null; };
  }, [confirm]);

  const handleClose = (value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = undefined;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) handleClose(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title || 'Weet je het zeker?'}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription className="whitespace-pre-wrap">
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {opts.cancelLabel || 'Annuleren'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={opts.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {opts.confirmLabel || 'Bevestigen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to native confirm if provider missing (safety)
    return (opts) => Promise.resolve(window.confirm(opts.description || opts.title || 'Weet je het zeker?'));
  }
  return ctx;
}