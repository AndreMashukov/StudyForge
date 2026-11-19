import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveMock = vi.hoisted(() => vi.fn());

vi.mock('./llm-generation-route-resolver', () => ({
  LlmGenerationRouteResolver: { resolve: resolveMock },
}));

import {
  buildDecisionsUrl,
  diagramCountFromScore,
  evaluateMermaidDiagramCount,
  evaluateMermaidDiagramSuitability,
} from './prompt-diagram-decisions-client';

const fetchMock = vi.fn();

function routeResolution(overrides: Record<string, unknown> = {}) {
  return {
    route: {
      connectionId: 'openrouter-primary',
      providerType: 'openrouter',
      model: 'google/gemini-decision-1',
      fallbackUsed: false,
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
      ...overrides,
    },
    providerApiKey: 'test-key',
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function sentBody(): { model: string; state: string; questions: Record<string, { type: string }> } {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init.body);
}

describe('prompt diagram decisions client', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    fetchMock.mockReset();
    resolveMock.mockResolvedValue(routeResolution());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the model and key from the promptDiagramDecision route', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ answers: { mermaid_suitable: { type: 'noul', noul: 0.9 } } }),
    );

    await evaluateMermaidDiagramSuitability({ userId: 'user-1', prompt: 'Explain TCP' });

    expect(resolveMock).toHaveBeenCalledWith('promptDiagramDecision', { userId: 'user-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(sentBody().model).toBe('google/gemini-decision-1');
    expect(sentBody().state).toBe('Explain TCP');
    expect(sentBody().questions.mermaid_suitable.type).toBe('noul');
  });

  it('applies the 0.6 suitability threshold', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ answers: { mermaid_suitable: { type: 'noul', noul: 0.6 } } }),
    );
    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).resolves.toEqual({ probability: 0.6, suitable: true });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ answers: { mermaid_suitable: { type: 'noul', noul: 0.59 } } }),
    );
    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).resolves.toEqual({ probability: 0.59, suitable: false });
  });

  it('maps the score answer to a diagram count', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ answers: { diagram_count: { type: 'score', score: 1.74 } } }),
    );

    await expect(
      evaluateMermaidDiagramCount({ userId: 'u', prompt: 'p' }),
    ).resolves.toEqual({ maxDiagrams: 3 });
    expect(sentBody().questions.diagram_count.type).toBe('score');
  });

  it('treats a refusal as an error, not a negative verdict', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ answers: { mermaid_suitable: { type: 'refusal' } } }),
    );

    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).rejects.toThrow('declined to answer mermaid_suitable');
  });

  it('rejects a missing or malformed answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ answers: {} }));

    await expect(
      evaluateMermaidDiagramCount({ userId: 'u', prompt: 'p' }),
    ).rejects.toThrow('no valid diagram_count answer');
  });

  it('surfaces API errors with the status and model', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limited' }, 429));

    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).rejects.toThrow('Decisions API error 429 (google/gemini-decision-1)');
  });

  it('refuses routes that are not on OpenRouter', async () => {
    resolveMock.mockResolvedValue(routeResolution({ providerType: 'together' }));

    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).rejects.toThrow('needs an OpenRouter connection');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to call without credentials', async () => {
    resolveMock.mockResolvedValue({ ...routeResolution(), providerApiKey: undefined });

    await expect(
      evaluateMermaidDiagramSuitability({ userId: 'u', prompt: 'p' }),
    ).rejects.toThrow('credentials are missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('buildDecisionsUrl', () => {
  it('replaces the /api/v1 prefix of the connection base URL', () => {
    expect(buildDecisionsUrl('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/alpha/decisions',
    );
    expect(buildDecisionsUrl('https://proxy.example.com/api/v1/')).toBe(
      'https://proxy.example.com/api/alpha/decisions',
    );
  });

  it('falls back to the public OpenRouter host', () => {
    expect(buildDecisionsUrl(undefined)).toBe('https://openrouter.ai/api/alpha/decisions');
  });
});

describe('diagramCountFromScore', () => {
  it('rounds and clamps the 0-based score into 1..5', () => {
    expect(diagramCountFromScore(0.17)).toBe(1);
    expect(diagramCountFromScore(1.04)).toBe(2);
    expect(diagramCountFromScore(3.79)).toBe(5);
    expect(diagramCountFromScore(9)).toBe(5);
    expect(diagramCountFromScore(-2)).toBe(1);
  });

  it('rejects non-finite scores', () => {
    expect(() => diagramCountFromScore(Number.NaN)).toThrow('finite number');
  });
});
