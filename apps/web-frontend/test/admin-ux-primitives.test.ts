import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import {
  buildQueryString,
  buildQueryUrl,
  normalizeQueryString,
  parseEnumParam,
  parsePositiveIntParam,
} from '../src/lib/use-admin-query-params';
import {
  ADMIN_TOAST_AUTO_DISMISS_MS,
  MAX_VISIBLE_TOASTS,
  NOOP_ADMIN_TOAST,
  appendToastItem,
  getToastAutoDismissMs,
  removeToastItem,
  type AdminToastItem,
} from '../src/components/admin/AdminToast';
import {
  DEFAULT_CONFIRM_DIALOG_LABELS,
  canDismissConfirmDialog,
  getConfirmDialogToneConfig,
} from '../src/components/admin/ConfirmDialog';
import { formatAppVersion } from '../src/lib/admin-validation';

function loadClientModule(file: string, mocks: Record<string, unknown>) {
  const filename = resolve(__dirname, '../src', file);
  const mod = new Module(filename, module) as Module & {
    _compile(code: string, filename: string): void;
  };
  mod.filename = filename;
  const requireActual = Module.createRequire(filename);
  mod.require = (id: string) =>
    Object.hasOwn(mocks, id) ? mocks[id] : requireActual(id);
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
  return mod.exports;
}

interface MockNode {
  type: unknown;
  props?: Record<string, unknown> & { children?: unknown[] };
}

function createHookHarness() {
  const state: unknown[] = [];
  let cursor = 0;
  let idCounter = 0;
  const effects: Array<() => void | (() => void)> = [];
  const contextValues = new Map<unknown, unknown>();

  const react = {
    createContext<T>(defaultValue: T) {
      const ctx = {
        _defaultValue: defaultValue,
        Provider: ({
          value,
          children,
        }: {
          value: T;
          children?: unknown;
        }) => {
          contextValues.set(ctx, value);
          return { type: 'ContextProvider', props: { value, children } };
        },
      };
      return ctx;
    },
    useContext<T>(ctx: { _defaultValue: T }): T {
      return contextValues.has(ctx)
        ? (contextValues.get(ctx) as T)
        : ctx._defaultValue;
    },
    useState<T>(initial: T | (() => T)) {
      const index = cursor++;
      if (!(index in state)) {
        state[index] =
          typeof initial === 'function' ? (initial as () => T)() : initial;
      }
      const setter = (next: T | ((prev: T) => T)) => {
        state[index] =
          typeof next === 'function'
            ? (next as (prev: T) => T)(state[index] as T)
            : next;
      };
      return [state[index] as T, setter] as const;
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!(index in state)) {
        state[index] = { current: initial };
      }
      return state[index] as { current: T };
    },
    useCallback<T extends (...args: unknown[]) => unknown>(fn: T): T {
      return fn;
    },
    useMemo<T>(compute: () => T): T {
      return compute();
    },
    useEffect(effect: () => void | (() => void)) {
      effects.push(effect);
    },
    useId() {
      idCounter += 1;
      return `test-id-${idCounter}`;
    },
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      return { type, props: { ...(props ?? {}), children } };
    },
  };

  return {
    react,
    effects,
    render<T>(fn: (props?: unknown) => T, props?: unknown): T {
      cursor = 0;
      return fn(props);
    },
  };
}

function collectNodes(node: unknown): MockNode[] {
  if (!node || typeof node !== 'object') return [];
  const mock = node as MockNode;
  const children = Array.isArray(mock.props?.children)
    ? mock.props.children.flat(Infinity)
    : mock.props?.children !== undefined
      ? [mock.props.children]
      : [];
  return [mock, ...children.flatMap(collectNodes)];
}

function collectText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  const mock = node as MockNode;
  const children = Array.isArray(mock.props?.children)
    ? mock.props.children.flat(Infinity)
    : mock.props?.children !== undefined
      ? [mock.props.children]
      : [];
  return children.map(collectText).join(' ');
}

