import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useDeleteDocumentMutation } from '../../store/api/Documents';
import { DocumentEnhanced } from '@shared-types';

interface DeleteDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentEnhanced | null;
  onSuccess: () => void;
}

export const DeleteDocumentDialog: React.FC<DeleteDocumentDialogProps> = ({
  isOpen,
  onClose,
  document,
  onSuccess,
}) => {
  const [deleteDocument, { isLoading }] = useDeleteDocumentMutation();

  const handleDelete = async () => {
    if (!document) return;

    try {
      await deleteDocument({ documentId: document.id }).unwrap();
      onSuccess();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Document
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{document?.title}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? (
              <>
                <Trash2 className="mr-2 h-4 w-4 animate-pulse" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
