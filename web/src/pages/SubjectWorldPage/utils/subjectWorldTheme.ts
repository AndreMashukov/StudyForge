import { SubjectWorldTheme } from '@shared-types';

export interface ISceneThemePalette {
  zoneColors: string[];
  wallColor: string;
  pathColor: string;
  portalOpenColor: string;
  portalLockedColor: string;
  skyColor: string;
  fogColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
}

const THEME_PALETTES: Record<SubjectWorldTheme, ISceneThemePalette> = {
  voxel: {
    zoneColors: ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6'],
    wallColor: '#27272a',
    pathColor: '#52525b',
    portalOpenColor: '#22c55e',
    portalLockedColor: '#ef4444',
    skyColor: '#0a0a0a',
    fogColor: '#0a0a0a',
    ambientIntensity: 0.6,
    directionalIntensity: 0.8,
  },
  museum: {
    zoneColors: ['#d4c4a8', '#c9b896', '#b8a882', '#a89870', '#988860', '#887850'],
    wallColor: '#78716c',
    pathColor: '#a8a29e',
    portalOpenColor: '#ca8a04',
    portalLockedColor: '#b91c1c',
    skyColor: '#1c1917',
    fogColor: '#292524',
    ambientIntensity: 0.75,
    directionalIntensity: 0.65,
  },
  outdoor: {
    zoneColors: ['#4ade80', '#86efac', '#bbf7d0', '#65a30d', '#15803d', '#166534'],
    wallColor: '#365314',
    pathColor: '#78716c',
    portalOpenColor: '#eab308',
    portalLockedColor: '#dc2626',
    skyColor: '#7dd3fc',
    fogColor: '#bae6fd',
    ambientIntensity: 0.85,
    directionalIntensity: 1,
  },
  lab: {
    zoneColors: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7'],
    wallColor: '#64748b',
    pathColor: '#cbd5e1',
    portalOpenColor: '#06b6d4',
    portalLockedColor: '#e11d48',
    skyColor: '#f8fafc',
    fogColor: '#e2e8f0',
    ambientIntensity: 0.9,
    directionalIntensity: 0.7,
  },
  space: {
    zoneColors: ['#312e81', '#3730a3', '#4338ca', '#4c1d95', '#581c87', '#6b21a8'],
    wallColor: '#1e1b4b',
    pathColor: '#6366f1',
    portalOpenColor: '#a78bfa',
    portalLockedColor: '#f43f5e',
    skyColor: '#020617',
    fogColor: '#0f172a',
    ambientIntensity: 0.45,
    directionalIntensity: 0.9,
  },
};

export function getThemePalette(theme: SubjectWorldTheme): ISceneThemePalette {
  return THEME_PALETTES[theme] ?? THEME_PALETTES.voxel;
}
