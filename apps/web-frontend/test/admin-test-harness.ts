import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

// Execute the real component handlers with deterministic hook state and deferred
// APIs, so request ordering and mode transitions can be tested without a browser.
export function loadComponent(file: string, mocks: Record<string, unknown>) {
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

export function hookHarness() {
  const state: any[] = [];
  const prevDeps: Array<any[] | undefined> = [];
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
      useState(value: any) {
        const index = cursor++;
        if (!(index in state)) {
          state[index] = typeof value === 'function' ? value() : value;
        }
        return [
          state[index],
          (next: any) => {
            state[index] =
              typeof next === 'function' ? next(state[index]) : next;
          },
        ];
      },
      useRef(value: any) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: value };
        return state[index];
      },
      useMemo: (compute: () => any) => compute(),
      useCallback(fn: any, deps?: any[]) {
        const index = cursor++;
        const prev = state[index] as { fn: any; deps?: any[] } | undefined;
        const same =
          prev &&
          deps &&
          prev.deps &&
          deps.length === prev.deps.length &&
          deps.every((d, i) => Object.is(d, prev.deps![i]));
        if (!same) {
          state[index] = { fn, deps: deps ? [...deps] : undefined };
        }
        return state[index].fn;
      },
      useEffect(effect: () => void, deps?: any[]) {
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
      createElement: (type: any, props: any, ...children: any[]) => ({
        type,
        props: { ...props, children },
      }),
    },
    render(component: any, props?: any) {
      cursor = 0;
      effectIndex = 0;
      return component(props);
    },
  };
}

function childrenOf(node: any): any[] {
  const c = node?.props?.children;
  return Array.isArray(c) ? c : c != null ? [c] : [];
}

export function nodes(node: any): any[] {
  return !node || typeof node !== 'object'
    ? []
    : [node, ...childrenOf(node).flat(Infinity).flatMap(nodes)];
}

export function text(node: any): string {
  return node == null || typeof node === 'boolean'
    ? ''
    : typeof node !== 'object'
      ? String(node)
      : childrenOf(node).flat(Infinity).map(text).join(' ');
}

export function button(tree: any, label: string) {
  const result = nodes(tree).find(
    (node) => node.type === 'button' && text(node).includes(label),
  );
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

export const tick = () =>
  new Promise<void>((resolveTick) => setImmediate(resolveTick));