describe('Admin Query Params helpers & hook', () => {
  test('parsePositiveIntParam parses valid integers and rejects invalid values', () => {
    assert.equal(parsePositiveIntParam('3', 1), 3);
    assert.equal(parsePositiveIntParam(' 42 ', 1), 42);
    assert.equal(parsePositiveIntParam('0', 1), 1);
    assert.equal(parsePositiveIntParam('-5', 1), 1);
    assert.equal(parsePositiveIntParam('2.5', 1), 1);
    assert.equal(parsePositiveIntParam('12abc', 1), 1);
    assert.equal(parsePositiveIntParam('1e3', 1), 1);
    assert.equal(parsePositiveIntParam('', 10), 10);
    assert.equal(parsePositiveIntParam('   ', 10), 10);
    assert.equal(parsePositiveIntParam(null, 10), 10);
    assert.equal(parsePositiveIntParam(undefined, 10), 10);
    assert.equal(parsePositiveIntParam('250', 10, { max: 50 }), 50);
    assert.equal(parsePositiveIntParam('2', 10, { min: 5, max: 50 }), 5);
  });

  test('parseEnumParam validates allowlist values safely', () => {
    const roles = ['ADMIN', 'LEARNER'] as const;
    assert.equal(parseEnumParam('ADMIN', roles), 'ADMIN');
    assert.equal(parseEnumParam(' LEARNER ', roles), 'LEARNER');
    assert.equal(parseEnumParam('SUPERADMIN', roles), '');
    assert.equal(parseEnumParam(null, roles, 'LEARNER'), 'LEARNER');
  });

  test('buildQueryString omits empty/default values and produces deterministic sorted query', () => {
    assert.equal(
      buildQueryString({
        search: '  ngữ pháp  ',
        page: 2,
        role: '',
        status: null,
        unused: undefined,
        nanVal: Number.NaN,
        published: true,
      }),
      'page=2&published=true&search=ng%E1%BB%AF+ph%C3%A1p',
    );

    assert.equal(
      buildQueryString(
        { page: 1, limit: 10, role: 'ADMIN', search: '   ' },
        { page: 1, limit: 10 },
      ),
      'role=ADMIN',
    );

    assert.equal(
      buildQueryString({ page: 1, limit: 10 }, { page: 1, limit: 10 }),
      '',
    );
  });

  test('normalizeQueryString and buildQueryUrl canonicalize URLs cleanly', () => {
    assert.equal(
      normalizeQueryString('?role=ADMIN&page=2&empty='),
      'page=2&role=ADMIN',
    );
    assert.equal(buildQueryUrl('/admin/users', ''), '/admin/users');
    assert.equal(
      buildQueryUrl('/admin/users', 'page=2&role=ADMIN'),
      '/admin/users?page=2&role=ADMIN',
    );
  });

  test('useAdminQueryParams reads searchParams, deduplicates router.replace, and falls back safely', () => {
    const hooks = createHookHarness();
    const replaced: Array<{ url: string; options: unknown }> = [];

    const { useAdminQueryParams } = loadClientModule(
      'lib/use-admin-query-params.ts',
      {
        react: hooks.react,
        'next/navigation': {
          useRouter: () => ({
            replace: (url: string, options: unknown) => {
              replaced.push({ url, options });
            },
          }),
          usePathname: () => '/admin/users',
          useSearchParams: () => new URLSearchParams('page=3&role=ADMIN'),
        },
      },
    );

    const api = hooks.render(() => useAdminQueryParams());
    assert.equal(api.getPositiveIntParam('page', 1), 3);
    assert.equal(api.getParam('role'), 'ADMIN');
    assert.equal(api.getParam('missing', 'default'), 'default');

    // Syncing identical params must NOT trigger router.replace (prevents loops)
    api.syncParams({ page: 3, role: 'ADMIN' }, { defaults: { page: 1 } });
    assert.equal(replaced.length, 0);

    // Syncing updated params triggers router.replace once with { scroll: false }
    api.syncParams(
      { page: 1, role: 'LEARNER', search: 'anh' },
      { defaults: { page: 1 } },
    );
    assert.equal(replaced.length, 1);
    assert.deepEqual(replaced[0], {
      url: '/admin/users?role=LEARNER&search=anh',
      options: { scroll: false },
    });

    // Calling again with identical params does not loop
    api.syncParams(
      { page: 1, role: 'LEARNER', search: 'anh' },
      { defaults: { page: 1 } },
    );
    assert.equal(replaced.length, 1);

    // Safe fallback when Next.js router/searchParams throw (e.g. static or standalone test)
    const fallbackHooks = createHookHarness();
    const { useAdminQueryParams: useFallbackQueryParams } = loadClientModule(
      'lib/use-admin-query-params.ts',
      {
        react: fallbackHooks.react,
        'next/navigation': {
          useRouter: () => {
            throw new Error('invariant expected app router to be mounted');
          },
          usePathname: () => {
            throw new Error('no pathname');
          },
          useSearchParams: () => {
            throw new Error('BAILOUT_TO_CLIENT_SIDE_RENDERING');
          },
        },
      },
    );

    const fallbackApi = fallbackHooks.render(() => useFallbackQueryParams());
    assert.equal(fallbackApi.searchParams, null);
    assert.equal(fallbackApi.getPositiveIntParam('page', 1), 1);
    assert.equal(fallbackApi.getParam('search', ''), '');
    assert.doesNotThrow(() => fallbackApi.syncParams({ page: 2 }));
    assert.doesNotThrow(() => fallbackApi.clearParams());
  });
});

