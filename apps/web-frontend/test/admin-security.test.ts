import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import {
  adminChangePassword,
  adminLogout,
  adminLogoutAll,
  cleanupAdminOrphanMedia,
  getAdminMe,
  getStoredAdminSession,
  listLearningUnits,
  saveAdminSession,
  scanAdminOrphanMedia,
  updateAdminMeProfile,
} from '../src/lib/admin-api';
import {
  validateAdminPasswordChange,
  validateAdminProfileForm,
} from '../src/components/admin/AdminProfileModal';
import type { AdminAuthSession } from '../src/types/admin';

const SESSION_KEY = 'lingoroad_admin_session';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

function createSerializedLocksMock() {
  const queues = new Map<string, Promise<unknown>>();
  let requestCount = 0;

  return {
    get requestCount(): number {
      return requestCount;
    },
    request<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
      requestCount += 1;
      const previous = queues.get(name) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(() => callback());
      queues.set(
        name,
        next.finally(() => {
          if (queues.get(name) === next) {
            queues.delete(name);
          }
        }),
      );
      return next;
    },
  };
}

function sampleSession(
  accessToken = 'access-v1',
  refreshToken = 'refresh-v1',
): AdminAuthSession {
  return {
    accessToken,
    refreshToken,
    user: {
      id: 'admin-1',
      email: 'admin@lingoroad.example.com',
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatarUrl: null,
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withMockBrowserEnv(
  run: (ctx: {
    storage: ReturnType<typeof createMemoryStorage>;
    locks: ReturnType<typeof createSerializedLocksMock>;
    setFetch: (impl: typeof fetch) => void;
  }) => Promise<void>,
): Promise<void> {
  const prevApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const prevWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const prevNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const prevFetch = globalThis.fetch;

  const storage = createMemoryStorage();
  const locks = createSerializedLocksMock();
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  const mockWindow = {
    localStorage: storage,
    addEventListener(type: string, fn: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (event: unknown) => void) {
      listeners.get(type)?.delete(fn);
    },
  };

  process.env.NEXT_PUBLIC_API_URL = 'https://api.lingoroad.example.com';
  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { locks },
    configurable: true,
    writable: true,
  });

  try {
    await run({
      storage,
      locks,
      setFetch(impl: typeof fetch) {
        globalThis.fetch = impl;
      },
    });
  } finally {
    globalThis.fetch = prevFetch;
    if (prevApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = prevApiUrl;
    }
    if (prevWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', prevWindowDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (prevNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', prevNavigatorDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
  }
}

describe('Wave 2 Frontend Security Hardening', () => {
  test('2 concurrent 401 adminFetch calls acquire navigator.locks and call /admin/auth/refresh ONLY once', async () => {
    await withMockBrowserEnv(async ({ locks, setFetch }) => {
      saveAdminSession(sampleSession('token-old', 'refresh-old'));

      let refreshCalls = 0;
      const seenAuthByPath: Record<string, string[]> = {};

      setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        const auth = headers.get('Authorization') ?? '';

        if (url.endsWith('/admin/auth/refresh')) {
          refreshCalls += 1;
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            refreshToken?: string;
          };
          assert.equal(body.refreshToken, 'refresh-old');
          // Delay briefly so both 401 callers genuinely contend for the lock
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
          return jsonResponse(200, {
            success: true,
            data: sampleSession('token-rotated', 'refresh-rotated'),
          });
        }

        if (url.endsWith('/admin/auth/me')) {
          seenAuthByPath['/admin/auth/me'] = [
            ...(seenAuthByPath['/admin/auth/me'] ?? []),
            auth,
          ];
          if (auth !== 'Bearer token-rotated') {
            return jsonResponse(401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Expired token' },
            });
          }
          return jsonResponse(200, {
            success: true,
            data: sampleSession('token-rotated', 'refresh-rotated').user,
          });
        }

        if (url.endsWith('/admin/units')) {
          seenAuthByPath['/admin/units'] = [
            ...(seenAuthByPath['/admin/units'] ?? []),
            auth,
          ];
          if (auth !== 'Bearer token-rotated') {
            return jsonResponse(401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Expired token' },
            });
          }
          return jsonResponse(200, {
            success: true,
            data: [{ id: 'unit-1', code: 'u1', cefrLevel: 'A1', orderIndex: 1, title: 'Unit 1', description: 'Desc', lessonsCount: 2 }],
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }) as typeof fetch);

      const [me, units] = await Promise.all([getAdminMe(), listLearningUnits()]);

      assert.equal(me.email, 'admin@lingoroad.example.com');
      assert.equal(units.length, 1);
      assert.equal(locks.requestCount, 2, 'Both 401 requests must serialize on navigator.locks');
      assert.equal(refreshCalls, 1, 'POST /admin/auth/refresh must fire ONLY once');
      assert.deepEqual(seenAuthByPath['/admin/auth/me'], [
        'Bearer token-old',
        'Bearer token-rotated',
      ]);
      assert.deepEqual(seenAuthByPath['/admin/units'], [
        'Bearer token-old',
        'Bearer token-rotated',
      ]);
      assert.equal(getStoredAdminSession()?.accessToken, 'token-rotated');
      assert.equal(getStoredAdminSession()?.refreshToken, 'refresh-rotated');
    });
  });

  test('refreshAdminSession aborts refresh inside lock if another tab already cleared session', async () => {
    await withMockBrowserEnv(async ({ storage, setFetch }) => {
      saveAdminSession(sampleSession('token-old', 'refresh-old'));

      let refreshCalls = 0;
      const prevNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          locks: {
            async request<T>(_name: string, cb: () => Promise<T> | T): Promise<T> {
              // Simulate another tab logging out before lock is acquired
              storage.removeItem(SESSION_KEY);
              return cb();
            },
          },
        },
        configurable: true,
        writable: true,
      });

      setFetch((async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/admin/auth/refresh')) {
          refreshCalls += 1;
          return jsonResponse(200, { success: true, data: sampleSession('x', 'y') });
        }
        return jsonResponse(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        });
      }) as typeof fetch);

      try {
        await assert.rejects(() => getAdminMe(), /Expired/);
        assert.equal(refreshCalls, 0);
      } finally {
        Object.defineProperty(globalThis, 'navigator', {
          value: prevNavigator,
          configurable: true,
          writable: true,
        });
      }
    });
  });

  test('adminLogout sends Authorization Bearer header BEFORE clearing localStorage and clears in finally', async () => {
    await withMockBrowserEnv(async ({ storage, setFetch }) => {
      saveAdminSession(sampleSession('logout-access', 'logout-refresh'));

      let sawSessionInStorageDuringFetch = false;
      let capturedAuthHeader: string | null = null;
      let capturedBody: { refreshToken?: string } | null = null;
      let capturedSignal: AbortSignal | null | undefined;

      setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(String(input), 'https://api.lingoroad.example.com/admin/auth/logout');
        assert.equal(init?.method, 'POST');
        sawSessionInStorageDuringFetch = storage.getItem(SESSION_KEY) !== null;
        capturedAuthHeader = new Headers(init?.headers).get('Authorization');
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as { refreshToken?: string };
        capturedSignal = init?.signal;
        return jsonResponse(200, { success: true, data: null });
      }) as typeof fetch);

      await adminLogout();

      assert.equal(
        sawSessionInStorageDuringFetch,
        true,
        'localStorage must still hold session while logout request is sent',
      );
      assert.equal(capturedAuthHeader, 'Bearer logout-access');
      assert.deepEqual(capturedBody, { refreshToken: 'logout-refresh' });
      assert.ok(capturedSignal instanceof AbortSignal);
      assert.equal(storage.getItem(SESSION_KEY), null, 'localStorage must be cleared after logout');

      // Also verify network errors still clear localStorage cleanly
      saveAdminSession(sampleSession('logout-access-2', 'logout-refresh-2'));
      setFetch((async () => {
        throw new Error('Network offline');
      }) as typeof fetch);

      await adminLogout();
      assert.equal(storage.getItem(SESSION_KEY), null);
    });
  });

  test('adminChangePassword saves rotated session and adminLogoutAll clears local session', async () => {
    await withMockBrowserEnv(async ({ storage, setFetch }) => {
      saveAdminSession(sampleSession('token-1', 'refresh-1'));

      setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const auth = new Headers(init?.headers).get('Authorization');
        if (url.endsWith('/admin/auth/change-password')) {
          assert.equal(auth, 'Bearer token-1');
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            currentPassword: string;
            newPassword: string;
          };
          assert.equal(body.currentPassword, 'OldPass123');
          assert.equal(body.newPassword, 'NewPass456');
          return jsonResponse(200, {
            success: true,
            data: sampleSession('token-2', 'refresh-2'),
          });
        }
        if (url.endsWith('/admin/auth/logout-all')) {
          assert.equal(auth, 'Bearer token-2');
          return jsonResponse(200, {
            success: true,
            data: { revokedSessionsCount: 3 },
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      }) as typeof fetch);

      const rotated = await adminChangePassword({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456',
      });
      assert.equal(rotated.accessToken, 'token-2');
      assert.equal(getStoredAdminSession()?.accessToken, 'token-2');

      const logoutAllRes = await adminLogoutAll();
      assert.equal(logoutAllRes.revokedSessionsCount, 3);
      assert.equal(storage.getItem(SESSION_KEY), null);
    });
  });

  test('next.config.mjs headers() outputs strict CSP with cloud apiOrigin, zero localhost, X-XSS-Protection 0, and Permissions-Policy', async () => {
    const prevApi = process.env.NEXT_PUBLIC_API_URL;
    const prevNodeEnv = process.env.NODE_ENV;
    const nextConfigMod = await import('../next.config.mjs');
    const nextConfig = nextConfigMod.default;
    const getHeaders = nextConfig.headers;
    assert.ok(typeof getHeaders === 'function', 'next.config.mjs must define headers()');

    try {
      process.env.NEXT_PUBLIC_API_URL = 'https://lingoroad-api-demo.azurewebsites.net/api/v1';
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const headerGroups = await getHeaders();
      assert.equal(headerGroups.length, 1);
      const headerMap = new Map<string, string>(
        headerGroups[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]),
      );

      const csp = headerMap.get('Content-Security-Policy') ?? '';
      assert.ok(csp.includes("default-src 'self'"), 'CSP must set default-src self');
      assert.ok(
        csp.includes('connect-src \'self\' https://lingoroad-api-demo.azurewebsites.net;'),
        'CSP connect-src must contain cloud apiOrigin',
      );
      assert.ok(
        csp.includes('img-src \'self\' data: blob: https://lingoroad-api-demo.azurewebsites.net https:;'),
        'CSP img-src must contain cloud apiOrigin',
      );
      assert.ok(
        csp.includes('media-src \'self\' blob: https://lingoroad-api-demo.azurewebsites.net;'),
        'CSP media-src must contain cloud apiOrigin',
      );
      assert.ok(csp.includes("frame-ancestors 'none';"));
      assert.ok(csp.includes("object-src 'none';"));
      assert.ok(csp.includes('upgrade-insecure-requests;'));
      assert.equal(csp.includes('localhost'), false, 'Cloud CSP must contain zero localhost references');
      assert.equal(csp.includes('127.0.0.1'), false, 'Cloud CSP must contain zero loopback references');
      assert.equal(csp.includes("'unsafe-eval'"), false, 'Production CSP must not include unsafe-eval');

      assert.equal(headerMap.get('X-XSS-Protection'), '0');
      assert.equal(
        headerMap.get('Permissions-Policy'),
        'camera=(), microphone=(), geolocation=()',
      );

      // Development mode fallback check
      delete process.env.NEXT_PUBLIC_API_URL;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      const devGroups = await getHeaders();
      const devCsp =
        devGroups[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy')
          ?.value ?? '';
      assert.ok(devCsp.includes('http://localhost:3000'));
      assert.ok(devCsp.includes("'unsafe-eval'"));
      assert.equal(devCsp.includes('upgrade-insecure-requests'), false);
    } finally {
      if (prevApi === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = prevApi;
      }
      if (prevNodeEnv === undefined) {
        delete (process.env as Record<string, string | undefined>).NODE_ENV;
      } else {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      }
    }
  });

  test('validateAdminPasswordChange enforces complexity & confirmation rules', () => {
    assert.ok(
      validateAdminPasswordChange({
        currentPassword: '',
        newPassword: 'Password1',
        confirmPassword: 'Password1',
      }),
    );
    assert.ok(
      validateAdminPasswordChange({
        currentPassword: 'OldPassword1',
        newPassword: 'Short1a',
        confirmPassword: 'Short1a',
      })?.includes('8 ký tự'),
    );
    assert.ok(
      validateAdminPasswordChange({
        currentPassword: 'OldPassword1',
        newPassword: 'alllowercase1',
        confirmPassword: 'alllowercase1',
      })?.includes('chữ hoa'),
    );
    assert.ok(
      validateAdminPasswordChange({
        currentPassword: 'OldPassword1',
        newPassword: 'NoDigitsHere',
        confirmPassword: 'NoDigitsHere',
      })?.includes('chữ số'),
    );
    assert.ok(
      validateAdminPasswordChange({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'DifferentPassword1',
      })?.includes('không khớp'),
    );
    assert.equal(
      validateAdminPasswordChange({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword2',
        confirmPassword: 'NewPassword2',
      }),
      null,
    );
  });

  test('AdminShell redirects to /admin/login when another tab clears lingoroad_admin_session via storage event', async () => {
    const storageHandlers: Array<(event: { key: string | null; newValue: string | null }) => void> = [];
    const prevWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener(type: string, handler: (event: { key: string | null; newValue: string | null }) => void) {
          if (type === 'storage') storageHandlers.push(handler);
        },
        removeEventListener() {},
      },
      configurable: true,
      writable: true,
    });

    try {
      const state: unknown[] = [];
      let cursor = 0;
      const effects: Array<() => void> = [];
      let redirectedTo: string | null = null;
      const filename = resolve(__dirname, '../src/components/admin/AdminShell.tsx');
      const mod = new Module(filename, module) as Module & {
        _compile(code: string, fname: string): void;
      };
      mod.filename = filename;
      const requireActual = Module.createRequire(filename);
      const mocks: Record<string, unknown> = {
        react: {
          Fragment: Symbol.for('react.fragment'),
          useState(initial: unknown) {
            const idx = cursor++;
            if (!(idx in state)) state[idx] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
            return [state[idx], (next: unknown) => { state[idx] = typeof next === 'function' ? (next as (v: unknown) => unknown)(state[idx]) : next; }];
          },
          useRef(initial: unknown) {
            const idx = cursor++;
            if (!(idx in state)) state[idx] = { current: initial };
            return state[idx];
          },
          useEffect(effect: () => void) {
            effects.push(effect);
          },
          createElement: (type: unknown, props: Record<string, unknown>, ...children: unknown[]) => ({
            type,
            props: { ...props, children },
          }),
        },
        'next/link': () => null,
        'next/navigation': {
          useRouter: () => ({ replace: (path: string) => { redirectedTo = path; } }),
          usePathname: () => '/admin',
        },
        'lucide-react': {},
        './LingoRoadWordmark': {},
        './AdminToast': { AdminToastProvider: ({ children }: { children: unknown }) => children },
        './AdminProfileModal': { AdminProfileModal: () => null },
        '@/lib/admin-api': {
          adminLogout: async () => undefined,
          clearAdminSession: () => undefined,
          getAdminMe: async () => sampleSession().user,
          getStoredAdminSession: () => sampleSession(),
          saveAdminSession: () => undefined,
        },
      };
      mod.require = ((id: string) =>
        Object.hasOwn(mocks, id) ? mocks[id] : requireActual(id)) as NodeRequire;
      mod._compile(
        ts.transpileModule(readFileSync(filename, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            jsx: ts.JsxEmit.React,
            esModuleInterop: true,
          },
        }).outputText,
        filename,
      );

      const { AdminShell } = mod.exports as {
        AdminShell: (props: Record<string, unknown>) => unknown;
      };
      AdminShell({
        breadcrumbTitle: 'Tổng quan',
        title: 'Admin',
        children: () => null,
      });
      for (const effect of effects) effect();

      assert.equal(storageHandlers.length, 1);
      // Unrelated key must be ignored
      storageHandlers[0]({ key: 'other_key', newValue: null });
      assert.equal(redirectedTo, null);

      // Clearing lingoroad_admin_session in another tab immediately redirects
      storageHandlers[0]({ key: SESSION_KEY, newValue: null });
      assert.equal(redirectedTo, '/admin/login');
    } finally {
      if (prevWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', prevWindowDescriptor);
      } else {
        delete (globalThis as Record<string, unknown>).window;
      }
    }
  });

  test('updateAdminMeProfile syncs localStorage session user while preserving tokens, and orphan media endpoints call expected paths', async () => {
    await withMockBrowserEnv(async ({ setFetch }) => {
      saveAdminSession(sampleSession('token-keep', 'refresh-keep'));

      setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/admin/auth/me') && method === 'PATCH') {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            name?: string;
            avatarUrl?: string | null;
          };
          return jsonResponse(200, {
            success: true,
            data: {
              ...sampleSession().user,
              name: body.name ?? 'Admin User',
              avatarUrl: body.avatarUrl ?? null,
            },
          });
        }
        if (url.includes('/admin/media/orphans?minAgeHours=72') && method === 'GET') {
          return jsonResponse(200, {
            success: true,
            data: {
              scannedAt: '2026-11-28T00:00:00.000Z',
              storage: 'azure',
              minAgeHours: 72,
              totalBlobs: 10,
              referencedCount: 8,
              protectedRecentCount: 1,
              orphanCount: 1,
              orphanBytes: 4096,
              orphans: [
                {
                  key: 'learning/v1/old.wav',
                  url: '/media/learning/v1/old.wav',
                  size: 4096,
                  lastModified: '2026-11-20T00:00:00.000Z',
                },
              ],
            },
          });
        }
        if (url.endsWith('/admin/media/orphans/cleanup') && method === 'POST') {
          return jsonResponse(200, {
            success: true,
            data: {
              cleanedAt: '2026-11-28T00:01:00.000Z',
              minAgeHours: 72,
              deletedCount: 1,
              deletedBytes: 4096,
              skippedCount: 0,
              deletedKeys: ['learning/v1/old.wav'],
            },
          });
        }
        throw new Error(`Unexpected URL: ${method} ${url}`);
      }) as typeof fetch);

      const updatedUser = await updateAdminMeProfile({
        name: 'Quản trị LingoRoad',
        avatarUrl: '/media/learning/v1/images/admin-avatar-abc123.png',
      });
      assert.equal(updatedUser.name, 'Quản trị LingoRoad');
      assert.equal(
        updatedUser.avatarUrl,
        '/media/learning/v1/images/admin-avatar-abc123.png',
      );
      const synced = getStoredAdminSession();
      assert.equal(synced?.accessToken, 'token-keep');
      assert.equal(synced?.refreshToken, 'refresh-keep');
      assert.equal(synced?.user.name, 'Quản trị LingoRoad');
      assert.equal(
        synced?.user.avatarUrl,
        '/media/learning/v1/images/admin-avatar-abc123.png',
      );

      const scan = await scanAdminOrphanMedia(72);
      assert.equal(scan.orphanCount, 1);
      assert.equal(scan.minAgeHours, 72);

      const cleanup = await cleanupAdminOrphanMedia({
        keys: ['learning/v1/old.wav'],
        minAgeHours: 72,
      });
      assert.equal(cleanup.deletedCount, 1);
      assert.deepEqual(cleanup.deletedKeys, ['learning/v1/old.wav']);
    });
  });

  test('validateAdminProfileForm enforces name bounds and blocks unsafe avatar URLs', () => {
    assert.ok(
      validateAdminProfileForm({ name: 'A', avatarUrl: '' })?.includes(
        '2 đến 100',
      ),
    );
    assert.ok(
      validateAdminProfileForm({
        name: 'Admin Hợp Lệ',
        avatarUrl: 'https://cdn.example.com/xss.svg',
      })?.includes('không dùng SVG'),
    );
    assert.ok(
      validateAdminProfileForm({
        name: 'Admin Hợp Lệ',
        avatarUrl: 'http://insecure.example.com/avatar.png',
      }),
    );
    assert.equal(
      validateAdminProfileForm({
        name: 'Admin Hợp Lệ',
        avatarUrl: '/media/learning/v1/images/admin-avatar-998877.webp',
      }),
      null,
    );
    assert.equal(
      validateAdminProfileForm({
        name: 'Admin Hợp Lệ',
        avatarUrl: '',
      }),
      null,
    );
  });
});
