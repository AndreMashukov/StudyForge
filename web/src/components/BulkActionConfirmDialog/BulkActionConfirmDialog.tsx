import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { AlertTriangle } from 'lucide-react';

export interface IBulkActionConfirmDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  mode: 'destructive' | 'simple';
  isLoading?: boolean;
  /** Request-level failure; dialog stays open so the user can retry. */
  error?: string | null;
  onConfirm: () => void | Promise<void>;
}

export const BulkActionConfirmDialog: React.FC<IBulkActionConfirmDialog> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  mode,
  isLoading = false,
  error = null,
  onConfirm,
}) => {
  const [typedConfirm, setTypedConfirm] = useState('');

  useEffect(() => {
    if (!open) {
      setTypedConfirm('');
    }
  }, [open]);

  const canConfirm = mode === 'simple' || typedConfirm === 'DELETE';

  const handleConfirm = async () => {
    if (!canConfirm || isLoading) {
      return;
    }
    await onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'destructive' && (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {typeof description === 'string' ? description : null}
          </DialogDescription>
          {typeof description !== 'string' && (
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          )}
        </DialogHeader>

        {mode === 'destructive' && (
          <div className="space-y-2">
            <Label htmlFor="bulk-delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="bulk-delete-confirm"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={mode === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
          >
            {isLoading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