describe('AdminToast helpers & safe default behavior', () => {
  test('auto-dismiss timing keeps error visible and dismisses success/info after 4000ms', () => {
    assert.equal(ADMIN_TOAST_AUTO_DISMISS_MS, 4000);
    assert.equal(getToastAutoDismissMs('success'), 4000);
    assert.equal(getToastAutoDismissMs('info'), 4000);
    assert.equal(getToastAutoDismissMs('error'), null);
  });

  test('NOOP_ADMIN_TOAST and useAdminToast outside provider never throw', () => {
    assert.equal(NOOP_ADMIN_TOAST.success('Đã lưu'), '');
    assert.equal(NOOP_ADMIN_TOAST.error('Có lỗi'), '');
    assert.equal(NOOP_ADMIN_TOAST.info('Thông tin'), '');
    assert.doesNotThrow(() => NOOP_ADMIN_TOAST.dismiss('toast-1'));
    assert.doesNotThrow(() => NOOP_ADMIN_TOAST.clear());

    const hooks = createHookHarness();
    const { useAdminToast } = loadClientModule(
      'components/admin/AdminToast.tsx',
      {
        react: hooks.react,
        'lucide-react': {
          AlertCircle: 'AlertCircle',
          CheckCircle2: 'CheckCircle2',
          Info: 'Info',
          X: 'X',
        },
      },
    );

    const toast = hooks.render(() => useAdminToast());
    assert.equal(toast.success('Standalone page test'), '');
    assert.equal(toast.error('Standalone error'), '');
    assert.equal(toast.info('Standalone info'), '');
    assert.doesNotThrow(() => toast.dismiss('id'));
  });

  test('appendToastItem caps visible stack and removeToastItem removes by id', () => {
    let items: AdminToastItem[] = Array.from(
      { length: MAX_VISIBLE_TOASTS },
      (_, idx) => ({
        id: `t-${idx + 1}`,
        tone: 'info',
        message: `Msg ${idx + 1}`,
      }),
    );

    const appended = appendToastItem(items, {
      id: 't-next',
      tone: 'error',
      message: 'Lỗi kết nối',
    });
    assert.equal(appended.items.length, MAX_VISIBLE_TOASTS);
    assert.deepEqual(appended.evictedIds, ['t-1']);
    assert.equal(appended.items[appended.items.length - 1].id, 't-next');

    items = removeToastItem(appended.items, 't-next');
    assert.equal(items.length, MAX_VISIBLE_TOASTS - 1);
    assert.ok(!items.some((item) => item.id === 't-next'));
  });

  test('AdminToastProvider renders role="status" / aria-live="polite" and keeps error until dismissed', () => {
    const hooks = createHookHarness();
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    const origSetTimeout = globalThis.setTimeout;
    const origClearTimeout = globalThis.clearTimeout;

    (globalThis as Record<string, unknown>).setTimeout = (
      fn: () => void,
      ms: number,
    ) => {
      scheduled.push({ fn, ms });
      return scheduled.length;
    };
    (globalThis as Record<string, unknown>).clearTimeout = () => undefined;

    try {
      const { AdminToastProvider } = loadClientModule(
        'components/admin/AdminToast.tsx',
        {
          react: hooks.react,
          'lucide-react': {
            AlertCircle: 'AlertCircle',
            CheckCircle2: 'CheckCircle2',
            Info: 'Info',
            X: 'X',
          },
        },
      );

      let tree = hooks.render(AdminToastProvider, { children: 'content' });
      const api = (
        tree as { props: { value: typeof NOOP_ADMIN_TOAST } }
      ).props.value;

      const successId = api.success('Đã lưu bài học');
      const errorId = api.error('Không thể xóa chương học');
      assert.ok(successId);
      assert.ok(errorId);

      // Only success schedules auto-dismiss (4000ms); error stays persistent
      assert.equal(scheduled.length, 1);
      assert.equal(scheduled[0].ms, 4000);

      tree = hooks.render(AdminToastProvider, { children: 'content' });
      const statusNodes = collectNodes(tree).filter(
        (n) => n.props?.role === 'status',
      );
      assert.equal(statusNodes.length, 2);
      assert.ok(
        statusNodes.every((n) => n.props?.['aria-live'] === 'polite'),
      );

      // Fire auto-dismiss timer -> success disappears, error remains
      scheduled[0].fn();
      tree = hooks.render(AdminToastProvider, { children: 'content' });
      const remaining = collectNodes(tree).filter(
        (n) => n.props?.role === 'status',
      );
      assert.equal(remaining.length, 1);
      assert.ok(collectText(remaining[0]).includes('Không thể xóa chương học'));

      // Close button dismisses error toast
      const closeBtn = collectNodes(remaining[0]).find(
        (n) => n.type === 'button' && n.props?.['aria-label'] === 'Đóng thông báo',
      );
      assert.ok(closeBtn);
      (closeBtn.props?.onClick as () => void)();
      tree = hooks.render(AdminToastProvider, { children: 'content' });
      assert.equal(
        collectNodes(tree).filter((n) => n.props?.role === 'status').length,
        0,
      );
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
    }
  });
});

