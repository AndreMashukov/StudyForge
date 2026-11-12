import { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text } from 'react-native';
import { mobileUiColors } from '../../tokens/colors';
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
          'h-11 flex-row items-center justify-between gap-2.5 border-b border-outline mb-2',
          disabled && 'opacity-50',
          className
        )}
      >
        <Text
          className={cn(
            'flex-1 text-sm leading-[17px] font-sans',
            value ? 'text-foreground' : 'text-outline'
          )}
        >
          {selectedLabel}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={22} color={mobileUiColors.foreground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-background rounded-t-[25px] px-container pt-6 pb-8 max-h-[60%]">
            <Text className="text-foreground text-lg leading-[22px] font-sans-bold mb-4">
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
                      'min-h-12 justify-center rounded-2xl border-2 px-4 py-3 mb-gutter',
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-background'
                    )}
                  >
                    <Text className="text-foreground text-sm leading-[17px] font-sans-medium">{option.label}</Text>
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
