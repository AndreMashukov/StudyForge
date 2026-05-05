import { Theme, ThemeId } from '../types/theme';

export const themes: Record<ThemeId, Theme> = {
  // Sourced from Stitch design system: "StudyForge Brand System" (assets/88f92619a22e4c979fbc91d3035468c1)
  light: {
    name: 'Lumen',
    id: 'light',
    colors: {
      background: 'rgb(254 247 255)', // #fef7ff - surface
      foreground: 'rgb(29 26 36)', // #1d1a24 - on_surface
      card: 'rgb(255 255 255)', // #ffffff - surface_container_lowest
      cardForeground: 'rgb(29 26 36)', // #1d1a24
      popover: 'rgb(255 255 255)', // #ffffff
      popoverForeground: 'rgb(29 26 36)', // #1d1a24
      primary: 'rgb(99 14 212)', // #630ed4 - primary
      primaryForeground: 'rgb(255 255 255)', // #ffffff - on_primary
      secondary: 'rgb(249 241 255)', // #f9f1ff - surface_container_low
      secondaryForeground: 'rgb(29 26 36)', // #1d1a24
      muted: 'rgb(243 235 250)', // #f3ebfa - surface_container
      mutedForeground: 'rgb(74 68 85)', // #4a4455 - on_surface_variant
      accent: 'rgb(124 58 237)', // #7c3aed - primary_container
      accentForeground: 'rgb(255 255 255)', // #ffffff
      destructive: 'rgb(186 26 26)', // #ba1a1a - error
      destructiveForeground: 'rgb(255 255 255)', // #ffffff - on_error
      success: 'rgb(16 185 129)', // #10B981 - emerald-success
      successForeground: 'rgb(255 255 255)', // #ffffff
      border: 'rgb(123 116 135)', // #7b7487 - outline
      input: 'rgb(243 235 250)', // #f3ebfa - surface_container
      ring: 'rgb(99 14 212)', // #630ed4 - primary
      radius: '0.5rem',
      sidebar: 'rgb(249 241 255)', // #f9f1ff - surface_container_low
      dropdown: 'rgb(255 255 255)', // #ffffff - surface_container_lowest
      overlay: 'rgba(29 26 36 / 0.6)', // on_surface with opacity
      glass: 'rgba(255 255 255 / 0.9)',
      glow: 'rgba(99 14 212 / 0.15)', // primary glow
    },
  },
  // Sourced from Stitch design system: "StudyForge Dark Mode" (assets/5cf2790741584593bd7b356d84e7da56)
  linear: {
    name: 'Bit Depth',
    id: 'linear',
    colors: {
      background: 'rgb(21 18 27)', // #15121b - surface/surface_dim
      foreground: 'rgb(232 223 238)', // #e8dfee - on_surface
      card: 'rgb(29 26 36)', // #1d1a24 - surface_container_low
      cardForeground: 'rgb(232 223 238)', // #e8dfee
      popover: 'rgb(34 30 40)', // #221e28 - surface_container
      popoverForeground: 'rgb(232 223 238)', // #e8dfee
      primary: 'rgb(210 187 255)', // #d2bbff - primary (on dark bg)
      primaryForeground: 'rgb(63 0 142)', // #3f008e - on_primary
      secondary: 'rgb(34 30 40)', // #221e28 - surface_container
      secondaryForeground: 'rgb(232 223 238)', // #e8dfee
      muted: 'rgb(34 30 40)', // #221e28 - surface_container
      mutedForeground: 'rgb(204 195 216)', // #ccc3d8 - on_surface_variant
      accent: 'rgb(124 58 237)', // #7c3aed - primary_container
      accentForeground: 'rgb(232 223 238)', // #e8dfee
      destructive: 'rgb(255 180 171)', // #ffb4ab - error (on dark)
      destructiveForeground: 'rgb(105 0 5)', // #690005 - on_error
      success: 'rgb(16 185 129)', // #10B981 - emerald-success
      successForeground: 'rgb(255 255 255)', // #ffffff
      border: 'rgb(74 68 85)', // #4a4455 - outline_variant
      input: 'rgb(34 30 40)', // #221e28 - surface_container
      ring: 'rgb(210 187 255)', // #d2bbff - primary (on dark)
      radius: '0.375rem',
      sidebar: 'rgb(16 13 22)', // #100d16 - surface_container_lowest
      dropdown: 'rgb(44 40 51)', // #2c2833 - surface_container_high
      overlay: 'rgba(0 0 0 / 0.9)',
      glass: 'rgba(34 30 40 / 0.8)', // surface_container
      glow: 'rgba(210 187 255 / 0.2)', // primary glow (on dark)
    },
  },
};

export const defaultTheme: ThemeId = 'linear';