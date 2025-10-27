import { useState } from "react";
import { IDeleteDirectoryDialog } from "./IDeleteDirectoryDialog";
import { useDeleteDirectoryMutation } from "../../../../store/api/Directory/DirectoryApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/Dialog";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Label } from "../../../../components/ui/Label";
import { AlertTriangle } from "lucide-react";

export const DeleteDirectoryDialog = ({
  isOpen,
  onClose,
  directory,
  onSuccess,
}: IDeleteDirectoryDialog) => {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  const [deleteDirectory, { isLoading }] = useDeleteDirectoryMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!directory) return;

    // Validate confirmation
    if (confirmText !== directory.name) {
      setError("Folder name does not match. Please type the exact folder name.");
      return;
    }

    // Check if directory has content
    if (directory.documentCount > 0 || directory.childCount > 0) {
      setError(
        `This folder contains ${directory.documentCount} document(s) and ${directory.childCount} subfolder(s). Please remove all contents before deleting.`
      );
      return;
    }

    // Delete directory
    try {
      await deleteDirectory(directory.id).unwrap();
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to delete directory:", error);
      setError("Failed to delete folder. Please try again.");
    }
  };

  const handleClose = () => {
    setConfirmText("");
    setError("");
    onClose();
  };

  const canDelete = directory && directory.documentCount === 0 && directory.childCount === 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            Delete Folder
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {directory && (
            <>
              {/* Warning about content */}
              {!canDelete && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                  <p className="text-sm text-destructive font-medium">
                    Cannot delete this folder
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    This folder contains {directory.documentCount} document(s) and{" "}
                    {directory.childCount} subfolder(s). Please remove all contents before
                    deleting.
                  </p>
                </div>
              )}

              {/* Confirmation input */}
              {canDelete && (
                <div>
                  <Label htmlFor="confirm">
                    Type <strong>{directory.name}</strong> to confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => {
                      setConfirmText(e.target.value);
                      setError("");
                    }}
                    placeholder={directory.name}
                    className={error ? "border-destructive" : ""}
                  />
                  {error && <p className="text-destructive text-sm mt-1">{error}</p>}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {canDelete && (
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading || confirmText !== directory?.name}
              >
                {isLoading ? "Deleting..." : "Delete Folder"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
