import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

export interface MockNode {
  type: string | ((props: Record<string, unknown>) => unknown);
  props: Record<string, unknown> & {
    children?: unknown;
    onClick: () => void;
    onChange: (event: unknown) => void;
    onSubmit: (event: { preventDefault: () => void }) => Promise<void> | void;
    onAuthenticated: () => void;
    disabled?: boolean;
    value?: unknown;
    type?: string;
    placeholder?: string;
    actions?: unknown;
  };
}

export function loadComponent(
  file: string,
  mocks: Record<string, unknown>,
): Record<string, unknown> & { default: (props?: Record<string, unknown>) => MockNode } {
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
  return mod.exports as Record<string, unknown> & {
    default: (props?: Record<string, unknown>) => MockNode;
  };
}

export function hookHarness() {
  const state: unknown[] = [];
  const prevDeps: Array<unknown[] | undefined> = [];
  let cursor = 0;
  let effectIndex = 0;
  const effects: Array<() => void> = [];
  const pendingEffects: Array<() => void> = [];
  return {
    effects,
    flushEffects() {
      const queued = pendingEffects.splice(0, pendingEffects.length);
      for (const fn of queued) fn();
    },
    react: {
      Fragment: Symbol.for('react.fragment'),
      useState<T>(value: T | (() => T)) {
        const index = cursor++;
        if (!(index in state)) {
          state[index] =
            typeof value === 'function' ? (value as () => T)() : value;
        }
        return [
          state[index] as T,
          (next: T | ((prev: T) => T)) => {
            state[index] =
              typeof next === 'function'
                ? (next as (prev: T) => T)(state[index] as T)
                : next;
          },
        ] as const;
      },
      useRef<T>(value: T) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: value };
        return state[index] as { current: T };
      },
      useMemo: <T>(compute: () => T) => compute(),
      useCallback<T extends (...args: never[]) => unknown>(
        fn: T,
        deps?: unknown[],
      ): T {
        const index = cursor++;
        const prev = state[index] as { fn: T; deps?: unknown[] } | undefined;
        const same =
          prev &&
          deps &&
          prev.deps &&
          deps.length === prev.deps.length &&
          deps.every((d, i) => Object.is(d, prev.deps![i]));
        if (!same) {
          state[index] = { fn, deps: deps ? [...deps] : undefined };
        }
        return (state[index] as { fn: T }).fn;
      },
      useEffect(effect: () => void, deps?: unknown[]) {
        const idx = effectIndex++;
        const prev = prevDeps[idx];
        const changed =
          !deps ||
          !prev ||
          deps.length !== prev.length ||
          deps.some((d, i) => !Object.is(d, prev[i]));
        if (changed) {
          prevDeps[idx] = deps ? [...deps] : undefined;
          effects.push(effect);
          pendingEffects.push(effect);
        }
      },
      createElement: (
        type: MockNode['type'],
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ): MockNode => ({
        type,
        props: { ...(props ?? {}), children } as MockNode['props'],
      }),
    },
    render(component: unknown, props?: unknown): MockNode {
      cursor = 0;
      effectIndex = 0;
      return (component as (p?: unknown) => MockNode)(props);
    },
  };
}

const EXPANDED_PURE_COMPONENTS = new Set([
  'LessonComposerFormSections',
  'LessonComposerPreview',
  'ItemsFilterBar',
  'ItemsGroupsSection',
  'UsersPageModals',
]);

function isMockNode(value: unknown): value is MockNode {
  return Boolean(value && typeof value === 'object' && 'type' in value);
}

function childList(node: MockNode): unknown[] {
  const c = node.props?.children;
  return Array.isArray(c) ? c.flat(Infinity) : c === undefined ? [] : [c];
}

export function nodes(node: unknown): MockNode[] {
  if (!isMockNode(node)) return [];
  if (
    typeof node.type === 'function' &&
    EXPANDED_PURE_COMPONENTS.has(node.type.name)
  ) {
    return [node, ...nodes(node.type(node.props))];
  }
  return [node, ...childList(node).flatMap(nodes)];
}

export function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (!isMockNode(node)) return '';
  if (
    typeof node.type === 'function' &&
    EXPANDED_PURE_COMPONENTS.has(node.type.name)
  ) {
    return text(node.type(node.props));
  }
  return childList(node).map(text).join(' ');
}

export function button(tree: unknown, label: string): MockNode {
  const result = nodes(tree).find(
    (node) => node.type === 'button' && text(node).includes(label),
  );
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

export const tick = (): Promise<void> =>
  new Promise<void>((resolveTick) => setImmediate(resolveTick));
