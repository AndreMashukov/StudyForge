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
          'bg-input border border-border rounded-xl px-3.5 py-3 mb-2',
          disabled && 'opacity-50',
          className
        )}
      >
        <Text className={cn('text-base', value ? 'text-foreground' : 'text-muted-foreground')}>
          {selectedLabel}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-card rounded-t-3xl border border-border px-4 pt-4 pb-8 max-h-[60%]">
            <Text className="text-foreground text-lg font-semibold mb-3">Choose an option</Text>
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
                      'rounded-xl border px-3.5 py-3.5 mb-2',
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-background'
                    )}
                  >
                    <Text className="text-foreground text-base">{option.label}</Text>
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
