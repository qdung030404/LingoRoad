import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import * as helpers from '../src/lib/admin-validation';

// Execute the real component handlers with deterministic hook state and deferred
// APIs, so request ordering and mode transitions can be tested without a browser.
function loadComponent(file: string, mocks: Record<string, unknown>) {
  const filename = resolve(__dirname, '../src', file);
  const mod = new Module(filename, module) as Module & { _compile(code: string, filename: string): void };
  mod.filename = filename;
  const requireActual = Module.createRequire(filename);
  mod.require = (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : requireActual(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

function hookHarness() {
  const state: any[] = [];
  let cursor = 0;
  const effects: Array<() => void> = [];
  return {
    effects,
    react: {
      useState(value: any) {
        const index = cursor++;
        if (!(index in state)) state[index] = value;
        return [state[index], (next: any) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useRef(value: any) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: value };
        return state[index];
      },
      useMemo: (compute: () => any) => compute(),
      useEffect: (effect: () => void) => effects.push(effect),
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    },
    render(component: any, props?: any) { cursor = 0; return component(props); },
  };
}
function nodes(node: any): any[] {
  return !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
}
function text(node: any): string {
  return node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : (node.props?.children ?? []).flat(Infinity).map(text).join(' ');
}
function button(tree: any, label: string) {
  const result = nodes(tree).find(node => node.type === 'button' && text(node).includes(label));
  assert.ok(result, `Missing button: ${label}`);
  return result;
}
const tick = () => new Promise<void>(resolveTick => setImmediate(resolveTick));
function content() {
  return { steps: [], passage: 'A reading passage.', coverImageUrl: 'https://example.com/cover.png',
    keyVocabulary: [{ id: 'v1', word: 'reading', meaning: 'đọc' }],
    questions: [1, 2, 3].map(i => ({ id: `q${i}`, type: 'MULTIPLE_CHOICE' as const, prompt: `Question ${i}`, explanation: 'Explanation',
      options: ['A', 'B', 'C', 'D'].map(id => ({ id, text: id, imageUrl: `https://example.com/${id}.png` })), correctOptionId: 'B' })),
  };
}

test('lesson editor preserves media and vocabulary through JSON → form → JSON → save, including empty steps', async () => {
  const hooks = hookHarness();
  let saved: any;
  const { LessonComposerModal } = loadComponent('components/admin/LessonComposerModal.tsx', {
    react: hooks.react, 'lucide-react': {}, '@/lib/admin-validation': helpers,
    '@/lib/admin-api': { updateAdminLesson: async (_id: string, payload: any) => { saved = payload; } },
  });
  const original = content();
  const props = { units: [], editingLesson: { id: 'l1', code: 'reading', kind: 'READING', title: 'Reading', description: 'Description', estimatedMinutes: 5, content: original }, onClose() {}, onSaved() {}, onUnitCreated() {} };
  let tree = hooks.render(LessonComposerModal, props);
  // Saving a valid lesson with no steps must not inject an empty required step.
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  assert.equal(saved.content.steps.length, 0);
  assert.deepEqual(saved.content.keyVocabulary, original.keyVocabulary);
  assert.equal(saved.content.questions[0].options[0].imageUrl, original.questions[0].options[0].imageUrl);
  button(tree, 'Soạn JSON nâng cao').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  const edited = content(); edited.questions[0].prompt = 'Updated in JSON';
  nodes(tree).find(node => node.type === 'textarea' && node.props.rows === 14).props.onChange({ target: { value: JSON.stringify(edited) } });
  tree = hooks.render(LessonComposerModal, props);
  button(tree, 'Biểu mẫu trực quan').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  button(tree, 'Soạn JSON nâng cao').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  assert.deepEqual(saved.content, edited);
});

test('form content retains step audio and question metadata', () => {
  const original = content();
  const draft = { kind: 'READING' as const, ...original, steps: [{ id: 's1', title: 'Step', body: 'Body', audioUrl: 'https://example.com/audio.mp3' }] };
  const saved = helpers.buildLessonContentFromForm(draft, original);
  assert.equal(saved.coverImageUrl, original.coverImageUrl);
  assert.equal(saved.steps[0].audioUrl, draft.steps[0].audioUrl);
  assert.deepEqual(saved.questions, original.questions);
});

test('item editor keeps ID-based correct answer and every option without truncation', async () => {
  const hooks = hookHarness(); let saved: any;
  const { AssessmentItemModal } = loadComponent('components/admin/AssessmentItemModal.tsx', {
    react: hooks.react, 'lucide-react': {}, '@/lib/admin-validation': helpers,
    '@/lib/admin-api': { updateAdminAssessmentItem: async (_id: string, payload: any) => { saved = payload; } },
  });
  const options = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((label, i) => ({ id: String(i), text: label }));
  const tree = hooks.render(AssessmentItemModal, { descriptors: [], editingItem: { id: 'i1', skill: 'READING', skillCode: 'reading.scanning', cefrLevel: 'A2', type: 'MULTIPLE_CHOICE', usageScope: 'ALL', prompt: 'Question?', options, correctOption: '2' }, onClose() {}, onSaved() {} });
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(saved.correctOption, '2'); assert.deepEqual(saved.options, options);
});

test('item editor rejects invalid PLACEMENT drafts client-side before calling the API', async () => {
  const hooks = hookHarness(); let apiCalls = 0;
  const { AssessmentItemModal } = loadComponent('components/admin/AssessmentItemModal.tsx', {
    react: hooks.react, 'lucide-react': {}, '@/lib/admin-validation': helpers,
    '@/lib/admin-api': {
      createAdminAssessmentItem: async () => { apiCalls++; },
      updateAdminAssessmentItem: async () => { apiCalls++; },
    },
  });
  const fiveOptions = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  const props = {
    descriptors: [],
    editingItem: {
      id: 'i-placement',
      skill: 'READING',
      skillCode: 'reading.scanning',
      cefrLevel: 'A2',
      type: 'MULTIPLE_CHOICE',
      usageScope: 'PLACEMENT',
      passage: 'A short reading passage.',
      prompt: 'Which answer is right?',
      options: fiveOptions,
      correctOption: 'Beta',
    },
    onClose() {},
    onSaved() {},
  };
  let tree = hooks.render(AssessmentItemModal, props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  tree = hooks.render(AssessmentItemModal, props);
  assert.equal(apiCalls, 0);
  assert.ok(text(tree).includes('đúng 4 phương án trả lời'));

  assert.ok(helpers.validateAssessmentItemDraft({
    skill: 'READING', type: 'MULTIPLE_CHOICE', usageScope: 'PLACEMENT',
    passage: '   ', prompt: 'Valid prompt?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, irtB: 0,
  })?.includes('đoạn văn'));
  assert.ok(helpers.validateAssessmentItemDraft({
    skill: 'WRITING', type: 'MULTIPLE_CHOICE', usageScope: 'PLACEMENT',
    passage: 'Passage', prompt: 'Valid prompt?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, irtB: 0,
  })?.includes('READING hoặc LISTENING'));
  assert.equal(helpers.validateAssessmentItemDraft({
    skill: 'READING', type: 'MULTIPLE_CHOICE', usageScope: 'PLACEMENT',
    passage: 'A passage.', prompt: 'Valid prompt?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, irtB: 0.2,
  }), null);
});

test('import ignores late validation for an edited draft and cannot apply it', async () => {
  const hooks = hookHarness(); let resolveValidation: (value: any) => void = () => {}; let applyCount = 0;
  const Page = loadComponent('app/admin/import/page.tsx', {
    react: hooks.react, 'next/link': () => null, 'lucide-react': {}, '@/components/admin/AdminShell': {}, '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': { validateAdminImport: () => new Promise(resolveResponse => { resolveValidation = resolveResponse; }), applyAdminImport: async () => { applyCount++; } },
  }).default;
  const render = () => hooks.render(Page).props.children[0]();
  let tree = render();
  nodes(tree).find(node => node.type === 'textarea').props.onChange({ target: { value: '{"items":[{"prompt":"A"}]}' } });
  tree = render(); button(tree, '1. Kiểm tra').props.onClick();
  tree = render(); nodes(tree).find(node => node.type === 'textarea').props.onChange({ target: { value: '{"items":[{"prompt":"B"}]}' } });
  resolveValidation({ isValid: true, errors: [], preview: { totalRecords: 1, counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(key => [key, { create: 0, update: 0 }])), records: [] } });
  await tick(); tree = render();
  assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node).includes('Tiếp tục bước Xác nhận')));
  assert.equal(nodes(tree).find(node => node.type === 'textarea').props.value, '{"items":[{"prompt":"B"}]}');
  assert.equal(applyCount, 0);
  button(tree, '1. Kiểm tra').props.onClick();
  resolveValidation({ isValid: true, errors: [], preview: { totalRecords: 1, counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(key => [key, { create: 0, update: 0 }])), records: [] } });
  await tick(); tree = render();
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = render();
  const apply = button(tree, '4.');
  apply.props.onClick(); apply.props.onClick();
  await tick();
  assert.equal(applyCount, 1, 'the current validated draft applies once, even before the next render');
});

test('shell persists profile using refreshed tokens rather than captured tokens', async () => {
  const hooks = hookHarness(); const user = { id: 'a1', name: 'Admin', role: 'ADMIN' }; let session = { accessToken: 'old', refreshToken: 'old-refresh', user };
  const { AdminShell } = loadComponent('components/admin/AdminShell.tsx', {
    react: hooks.react, 'next/link': () => null, 'next/navigation': { useRouter: () => ({ replace() {} }), usePathname: () => '/admin' }, 'lucide-react': {}, './LingoRoadWordmark': {},
    '@/lib/admin-api': { getStoredAdminSession: () => session, getAdminMe: async () => { session = { ...session, accessToken: 'new', refreshToken: 'new-refresh' }; return user; }, saveAdminSession: (value: any) => { session = value; }, clearAdminSession() {} },
  });
  hooks.render(AdminShell, { title: 'Admin', children() {} }); hooks.effects[0](); await tick();
  assert.equal(session.accessToken, 'new'); assert.equal(session.refreshToken, 'new-refresh');
});
