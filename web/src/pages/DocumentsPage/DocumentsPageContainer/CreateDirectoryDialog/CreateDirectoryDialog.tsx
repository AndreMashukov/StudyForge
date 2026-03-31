import { useState, useEffect } from "react";
import { z } from "zod";
import { ICreateDirectoryDialog, CreateDirectoryFormData } from "./ICreateDirectoryDialog";
import { createDirectorySchema } from "./createDirectorySchema";
import { useCreateDirectoryMutation } from "../../../../store/api/Directory/DirectoryApi";
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


export const CreateDirectoryDialog = ({
  isOpen,
  onClose,
  parentId,
  onSuccess,
}: ICreateDirectoryDialog) => {
  const [formData, setFormData] = useState<CreateDirectoryFormData>({
    name: "",
    description: "",
    color: FOLDER_COLORS[4].value,
    icon: FOLDER_ICONS[0].name,
    parentId: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [createDirectory, { isLoading }] = useCreateDirectoryMutation();

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

    try {
      const directoryData = {
        name: formData.name,
        color: formData.color,
        icon: formData.icon,
        parentId: formData.parentId,
      };

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
      color: FOLDER_COLORS[4].value,
      icon: FOLDER_ICONS[0].name,
      parentId: null,
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Gradient header */}
        <div className="px-7 pt-7 pb-5 flex items-center gap-3.5 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.3)] shrink-0">
            <Folder className="text-white" size={22} />
          </div>
          <div>
          <h2 className="text-[17px] font-semibold leading-tight">
            {formData.parentId ? 'Create New Subfolder' : 'Create New Folder'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formData.parentId
              ? 'Create a new subfolder inside the selected folder'
              : 'Organize your documents in a new folder'}
          </p>
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
                <Label htmlFor="name">Folder Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Physics Chapter 1"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-destructive text-sm mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this folder"
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-destructive text-sm mt-1">{errors.description}</p>
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
                          ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.15)]"
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
                            ? "border-purple-500/50 bg-purple-500/15"
                            : "border-transparent hover:bg-purple-500/5 hover:border-border"
                        }`}
                        title={icon.label}
                      >
                        <IconComponent
                          size={20}
                          className={formData.icon === icon.name ? "text-purple-500" : ""}
                        />
                        <span className={`text-[9px] leading-tight ${
                          formData.icon === icon.name ? "text-purple-500" : "text-muted-foreground"
                        }`}>
                          {icon.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <p className="text-destructive text-sm">{errors.submit}</p>
            )}
          </div>

          <DialogFooter className="px-7 pb-6">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 border-transparent shadow-[0_2px_8px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.4)]"
            >
              {isLoading ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
