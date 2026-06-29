/** Obsidian Pulse typography scale — Google Stitch "Modern AI Chat Interface". */
export const mobileUiTypography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.02,
  },
  headlineMd: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: -0.01,
  },
  titleSm: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  bodyBase: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  labelCaps: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.05,
  },
} as const;

export const mobileUiFontFamily = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
} as const;
