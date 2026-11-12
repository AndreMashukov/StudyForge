/** CrowdsNow typography scale — Inter, line height ≈ 1.22 × font size. */
export const mobileUiTypography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '700' as const,
  },
  headlineMd: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700' as const,
  },
  titleSm: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  bodyBase: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '400' as const,
  },
  labelCaps: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600' as const,
  },
} as const;

export const mobileUiFontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
