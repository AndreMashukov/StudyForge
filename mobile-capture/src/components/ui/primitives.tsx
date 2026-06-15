import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cn } from '../../lib/utils/cn';

interface IButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  className?: string;
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  className,
}: IButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'rounded-xl px-4 py-3.5 items-center',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'bg-muted border border-border',
        variant === 'destructive' && 'bg-destructive',
        disabled && 'opacity-50',
        className
      )}
    >
      <Text className="text-base font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}

export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cn('flex-1 bg-background px-5', className)}>{children}</View>;
}

export function LoadingState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <ActivityIndicator size="large" color="#8b5cf6" />
      <Text className="text-muted-foreground text-base">{message}</Text>
    </View>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-foreground text-sm font-semibold mb-1">{children}</Text>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <Text className="text-destructive text-sm mb-2">{message}</Text>;
}

export function TextInputField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  multiline,
  numberOfLines,
  className,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
  numberOfLines?: number;
  className?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#71717a"
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={cn(
        'bg-input border border-border rounded-xl px-3.5 py-3 text-foreground text-base mb-2',
        multiline && 'min-h-[160px]',
        className
      )}
    />
  );
}
