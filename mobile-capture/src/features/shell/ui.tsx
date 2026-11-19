import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading, Text, cn, mobileUiColors } from '@studyforge/mobile-ui';
import { OFFLINE_MESSAGE, useIsOnline } from '../../lib/network/online';

type IconName = keyof typeof MaterialIcons.glyphMap;

export interface IItemRow {
  icon: IconName;
  title: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
  trailingIcon?: IconName | null;
  accessibilityHint?: string;
}

/** List row from the spec: icon tile, title, one-line subtitle, chevron or status badge. */
export function ItemRow({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  trailingIcon = 'chevron-right',
  accessibilityHint,
}: IItemRow) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={!onPress}
      className="min-h-14 flex-row items-center gap-3 py-2.5 active:opacity-60"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-card">
        <MaterialIcons
          name={icon}
          size={20}
          color={mobileUiColors.mutedForeground}
        />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-medium">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View className="rounded-full bg-card px-2 py-0.5">
          <Text variant="caption" tone="muted">
            {badge}
          </Text>
        </View>
      ) : trailingIcon ? (
        <MaterialIcons
          name={trailingIcon}
          size={20}
          color={mobileUiColors.placeholder}
        />
      ) : null}
    </Pressable>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <View className="mt-5 mb-1 flex-row items-baseline justify-between">
      <Text variant="label" tone="muted">
        {children}
      </Text>
      {action}
    </View>
  );
}

export function Chip({
  label,
  icon,
  onPress,
  selected = false,
  disabled = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5',
        selected ? 'border-primary bg-primary' : 'border-border bg-background',
        disabled && 'opacity-50',
      )}
    >
      {icon ? (
        <MaterialIcons
          name={icon}
          size={16}
          color={
            selected
              ? mobileUiColors.primaryForeground
              : mobileUiColors.foreground
          }
        />
      ) : null}
      <Text
        variant="caption"
        className={selected ? 'text-primary-foreground' : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface ISheet {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet on a native Modal, so Android back closes it before navigation (decision 13). */
export function Sheet({ visible, title, onClose, children }: ISheet) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityLabel="Close"
        className="flex-1 bg-black/30"
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView
          edges={['bottom']}
          className="max-h-[640px] rounded-t-[28px] bg-background px-container pb-4 pt-2"
        >
          <View className="mb-2 h-1.5 w-10 self-center rounded-full bg-border" />
          <View className="mb-2 flex-row items-center justify-between">
            <Heading level={3}>{title}</Heading>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center"
            >
              <MaterialIcons
                name="close"
                size={22}
                color={mobileUiColors.foreground}
              />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Screen root that lifts a bottom Composer above the soft keyboard. Android runs
 * edge-to-edge, so adjustResize no longer shrinks the window and both platforms
 * need padding applied in JS.
 */
export function KeyboardAwareView({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: mobileUiColors.background }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export interface IComposer {
  placeholder: string;
  onSend: (text: string) => void;
  onCapture?: () => void;
  disabled?: boolean;
  /** A reply is in progress: the send button becomes Stop (when onStop is set). */
  busy?: boolean;
  onStop?: () => void;
  stopDisabled?: boolean;
}

/** Pill composer: + opens capture for the current directory; send hands the text to the assistant. */
export function Composer({
  placeholder,
  onSend,
  onCapture,
  disabled = false,
  busy = false,
  onStop,
  stopDisabled = false,
}: IComposer) {
  const [text, setText] = useState('');
  const online = useIsOnline();
  const canSend = online && !disabled && text.trim().length > 0;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <SafeAreaView edges={['bottom']} className="bg-background px-3 pb-2 pt-1.5">
      <View className="min-h-[52px] flex-row items-center gap-1 rounded-[28px] border border-border bg-background px-1.5">
        {onCapture ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture or attach"
            onPress={onCapture}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <MaterialIcons
              name="add"
              size={24}
              color={mobileUiColors.foreground}
            />
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={online ? placeholder : OFFLINE_MESSAGE}
          placeholderTextColor={mobileUiColors.placeholder}
          editable={online && !disabled}
          onSubmitEditing={submit}
          returnKeyType="send"
          multiline
          accessibilityLabel="Message"
          className="max-h-28 flex-1 px-1.5 py-2.5 font-sans text-base text-foreground"
        />
        {busy && onStop ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            accessibilityState={{ disabled: stopDisabled }}
            disabled={stopDisabled}
            onPress={onStop}
            className="h-10 w-10 items-center justify-center rounded-full bg-card"
          >
            <MaterialIcons
              name="stop"
              size={20}
              color={
                stopDisabled
                  ? mobileUiColors.placeholder
                  : mobileUiColors.foreground
              }
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
            className={cn(
              'h-10 w-10 items-center justify-center rounded-full',
              canSend ? 'bg-primary' : 'bg-card',
            )}
          >
            <MaterialIcons
              name="arrow-upward"
              size={20}
              color={
                canSend
                  ? mobileUiColors.primaryForeground
                  : mobileUiColors.placeholder
              }
            />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2 bg-card px-container py-2"
    >
      <MaterialIcons
        name="cloud-off"
        size={16}
        color={mobileUiColors.mutedForeground}
      />
      <Text variant="caption" tone="muted">
        Offline. Recently opened items still work.
      </Text>
    </View>
  );
}

export function Notice({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'destructive';
  children: string;
}) {
  return (
    <View className="my-2 rounded-2xl bg-card px-4 py-3">
      <Text variant="caption" tone={tone}>
        {children}
      </Text>
    </View>
  );
}
