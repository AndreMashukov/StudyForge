import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callCallable, CallableRequestError } from './callableClient';

const { getIdToken, ensureAppCheckToken } = vi.hoisted(() => ({
  getIdToken: vi.fn(async () => 'id-token'),
  ensureAppCheckToken: vi.fn(async () => 'app-check-token'),
}));

vi.mock('../config/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: () => getIdToken(),
    },
  },
  ensureAppCheckToken: () => ensureAppCheckToken(),
  firebaseProjectId: 'study-forge-202604',
  useEmulator: false,
}));

describe('callCallable', () => {
  beforeEach(() => {
    getIdToken.mockReset();
    getIdToken.mockResolvedValue('id-token');
    ensureAppCheckToken.mockReset();
    ensureAppCheckToken.mockResolvedValue('app-check-token');
  });

  it('sends the App Check token that httpsCallable was omitting', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { success: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callCallable('generateFromPrompt', { prompt: 'hi' });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://asia-east1-study-forge-202604.cloudfunctions.net/generateFromPrompt',
    );
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer id-token');
    expect(headers['X-Firebase-AppCheck']).toBe('app-check-token');
    expect(init.body).toBe(JSON.stringify({ data: { prompt: 'hi' } }));
  });

  it('does not call the function when App Check has no token', async () => {
    ensureAppCheckToken.mockRejectedValue(new Error('unavailable'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(callCallable('generateFromPrompt', {})).rejects.toThrow(
      'unavailable',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a callable 401 body to functions/unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: { status: 'UNAUTHENTICATED', message: 'Unauthenticated' },
          }),
          { status: 401 },
        );
      }),
    );

    await expect(callCallable('generateFromPrompt', {})).rejects.toBeInstanceOf(
      CallableRequestError,
    );
    await expect(callCallable('generateFromPrompt', {})).rejects.toMatchObject({
      code: 'functions/unauthenticated',
      message: 'Unauthenticated',
    });
  });
});
