import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import { Textarea } from "../ui/Textarea";
import { Badge } from "../ui/Badge";
import { X } from "lucide-react";
import {
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
} from "../../store/api/Rules/rulesApi";
import { IRuleFormModal } from "./IRuleFormModal";
import { RuleApplicability, RuleColor, CreateRuleRequest } from "@shared-types";
import { cn } from "../../lib/utils";
import { z } from "zod";

// Zod validation schema
const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(10000, "Content must be 10,000 characters or less"),
  color: z.nativeEnum(RuleColor),
  tags: z.array(z.string()),
  applicableTo: z
    .array(z.nativeEnum(RuleApplicability))
    .min(1, "Select at least one operation"),
  isDefault: z.boolean(),
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

export const RuleFormModal = ({
  ruleId,
  open,
  onClose,
  onSuccess,
}: IRuleFormModal) => {
  const isEditMode = !!ruleId;

  // Fetch existing rule for edit mode
  const { data: existingRule } = useGetRuleQuery(ruleId!, {
    skip: !isEditMode || !open,
  });

  const [createRule, { isLoading: isCreating }] = useCreateRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();

  // Form state
  const [formData, setFormData] = useState<RuleFormData>({
    name: "",
    description: "",
    content: "",
    color: RuleColor.BLUE,
    tags: [],
    applicableTo: [],
    isDefault: false,
  });

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Load existing rule data in edit mode
  useEffect(() => {
    if (existingRule && isEditMode) {
      setFormData({
        name: existingRule.name,
        description: existingRule.description || "",
        content: existingRule.content,
        color: existingRule.color,
        tags: existingRule.tags,
        applicableTo: existingRule.applicableTo,
        isDefault: existingRule.isDefault,
      });
    }
  }, [existingRule, isEditMode]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        description: "",
        content: "",
        color: RuleColor.BLUE,
        tags: [],
        applicableTo: [],
        isDefault: false,
      });
      setErrors({});
      setTagInput("");
      setShowPreview(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    try {
      ruleFormSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    try {
      if (isEditMode && ruleId) {
        const updatedRule = await updateRule({
          ruleId,
          ...formData,
        }).unwrap();
        onSuccess?.(updatedRule);
      } else {
        const newRule = await createRule(formData as CreateRuleRequest).unwrap();
        onSuccess?.(newRule);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save rule:", error);
      setErrors({ submit: "Failed to save rule. Please try again." });
    }
  };

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()],
        }));
      }
      setTagInput("");
    }
  };

  const handleTagRemove = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const toggleApplicability = (operation: RuleApplicability) => {
    setFormData((prev) => ({
      ...prev,
      applicableTo: prev.applicableTo.includes(operation)
        ? prev.applicableTo.filter((op) => op !== operation)
        : [...prev.applicableTo, operation],
    }));
  };

  const colorOptions: { value: RuleColor; label: string; class: string }[] = [
    { value: RuleColor.RED, label: "Red", class: "bg-red-500" },
    { value: RuleColor.ORANGE, label: "Orange", class: "bg-orange-500" },
    { value: RuleColor.YELLOW, label: "Yellow", class: "bg-yellow-500" },
    { value: RuleColor.GREEN, label: "Green", class: "bg-green-500" },
    { value: RuleColor.BLUE, label: "Blue", class: "bg-blue-500" },
    { value: RuleColor.INDIGO, label: "Indigo", class: "bg-indigo-500" },
    { value: RuleColor.PURPLE, label: "Purple", class: "bg-purple-500" },
    { value: RuleColor.PINK, label: "Pink", class: "bg-pink-500" },
    { value: RuleColor.GRAY, label: "Gray", class: "bg-gray-500" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader onClose={onClose}>
          <DialogTitle>
            {isEditMode ? "Edit Rule" : "Create New Rule"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-6">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Rule Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="DSA Code Examples"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Adds comprehensive code examples for DSA problems"
              />
            </div>

            {/* Applies To */}
            <div className="space-y-2">
              <Label>
                Applies To <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Select at least one operation
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.values(RuleApplicability).map((operation) => (
                  <button
                    key={operation}
                    type="button"
                    onClick={() => toggleApplicability(operation)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      formData.applicableTo.includes(operation)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {formData.applicableTo.includes(operation) && "✓ "}
                    {operation}
                  </button>
                ))}
              </div>
              {errors.applicableTo && (
                <p className="text-sm text-destructive">{errors.applicableTo}</p>
              )}
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>
                Color <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, color: option.value }))
                    }
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-colors",
                      formData.color === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full", option.class)} />
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Press Enter to add)</Label>
              <div className="space-y-2">
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleTagRemove(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X size={14} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                  placeholder="Add tag and press Enter"
                />
              </div>
            </div>

            {/* Rule Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">
                  Rule Content <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-primary hover:underline"
                >
                  {showPreview ? "Edit" : "Preview"}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Markdown supported
              </p>

              {showPreview ? (
                <div className="border rounded-md p-4 min-h-[200px] prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap">{formData.content}</pre>
                </div>
              ) : (
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  placeholder="When generating DSA content:&#10;- Include Python and Java implementations&#10;- Add time/space complexity analysis&#10;- Provide step-by-step walkthrough"
                  rows={10}
                  className={errors.content ? "border-destructive" : ""}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Characters: {formData.content.length} / 10,000
                </span>
                {errors.content && (
                  <p className="text-sm text-destructive">{errors.content}</p>
                )}
              </div>
            </div>

            {/* Default Rule Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isDefault: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border-border"
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Set as default rule (Auto-select for applicable operations)
              </Label>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
                {errors.submit}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating}
            >
              {isCreating || isUpdating
                ? "Saving..."
                : isEditMode
                ? "Update Rule"
                : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
