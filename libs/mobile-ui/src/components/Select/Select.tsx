import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { ISelect } from './ISelect';

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  disabled,
  className,
}: ISelect) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          'min-h-12 bg-input border border-border rounded-lg px-3.5 py-3 mb-2',
          disabled && 'opacity-50',
          className
        )}
      >
        <Text
          className={cn(
            'text-base font-sans',
            value ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {selectedLabel}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-surface-high rounded-t-2xl border border-border px-container pt-4 pb-8 max-h-[60%]">
            <Text className="text-foreground text-lg leading-6 font-sans-semibold mb-3">
              Choose an option
            </Text>
            <ScrollView>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'min-h-12 rounded-lg border px-3.5 py-3 mb-gutter',
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    )}
                  >
                    <Text className="text-foreground text-base font-sans">{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
