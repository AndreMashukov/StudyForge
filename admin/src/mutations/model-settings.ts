'use client';

import { requestJson } from './client';

export async function saveGeminiSettings(payload: unknown) {
  return requestJson('/api/model-settings/gemini', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function testGeminiConnection() {
  return requestJson('/api/model-settings/gemini/test', { method: 'POST' });
}

export async function saveOpenRouterSettings(payload: unknown) {
  return requestJson('/api/model-settings/openrouter', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function testOpenRouterConnection() {
  return requestJson('/api/model-settings/openrouter/test', { method: 'POST' });
}

export async function saveMiniMaxSettings(payload: unknown) {
  return requestJson('/api/model-settings/minimax', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function testMiniMaxConnection() {
  return requestJson('/api/model-settings/minimax/test', { method: 'POST' });
}

export async function saveTogetherSettings(payload: unknown) {
  return requestJson('/api/model-settings/together', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function testTogetherConnection() {
  return requestJson('/api/model-settings/together/test', { method: 'POST' });
}
