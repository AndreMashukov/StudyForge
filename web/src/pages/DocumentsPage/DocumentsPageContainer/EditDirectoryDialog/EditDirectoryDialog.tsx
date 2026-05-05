import { useState, useEffect } from "react";
import { z } from "zod";
import { IEditDirectoryDialog } from "./IEditDirectoryDialog";
import { createDirectorySchema } from "../CreateDirectoryDialog/createDirectorySchema";
import { useUpdateDirectoryMutation } from "../../../../store/api/Directory/DirectoryApi";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "../../../../components/ui/Dialog";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Label } from "../../../../components/ui/Label";
import { Folder, File, Palette } from "lucide-react";
import { FOLDER_COLORS, FOLDER_ICONS } from "../folderConstants";

export const EditDirectoryDialog = ({
  isOpen,
  onClose,
  directory,
  onSuccess,
}: IEditDirectoryDialog) => {
  const [formData, setFormData] = useState({
    name: "",
    color: FOLDER_COLORS[4].value,
    icon: FOLDER_ICONS[0].name,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [updateDirectory, { isLoading }] = useUpdateDirectoryMutation();

  // Initialize form data when directory changes
  useEffect(() => {
    if (directory) {
      setFormData({
        name: directory.name,
        color: directory.color || FOLDER_COLORS[4].value,
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
    } catch (error: unknown) {
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
    } catch {
      // Error is shown via the global errorToastMiddleware toast
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Gradient header */}
        <div className="px-7 pt-7 pb-5 flex items-center gap-3.5 linear-gradient-subtle border-b border-border">
          <div className="w-11 h-11 rounded-xl linear-gradient flex items-center justify-center shrink-0" style={{ boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)' }}>
            <Folder className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold leading-tight">Edit Folder</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Update the folder name, color, or icon</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6 flex flex-col gap-6">
            {/* Details Section */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5">
                <File size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</span>
              </div>
              <div>
                <Label htmlFor="edit-name">Folder Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter folder name"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-destructive text-sm mt-1">{errors.name}</p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border -mx-7" />

            {/* Appearance Section */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5">
                <Palette size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</span>
              </div>

              {/* Color picker */}
              <div>
                <div className="text-[13px] font-medium mb-2">Color</div>
                <div className="grid grid-cols-10 gap-1.5">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`aspect-square rounded-full border-2 transition-all duration-150 relative ${
                        formData.color === color.value
                          ? "border-foreground scale-110 shadow-[0_0_10px_color-mix(in_srgb,var(--foreground)_15%,transparent)]"
                          : "border-transparent hover:scale-110"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {formData.color === color.value && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <div className="text-[13px] font-medium mb-2">Icon</div>
                <div className="grid grid-cols-8 gap-1">
                  {FOLDER_ICONS.map((icon) => {
                    const IconComponent = icon.component;
                    return (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: icon.name })}
                        className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-md border transition-all duration-150 ${
                          formData.icon === icon.name
                            ? "border-primary/50 bg-primary/15"
                            : "border-transparent hover:bg-primary/5 hover:border-border"
                        }`}
                        title={icon.label}
                      >
                        <IconComponent
                          size={20}
                          className={formData.icon === icon.name ? "text-primary" : ""}
                        />
                        <span className={`text-[9px] leading-tight ${
                          formData.icon === icon.name ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {icon.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-7 pb-6">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