describe('ConfirmDialog helpers & modal behavior', () => {
  test('canDismissConfirmDialog and tone config enforce safe defaults', () => {
    assert.equal(canDismissConfirmDialog(false, false), false);
    assert.equal(canDismissConfirmDialog(true, true), false);
    assert.equal(canDismissConfirmDialog(true, false), true);

    assert.equal(DEFAULT_CONFIRM_DIALOG_LABELS.cancel, 'Hủy');
    assert.equal(DEFAULT_CONFIRM_DIALOG_LABELS.confirm, 'Xác nhận');
    assert.equal(DEFAULT_CONFIRM_DIALOG_LABELS.busy, 'Đang xử lý...');

    const danger = getConfirmDialogToneConfig('danger');
    assert.ok(danger.confirmButtonClass.includes('bg-red-600'));
    assert.equal(danger.iconType, 'alert');

    const warning = getConfirmDialogToneConfig('warning');
    assert.ok(warning.confirmButtonClass.includes('bg-amber-600'));
    assert.equal(warning.iconType, 'alert');

    const primary = getConfirmDialogToneConfig('primary');
    assert.ok(primary.confirmButtonClass.includes('btn-primary'));
    assert.equal(primary.iconType, 'help');
  });

  test('ConfirmDialog handles open/close, backdrop click, and busy lock cleanly', () => {
    const hooks = createHookHarness();
    const { ConfirmDialog } = loadClientModule(
      'components/admin/ConfirmDialog.tsx',
      {
        react: hooks.react,
        'lucide-react': {
          AlertTriangle: 'AlertTriangle',
          HelpCircle: 'HelpCircle',
          Loader2: 'Loader2',
          X: 'X',
        },
      },
    );

    let confirmCount = 0;
    let cancelCount = 0;

    // Closed state renders null
    const closedTree = hooks.render(ConfirmDialog, {
      open: false,
      title: 'Xóa mục',
      description: 'Hành động này không thể hoàn tác.',
      onConfirm: () => {
        confirmCount += 1;
      },
      onCancel: () => {
        cancelCount += 1;
      },
    });
    assert.equal(closedTree, null);

    // Open idle state renders accessible dialog & allows backdrop cancel + confirm
    const openTree = hooks.render(ConfirmDialog, {
      open: true,
      title: 'Xóa chủ đề',
      description: 'Bạn có chắc muốn xóa chủ đề này?',
      tone: 'danger',
      onConfirm: () => {
        confirmCount += 1;
      },
      onCancel: () => {
        cancelCount += 1;
      },
    });
    const dialog = collectNodes(openTree).find(
      (n) => n.props?.role === 'dialog',
    );
    assert.ok(dialog);
    assert.equal(dialog.props?.['aria-modal'], 'true');
    assert.ok(collectText(openTree).includes('Xóa chủ đề'));
    assert.ok(collectText(openTree).includes('Hủy'));
    assert.ok(collectText(openTree).includes('Xác nhận'));

    const backdrop = openTree as MockNode;
    const sameEl = {};
    (backdrop.props?.onClick as (e: unknown) => void)({
      target: sameEl,
      currentTarget: sameEl,
    });
    assert.equal(cancelCount, 1);

    const confirmBtn = collectNodes(openTree).find(
      (n) => n.type === 'button' && collectText(n).includes('Xác nhận'),
    );
    assert.ok(confirmBtn);
    (confirmBtn.props?.onClick as () => void)();
    assert.equal(confirmCount, 1);

    // Busy state disables buttons and blocks backdrop cancel & confirm
    const busyTree = hooks.render(ConfirmDialog, {
      open: true,
      title: 'Xóa chủ đề',
      description: 'Đang xóa...',
      tone: 'danger',
      busy: true,
      onConfirm: () => {
        confirmCount += 1;
      },
      onCancel: () => {
        cancelCount += 1;
      },
    });
    assert.ok(collectText(busyTree).includes('Đang xử lý...'));
    ((busyTree as MockNode).props?.onClick as (e: unknown) => void)({
      target: sameEl,
      currentTarget: sameEl,
    });
    assert.equal(cancelCount, 1);

    const busyButtons = collectNodes(busyTree).filter(
      (n) => n.type === 'button',
    );
    assert.ok(busyButtons.length >= 2);
    assert.ok(busyButtons.every((b) => b.props?.disabled === true));
  });

  test('ConfirmDialog closes on Escape only when idle and cleans up listener', () => {
    const listeners = new Map<string, Set<(e: unknown) => void>>();
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {
      addEventListener(type: string, fn: (e: unknown) => void) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(fn);
      },
      removeEventListener(type: string, fn: (e: unknown) => void) {
        listeners.get(type)?.delete(fn);
      },
    };

    try {
      const hooks = createHookHarness();
      const { ConfirmDialog } = loadClientModule(
        'components/admin/ConfirmDialog.tsx',
        {
          react: hooks.react,
          'lucide-react': {
            AlertTriangle: 'AlertTriangle',
            HelpCircle: 'HelpCircle',
            Loader2: 'Loader2',
            X: 'X',
          },
        },
      );

      let cancelCount = 0;
      hooks.render(ConfirmDialog, {
        open: true,
        title: 'Xác nhận',
        description: 'Nội dung',
        busy: false,
        onConfirm: () => undefined,
        onCancel: () => {
          cancelCount += 1;
        },
      });
      const cleanupIdle = hooks.effects[hooks.effects.length - 1]();
      assert.equal(listeners.get('keydown')?.size, 1);

      let prevented = false;
      listeners.get('keydown')?.forEach((fn) =>
        fn({
          key: 'Escape',
          preventDefault: () => {
            prevented = true;
          },
        }),
      );
      assert.equal(cancelCount, 1);
      assert.equal(prevented, true);

      if (typeof cleanupIdle === 'function') cleanupIdle();
      assert.equal(listeners.get('keydown')?.size, 0);

      // When busy, Escape must not trigger onCancel
      hooks.render(ConfirmDialog, {
        open: true,
        title: 'Xác nhận',
        description: 'Nội dung',
        busy: true,
        onConfirm: () => undefined,
        onCancel: () => {
          cancelCount += 1;
        },
      });
      const cleanupBusy = hooks.effects[hooks.effects.length - 1]();
      listeners.get('keydown')?.forEach((fn) =>
        fn({ key: 'Escape', preventDefault: () => undefined }),
      );
      assert.equal(cancelCount, 1);
      if (typeof cleanupBusy === 'function') cleanupBusy();
    } finally {
      if (origWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = origWindow;
      }
    }
  });
});

