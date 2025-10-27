import { useState, useEffect } from "react";
import { z } from "zod";
import { IEditDirectoryDialog } from "./IEditDirectoryDialog";
import { createDirectorySchema } from "../CreateDirectoryDialog/createDirectorySchema";
import { useUpdateDirectoryMutation } from "../../../../store/api/Directory/DirectoryApi";
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
import { Folder, FolderOpen, Briefcase, Target, Zap, Rocket } from "lucide-react";

const FOLDER_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
  { name: "Gray", value: "#6b7280" },
];

const FOLDER_ICONS = [
  { name: "Folder", component: Folder },
  { name: "Folder Open", component: FolderOpen },
  { name: "Briefcase", component: Briefcase },
  { name: "Target", component: Target },
  { name: "Zap", component: Zap },
  { name: "Rocket", component: Rocket },
];

export const EditDirectoryDialog = ({
  isOpen,
  onClose,
  directory,
  onSuccess,
}: IEditDirectoryDialog) => {
  const [formData, setFormData] = useState({
    name: "",
    color: FOLDER_COLORS[0].value,
    icon: FOLDER_ICONS[0].name,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [updateDirectory, { isLoading }] = useUpdateDirectoryMutation();

  // Initialize form data when directory changes
  useEffect(() => {
    if (directory) {
      setFormData({
        name: directory.name,
        color: directory.color || FOLDER_COLORS[0].value,
        icon: directory.icon || FOLDER_ICONS[0].name,
      });
    }
  }, [directory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!directory) return;

    // Validate form data (using schema without parentId)
    const updateSchema = createDirectorySchema.pick({ name: true, color: true, icon: true });
    try {
      updateSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err: z.ZodIssue) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    // Update directory
    try {
      await updateDirectory({
        id: directory.id,
        data: {
          name: formData.name,
          color: formData.color,
          icon: formData.icon,
        },
      }).unwrap();

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to update directory:", error);
      setErrors({ submit: "Failed to update folder. Please try again." });
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription>
            Update the folder name, color, or icon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Folder Name */}
          <div>
            <Label htmlFor="name">Folder Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter folder name"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-destructive text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Color Picker */}
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <Label>Icon</Label>
            <div className="flex gap-2 mt-2">
              {FOLDER_ICONS.map((icon) => {
                const IconComponent = icon.component;
                return (
                  <button
                    key={icon.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: icon.name })}
                    className={`p-2 rounded-md border transition-all ${
                      formData.icon === icon.name
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-accent/50"
                    }`}
                    title={icon.name}
                  >
                    <IconComponent size={20} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <p className="text-destructive text-sm">{errors.submit}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
