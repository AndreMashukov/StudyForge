/** Monochrome chat-app color tokens — white canvas, near-black ink, soft gray fills. */
export const mobileUiColors = {
  background: 'rgb(255, 255, 255)',
  foreground: 'rgb(13, 13, 13)',
  card: 'rgb(244, 244, 244)',
  primary: 'rgb(13, 13, 13)',
  primaryForeground: 'rgb(255, 255, 255)',
  accent: 'rgb(16, 163, 127)',
  muted: 'rgb(244, 244, 244)',
  mutedForeground: 'rgb(93, 93, 93)',
  placeholder: 'rgb(143, 143, 143)',
  destructive: 'rgb(220, 38, 38)',
  errorContainer: 'rgb(254, 226, 226)',
  onErrorContainer: 'rgb(185, 28, 28)',
  border: 'rgb(236, 236, 236)',
  input: 'rgb(244, 244, 244)',
  ring: 'rgb(13, 13, 13)',
  surfaceContainerHigh: 'rgb(255, 255, 255)',
  surfaceContainerLowest: 'rgb(255, 255, 255)',
  outline: 'rgb(143, 143, 143)',
  outlineVariant: 'rgb(229, 229, 229)',
  switchOff: 'rgb(215, 215, 215)',
  tabBar: 'rgb(244, 244, 244)',
  tabBarInactive: 'rgb(93, 93, 93)',
} as const;

export const mobileUiDesignSystem = {
  name: 'Monochrome Chat',
} as const;
