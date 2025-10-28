import { useState, useEffect } from "react";
import { z } from "zod";
import { ICreateDirectoryDialog, CreateDirectoryFormData } from "./ICreateDirectoryDialog";
import { createDirectorySchema } from "./createDirectorySchema";
import { useCreateDirectoryMutation } from "../../../../store/api/Directory/DirectoryApi";
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

export const CreateDirectoryDialog = ({
  isOpen,
  onClose,
  parentId,
  onSuccess,
}: ICreateDirectoryDialog) => {
  const [formData, setFormData] = useState<CreateDirectoryFormData>({
    name: "",
    description: "",
    color: FOLDER_COLORS[0].value,
    icon: FOLDER_ICONS[0].name,
    parentId: null, // Will be set by useEffect when dialog opens
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [createDirectory, { isLoading }] = useCreateDirectoryMutation();

  // Update parentId when it changes (when dialog opens with different parent)
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        parentId: parentId || null,
      }));
    }
  }, [isOpen, parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    try {
      createDirectorySchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    // Create directory
    try {
      const directoryData = {
        name: formData.name,
        color: formData.color,
        icon: formData.icon,
        parentId: formData.parentId,
      };
      
      console.log('Creating directory with data:', directoryData);
      console.log('ParentId from prop:', parentId);
      console.log('ParentId from formData:', formData.parentId);
      
      const result = await createDirectory(directoryData).unwrap();

      onSuccess(result.directoryId);
      handleClose();
    } catch (error) {
      console.error("Failed to create directory:", error);
      setErrors({ submit: "Failed to create folder. Please try again." });
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      color: FOLDER_COLORS[0].value,
      icon: FOLDER_ICONS[0].name,
      parentId: null, // Reset to null, will be updated by useEffect when reopened
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {formData.parentId ? 'Create New Subfolder' : 'Create New Folder'}
          </DialogTitle>
          <DialogDescription>
            {formData.parentId 
              ? 'Create a new subfolder inside the selected folder.'
              : 'Create a new folder to organize your documents.'
            }
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

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description"
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-destructive text-sm mt-1">{errors.description}</p>
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
              {isLoading ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
