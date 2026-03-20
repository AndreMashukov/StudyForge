import React, { useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { X } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useRuleEditorForm } from '../context/hooks/useRuleEditorForm';
import { RuleMarkdownPreview } from './RuleMarkdownPreview';
import { RuleApplicability, RuleColor } from '@shared-types';
import { cn } from '../../../lib/utils';

const colorOptions: { value: RuleColor; label: string; class: string }[] = [
  { value: RuleColor.RED, label: 'Red', class: 'bg-red-500' },
  { value: RuleColor.ORANGE, label: 'Orange', class: 'bg-orange-500' },
  { value: RuleColor.YELLOW, label: 'Yellow', class: 'bg-yellow-500' },
  { value: RuleColor.GREEN, label: 'Green', class: 'bg-green-500' },
  { value: RuleColor.BLUE, label: 'Blue', class: 'bg-blue-500' },
  { value: RuleColor.INDIGO, label: 'Indigo', class: 'bg-indigo-500' },
  { value: RuleColor.PURPLE, label: 'Purple', class: 'bg-purple-500' },
  { value: RuleColor.PINK, label: 'Pink', class: 'bg-pink-500' },
  { value: RuleColor.GRAY, label: 'Gray', class: 'bg-gray-500' },
];

export const RuleFormSection: React.FC = () => {
  const { currentTheme } = useTheme();
  const { formData, formErrors, updateField } = useRuleEditorForm();
  const colors = currentTheme.colors;

  const [tagInput, setTagInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        updateField('tags', [...formData.tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleTagRemove = (tag: string) => {
    updateField('tags', formData.tags.filter((t) => t !== tag));
  };

  const toggleApplicability = (operation: RuleApplicability) => {
    const updated = formData.applicableTo.includes(operation)
      ? formData.applicableTo.filter((op) => op !== operation)
      : [...formData.applicableTo, operation];
    updateField('applicableTo', updated);
  };

  const inputStyle = {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.foreground,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Rule Name */}
      <div className="space-y-2">
        <Label htmlFor="rule-name">
          Rule Name <span style={{ color: colors.destructive }}>*</span>
        </Label>
        <Input
          id="rule-name"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value.slice(0, 100))}
          placeholder="DSA Code Examples"
          maxLength={100}
          style={formErrors.name ? { ...inputStyle, borderColor: colors.destructive } : inputStyle}
        />
        {formErrors.name && (
          <p className="text-sm" style={{ color: colors.destructive }}>{formErrors.name}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="rule-description">Description (Optional)</Label>
        <Input
          id="rule-description"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Adds comprehensive code examples for DSA problems"
          style={inputStyle}
        />
      </div>

      {/* Applies To */}
      <div className="space-y-2">
        <Label>
          Applies To <span style={{ color: colors.destructive }}>*</span>
        </Label>
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          Select at least one operation
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(RuleApplicability).map((operation) => (
            <Button
              key={operation}
              variant="outline"
              size="sm"
              onClick={() => toggleApplicability(operation)}
              style={
                formData.applicableTo.includes(operation)
                  ? { backgroundColor: colors.primary, color: colors.primaryForeground, borderColor: colors.primary }
                  : { backgroundColor: colors.secondary, color: colors.secondaryForeground, borderColor: colors.border }
              }
            >
              {formData.applicableTo.includes(operation) && '✓ '}
              {operation}
            </Button>
          ))}
        </div>
        {formErrors.applicableTo && (
          <p className="text-sm" style={{ color: colors.destructive }}>{formErrors.applicableTo}</p>
        )}
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>
          Color <span style={{ color: colors.destructive }}>*</span>
        </Label>
        <div className="flex flex-wrap gap-3">
          {colorOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              onClick={() => updateField('color', option.value)}
              style={
                formData.color === option.value
                  ? { borderColor: colors.primary, backgroundColor: `${colors.primary}15` }
                  : { borderColor: colors.border }
              }
            >
              <div className={cn('w-4 h-4 rounded-full', option.class)} />
              <span className="text-sm ml-1">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="rule-tags">Tags (Press Enter to add)</Label>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTagRemove(tag)}
                    className="h-auto p-0 ml-1 hover:text-destructive"
                    style={{ color: colors.mutedForeground }}
                  >
                    <X size={14} />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <Input
            id="rule-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagAdd}
            placeholder="Add tag and press Enter"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Rule Content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="rule-content">
            Rule Content <span style={{ color: colors.destructive }}>*</span>
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            style={{ color: colors.primary }}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          Markdown supported
        </p>

        {showPreview ? (
          <RuleMarkdownPreview content={formData.content} />
        ) : (
          <Textarea
            id="rule-content"
            value={formData.content}
            onChange={(e) => updateField('content', e.target.value.slice(0, 100000))}
            placeholder={'When generating DSA content:\n- Include Python and Java implementations\n- Add time/space complexity analysis\n- Provide step-by-step walkthrough'}
            rows={10}
            style={formErrors.content ? { ...inputStyle, borderColor: colors.destructive } : inputStyle}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: colors.mutedForeground }}>
            Characters: {formData.content.length} / 100,000
          </span>
          {formErrors.content && (
            <p className="text-sm" style={{ color: colors.destructive }}>{formErrors.content}</p>
          )}
        </div>
      </div>

      {/* Default Rule Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="rule-isDefault"
          checked={formData.isDefault}
          onChange={(e) => updateField('isDefault', e.target.checked)}
          className="w-4 h-4 rounded"
          style={{ borderColor: colors.border }}
        />
        <Label htmlFor="rule-isDefault" className="cursor-pointer">
          Set as default rule (Auto-select for applicable operations)
        </Label>
      </div>

      {/* Submit Error */}
      {formErrors.submit && (
        <div
          className="px-4 py-3 rounded-md border"
          style={{
            backgroundColor: `${colors.destructive}15`,
            borderColor: colors.destructive,
            color: colors.destructive,
          }}
        >
          {formErrors.submit}
        </div>
      )}
    </div>
  );
};