describe('formatAppVersion helper (/admin/system SHA overflow fix)', () => {
  test('shortens 40-char and 12-char commit SHAs cleanly while preserving fullText', () => {
    const sha40 = '42bf8cc2573be3e7e81abe70ad2c7acd50a0e63d';
    assert.deepEqual(formatAppVersion(sha40), {
      shortText: '42bf8cc2',
      pillText: '#42bf8cc2',
      fullText: sha40,
      isCommitSha: true,
    });

    assert.deepEqual(formatAppVersion('abcdef123456'), {
      shortText: 'abcdef12',
      pillText: '#abcdef12',
      fullText: 'abcdef123456',
      isCommitSha: true,
    });
  });

  test('preserves semver, prefixed versions, bootstrap, and empty fallbacks', () => {
    assert.deepEqual(formatAppVersion('1.0.0'), {
      shortText: '1.0.0',
      pillText: 'v1.0.0',
      fullText: '1.0.0',
      isCommitSha: false,
    });
    assert.deepEqual(formatAppVersion('v2.3.1'), {
      shortText: 'v2.3.1',
      pillText: 'v2.3.1',
      fullText: 'v2.3.1',
      isCommitSha: false,
    });
    assert.deepEqual(formatAppVersion('bootstrap'), {
      shortText: 'bootstrap',
      pillText: 'vbootstrap',
      fullText: 'bootstrap',
      isCommitSha: false,
    });
    assert.deepEqual(formatAppVersion(''), {
      shortText: 'unknown',
      pillText: 'vunknown',
      fullText: 'unknown',
      isCommitSha: false,
    });
  });
});
