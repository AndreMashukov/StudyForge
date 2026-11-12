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
          'h-12 flex-row items-center justify-between gap-2.5 rounded-full bg-input px-4 mb-2',
          disabled && 'opacity-50',
          className
        )}
      >
        <Text
          className={cn(
            'flex-1 text-base leading-6 font-sans',
            value ? 'text-foreground' : 'text-outline'
          )}
        >
          {selectedLabel}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={22} color={mobileUiColors.foreground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-background rounded-t-[28px] px-container pt-6 pb-8 max-h-[60%]">
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
                      'min-h-12 justify-center rounded-2xl px-4 py-3 mb-1',
                      selected ? 'bg-muted' : 'bg-background'
                    )}
                  >
                    <Text className="text-foreground text-base leading-6 font-sans">{option.label}</Text>
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
