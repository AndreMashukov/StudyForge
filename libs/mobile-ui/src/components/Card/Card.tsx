import { View } from 'react-native';
import { cn } from '../../lib/cn';
import type { ICard } from './ICard';

export function Card({ children, className }: ICard) {
  return (
    <View className={cn('rounded-3xl bg-card p-4', className)}>{children}</View>
  );
}
