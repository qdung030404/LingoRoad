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
            state[index] = typeof next === 'function' ? next(state[index]) : next;
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
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    },
    render(component: any, props?: any) {
      cursor = 0;
      effectIndex = 0;
      return component(props);
    },
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
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    './ListeningLessonForm': { ListeningLessonForm: () => null },
    '@/lib/admin-api': {
      updateAdminLesson: async (_id: string, payload: any) => { saved = payload; },
      resolveAdminMediaUrl: (u: string) => u,
    },
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
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
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
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
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
    react: hooks.react,
    'next/link': () => null,
    'lucide-react': {},
    '@/components/admin/AdminShell': {},
    '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': {
      validateAdminImport: () => new Promise(resolveResponse => { resolveValidation = resolveResponse; }),
      applyAdminImport: async () => { applyCount++; },
      downloadAdminExport: async () => undefined,
    },
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

test('GrammarTopicModal preserves comma typing in signalWords and submits canonical BE schema', async () => {
  const hooks = hookHarness();
  let createdPayload: any = null;
  const { GrammarTopicModal } = loadComponent('components/admin/GrammarTopicModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    '@/lib/admin-api': {
      createAdminGrammarTopic: async (payload: any) => { createdPayload = payload; },
      updateAdminGrammarTopic: async () => undefined,
    },
  });

  const props = { allTopics: [], editingTopic: null, onClose() {}, onSaved() {} };
  let tree = hooks.render(GrammarTopicModal, props);
  const findInput = (t: any, placeholder: string) =>
    nodes(t).find(n => n.type === 'input' && typeof n.props?.placeholder === 'string' && n.props.placeholder.includes(placeholder));

  findInput(tree, 'grammar.tenses.present_simple').props.onChange({ target: { value: 'grammar.tenses.present_simple' } });
  const requiredTextInputs = nodes(tree).filter(n => n.type === 'input' && n.props?.type === 'text' && n.props.required);
  // [0]=code, [1]=titleVi, [2]=titleEn
  requiredTextInputs[1].props.onChange({ target: { value: 'Thì Hiện tại đơn' } });
  requiredTextInputs[2].props.onChange({ target: { value: 'Present Simple' } });
  findInput(tree, 'Công thức *').props.onChange({ target: { value: 'S + V(s/es) + O' } });
  findInput(tree, 'useCaseVi').props.onChange({ target: { value: 'Diễn tả thói quen hàng ngày' } });
  findInput(tree, 'Từ dấu hiệu').props.onChange({ target: { value: 'always, ' } });
  tree = hooks.render(GrammarTopicModal, props);

  // Typing a trailing comma must NOT be stripped mid-input.
  assert.equal(findInput(tree, 'Từ dấu hiệu').props.value, 'always, ');

  findInput(tree, 'Từ dấu hiệu').props.onChange({ target: { value: 'always, usually, every day' } });
  findInput(tree, 'sentenceEn').props.onChange({ target: { value: 'She goes to work by bus.' } });
  findInput(tree, 'translationVi').props.onChange({ target: { value: 'Cô ấy đi làm bằng xe buýt.' } });
  findInput(tree, 'Highlight').props.onChange({ target: { value: 'goes' } });
  tree = hooks.render(GrammarTopicModal, props);

  await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();

  assert.ok(createdPayload, 'Expected createAdminGrammarTopic to be called');
  assert.equal(createdPayload.code, 'grammar.tenses.present_simple');
  assert.deepEqual(createdPayload.formulas, [
    { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V(s/es) + O' },
  ]);
  assert.deepEqual(createdPayload.usageNotes, [
    { useCaseVi: 'Diễn tả thói quen hàng ngày', signalWords: ['always', 'usually', 'every day'] },
  ]);
  assert.deepEqual(createdPayload.examples, [
    { sentenceEn: 'She goes to work by bus.', translationVi: 'Cô ấy đi làm bằng xe buýt.', highlight: 'goes' },
  ]);
  assert.equal('label' in createdPayload.formulas[0], false);
  assert.equal('pattern' in createdPayload.formulas[0], false);
  assert.equal('usage' in createdPayload.usageNotes[0], false);
  assert.equal('en' in createdPayload.examples[0], false);
});

test('SpeakingPromptModal preserves preparation.vocabulary[].imageUrl and requires TONGUE_TWISTER confirmation', async () => {
  // Part A: TOPIC prompt preserves vocabulary imageUrl
  const topicHooks = hookHarness();
  let topicPayload: any = null;
  const { SpeakingPromptModal: TopicModal } = loadComponent('components/admin/SpeakingPromptModal.tsx', {
    react: topicHooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': {
      createAdminSpeakingPrompt: async () => undefined,
      updateAdminSpeakingPrompt: async (_id: string, payload: any) => { topicPayload = payload; },
    },
  });

  const topicProps = {
    editingPrompt: {
      id: 'sp-topic-1',
      code: 'topic-coffee-shop',
      mode: 'TOPIC',
      title: 'Ordering Coffee',
      text: 'Talk about ordering drinks at a cafe.',
      difficulty: 2,
      maxDurationSeconds: 60,
      hints: ['Greet politely'],
      sampleAsset: null,
      imageUrl: null,
      visualContext: null,
      preparation: {
        goal: 'Order a drink naturally.',
        sceneImageUrl: '/media/learning/v1/images/cafe-scene.png',
        vocabulary: [
          {
            word: 'espresso',
            meaningVi: 'cà phê espresso',
            example: 'I would like an espresso.',
            imageUrl: '/media/learning/v1/images/espresso.png',
          },
        ],
        phrases: [{ text: 'Can I have a latte?', meaningVi: 'Cho tôi một ly latte nhé?' }],
      },
      linkedReadAloudCodes: [],
      contentVersion: 1,
      sortOrder: 1,
      published: true,
      submissionsCount: 0,
    },
    onClose() {},
    onSaved() {},
  };

  const topicTree = topicHooks.render(TopicModal, topicProps);
  await nodes(topicTree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();

  assert.ok(topicPayload, 'Expected updateAdminSpeakingPrompt to be called for TOPIC');
  assert.equal(
    topicPayload.preparation.vocabulary[0].imageUrl,
    '/media/learning/v1/images/espresso.png',
  );

  // Part B: TONGUE_TWISTER content edit shows warning & blocks submit until confirmed
  const twisterHooks = hookHarness();
  let twisterCalls = 0;
  const { SpeakingPromptModal: TwisterModal } = loadComponent('components/admin/SpeakingPromptModal.tsx', {
    react: twisterHooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': {
      createAdminSpeakingPrompt: async () => undefined,
      updateAdminSpeakingPrompt: async () => { twisterCalls++; },
    },
  });

  const twisterProps = {
    editingPrompt: {
      id: 'sp-tt-1',
      code: 'twister-she-sells',
      mode: 'TONGUE_TWISTER',
      title: 'Sea Shells',
      text: 'She sells seashells by the seashore.',
      difficulty: 3,
      maxDurationSeconds: 20,
      hints: ['Focus on s/sh'],
      sampleAsset: null,
      imageUrl: null,
      visualContext: null,
      preparation: null,
      linkedReadAloudCodes: [],
      contentVersion: 2,
      sortOrder: 1,
      published: true,
      submissionsCount: 3,
    },
    onClose() {},
    onSaved() {},
  };

  let twisterTree = twisterHooks.render(TwisterModal, twisterProps);
  const textArea = nodes(twisterTree).find(n => n.type === 'textarea' && n.props?.required);
  textArea.props.onChange({ target: { value: 'She sells fresh seashells by the seashore.' } });
  twisterTree = twisterHooks.render(TwisterModal, twisterProps);

  const warningText = text(twisterTree);
  const compactWarning = warningText.replace(/\s+/g, '');
  assert.ok(warningText.includes('contentVersion'));
  assert.ok(compactWarning.includes('v2→v3'));
  assert.equal(button(twisterTree, 'Lưu thay đổi').props.disabled, true);

  await nodes(twisterTree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  assert.equal(twisterCalls, 0, 'Must block submit before confirmation checkbox is checked');

  const checkboxes = nodes(twisterTree).filter(n => n.type === 'input' && n.props?.type === 'checkbox');
  checkboxes[checkboxes.length - 1].props.onChange({ target: { checked: true } });
  twisterTree = twisterHooks.render(TwisterModal, twisterProps);
  assert.equal(button(twisterTree, 'Lưu thay đổi').props.disabled, false);

  await nodes(twisterTree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  assert.equal(twisterCalls, 1);
});

test('AssessmentItemModal preserves Writing rubric criteria and sends null for cleared nullable fields', async () => {
  const hooks = hookHarness();
  let savedPayload: any = null;
  const { AssessmentItemModal } = loadComponent('components/admin/AssessmentItemModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': {
      updateAdminAssessmentItem: async (_id: string, payload: any) => { savedPayload = payload; },
    },
  });

  const seededRubric = {
    taskAchievement: 'Trả lời đầy đủ 3 yêu cầu đề bài.',
    coherenceCohesion: 'Bố cục rõ ràng, dùng từ nối mạch lạc.',
    lexicalResource: 'Từ vựng đa dạng bậc B1.',
    grammarAccuracy: 'Dùng đúng thì quá khứ và hiện tại hoàn thành.',
    customEvaluatorWeight: 1.25,
  };

  const props = {
    descriptors: [],
    editingItem: {
      id: 'item-essay-1',
      externalId: 'writing-b1-essay-1',
      skill: 'WRITING',
      skillCode: 'writing.opinion',
      cefrLevel: 'B1',
      type: 'ESSAY',
      usageScope: 'MOCK_EXAM',
      passage: 'Context passage to clear',
      prompt: 'Write an email about your favorite weekend trip.',
      options: null,
      correctOption: null,
      explanation: 'Old explanation to clear',
      audioUrl: null,
      rubricCriteria: seededRubric,
      irtA: 1.0,
      irtB: 0.1,
      irtC: 0.25,
      responsesCount: 0,
      createdAt: new Date().toISOString(),
    },
    onClose() {},
    onSaved() {},
  };

  let tree = hooks.render(AssessmentItemModal, props);
  const extInput = nodes(tree).find(n => n.type === 'input' && n.props?.value === 'writing-b1-essay-1');
  const passageArea = nodes(tree).find(n => n.type === 'textarea' && n.props?.value === 'Context passage to clear');
  const explanationArea = nodes(tree).find(n => n.type === 'textarea' && n.props?.value === 'Old explanation to clear');

  extInput.props.onChange({ target: { value: '   ' } });
  passageArea.props.onChange({ target: { value: '' } });
  explanationArea.props.onChange({ target: { value: '  ' } });
  tree = hooks.render(AssessmentItemModal, props);

  await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();

  assert.ok(savedPayload, 'Expected updateAdminAssessmentItem to be called');
  assert.equal(savedPayload.externalId, null);
  assert.equal(savedPayload.passage, null);
  assert.equal(savedPayload.explanation, null);
  assert.equal(savedPayload.correctOption, null);
  assert.deepEqual(savedPayload.rubricCriteria, seededRubric);
});

test('AdminImportPage resets validation when topicWordsMode changes and blocks stale apply', async () => {
  const hooks = hookHarness();
  const appliedModes: string[] = [];
  const validatedModes: string[] = [];
  let resolveApply: ((v: any) => void) | null = null;
  const okValidation = {
    isValid: true,
    errors: [],
    preview: {
      totalRecords: 1,
      counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(k => [k, { create: 1, update: 0 }])),
      records: [],
    },
  };

  const Page = loadComponent('app/admin/import/page.tsx', {
    react: hooks.react,
    'next/link': () => null,
    'lucide-react': {},
    '@/components/admin/AdminShell': {},
    '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': {
      validateAdminImport: async (_bundle: unknown, mode: string) => {
        validatedModes.push(mode);
        return okValidation;
      },
      applyAdminImport: (_bundle: unknown, mode: string) => {
        appliedModes.push(mode);
        return new Promise(res => { resolveApply = res; });
      },
      downloadAdminExport: async () => undefined,
    },
  }).default;

  const render = () => hooks.render(Page).props.children[0]();
  let tree = render();

  await button(tree, '1. Kiểm tra').props.onClick();
  await tick();
  tree = render();
  assert.deepEqual(validatedModes, ['merge']);
  assert.ok(nodes(tree).some(n => n.type === 'button' && text(n).includes('Tiếp tục bước Xác nhận')));

  // Advance to Step 3 and confirm
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(n => n.type === 'input' && n.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = render();
  assert.ok(button(tree, '4.'));

  // Switching topicWordsMode from merge -> replace must reset validation back to Step 1
  const modeSelect = nodes(tree).find(n => n.type === 'select');
  modeSelect.props.onChange({ target: { value: 'replace' } });
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'select').props.value, 'replace');
  assert.ok(!nodes(tree).some(n => n.type === 'button' && text(n).includes('4.')));
  assert.equal(appliedModes.length, 0);

  // Re-validate under replace mode and apply; mode select must be disabled while applying
  await button(tree, '1. Kiểm tra').props.onClick();
  await tick();
  tree = render();
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(n => n.type === 'input' && n.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = render();
  button(tree, '4.').props.onClick();
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'select').props.disabled, true);
  assert.deepEqual(appliedModes, ['replace']);

  resolveApply!({ appliedAt: new Date().toISOString(), preview: okValidation.preview });
  await tick();
});

test('AdminShell does not fire onAuthenticated when unauthenticated and admin pages wait before fetching', async () => {
  // Part A: AdminShell without session redirects and never invokes onAuthenticated
  const shellHooks = hookHarness();
  let redirectedTo: string | null = null;
  let authedCalls = 0;
  const { AdminShell } = loadComponent('components/admin/AdminShell.tsx', {
    react: shellHooks.react,
    'next/link': () => null,
    'next/navigation': {
      useRouter: () => ({ replace: (path: string) => { redirectedTo = path; } }),
      usePathname: () => '/admin',
    },
    'lucide-react': {},
    './LingoRoadWordmark': {},
    '@/lib/admin-api': {
      getStoredAdminSession: () => null,
      getAdminMe: async () => { throw new Error('401'); },
      saveAdminSession() {},
      clearAdminSession() {},
    },
  });
  shellHooks.render(AdminShell, {
    breadcrumbTitle: 'Tổng quan',
    title: 'Admin',
    onAuthenticated: () => { authedCalls++; },
    children: () => null,
  });
  shellHooks.flushEffects();
  await tick();
  assert.equal(redirectedTo, '/admin/login');
  assert.equal(authedCalls, 0);

  // Part B: AdminDashboardPage skips API fetch until AdminShell invokes onAuthenticated
  const pageHooks = hookHarness();
  let dashboardCalls = 0;
  const AdminDashboardPage = loadComponent('app/admin/page.tsx', {
    react: pageHooks.react,
    'next/link': () => null,
    'lucide-react': {},
    '@/components/admin/AdminShell': { AdminShell: (props: any) => props },
    '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': {
      getDashboardOverview: async () => {
        dashboardCalls++;
        return {
          users: { total: 0, learners: 0, admins: 0, active: 0, suspended: 0, active30d: 0 },
          content: { skillsTotal: 0, unitsTotal: 0, lessonsTotal: 0, lessonsPublished: 0, assessmentItemsTotal: 0, speakingPromptsTotal: 0 },
          activity: { learningAttemptsTotal: 0, learningAttemptsCompleted: 0, placementSessionsTotal: 0, totalAnsweredQuestions: 0, accuracyPercent: 0 },
          lessonsByKind: [],
          masteryBySkill: [],
          recentActivities: [],
          recentUsers: [],
        };
      },
    },
  }).default;

  const shellElement = pageHooks.render(AdminDashboardPage);
  pageHooks.flushEffects();
  await tick();
  assert.equal(dashboardCalls, 0, 'Must not call protected API before AdminShell confirms auth');

  shellElement.props.onAuthenticated();
  pageHooks.render(AdminDashboardPage);
  pageHooks.flushEffects();
  await tick();
  assert.equal(dashboardCalls, 1, 'Must load data once onAuthenticated fires');
});

test('Admin export catches errors, prevents double-click, and displays error banner', async () => {
  const hooks = hookHarness();
  let exportCalls = 0;
  let rejectExport: ((err: Error) => void) | null = null;
  const AdminUsersPage = loadComponent('app/admin/users/page.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/components/admin/AdminShell': { AdminShell: (props: any) => props },
    '@/components/admin/GlobalPagination': {},
    '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': {
      listAdminUsers: async () => ({
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        summary: { total: 0, activeLearners30d: 0, learners: 0, admins: 0 },
      }),
      downloadAdminExport: () => {
        exportCalls++;
        return new Promise((_resolve, reject) => { rejectExport = reject; });
      },
    },
  }).default;

  const renderPage = () => {
    const shell = hooks.render(AdminUsersPage);
    return {
      shell,
      actions: shell.props.actions,
      body: shell.props.children[0]({ id: 'admin-1', role: 'ADMIN' }),
    };
  };

  let view = renderPage();
  view.shell.props.onAuthenticated();
  view = renderPage();
  hooks.flushEffects();
  await tick();

  // Trigger export -> button disables & ignores duplicate clicks while in flight
  const exportBtn = button(view.actions, 'Export CSV');
  exportBtn.props.onClick();
  view = renderPage();
  const loadingExportBtn = button(view.actions, 'Đang xuất');
  assert.equal(loadingExportBtn.props.disabled, true);
  loadingExportBtn.props.onClick();
  assert.equal(exportCalls, 1, 'Double-click while exporting must be ignored');

  // Reject export -> error is caught cleanly and shown in page banner
  rejectExport!(new Error('Export server error 500'));
  await tick();
  view = renderPage();
  assert.ok(text(view.body).includes('Export server error 500'));
  assert.equal(button(view.actions, 'Export CSV').props.disabled, false);
});

test('AdminAuditLogsPage converts local day boundaries to ISO and includes EXPORTS filter', async () => {
  const hooks = hookHarness();
  const queries: any[] = [];
  const AdminAuditLogsPage = loadComponent('app/admin/audit-logs/page.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/components/admin/AdminShell': { AdminShell: (props: any) => props },
    '@/components/admin/GlobalPagination': {},
    '@/lib/admin-api': {
      listAdminAuditLogs: async (params: any) => {
        queries.push(params);
        return { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      },
      downloadAdminExport: async () => undefined,
    },
  }).default;

  const renderPage = () => {
    const shell = hooks.render(AdminAuditLogsPage);
    return { shell, body: shell.props.children[0]() };
  };

  let view = renderPage();
  hooks.flushEffects();
  assert.equal(queries.length, 0, 'Must not query audit logs before authReady');

  view.shell.props.onAuthenticated();
  view = renderPage();
  hooks.flushEffects();
  await tick();

  const optionValues = nodes(view.body)
    .filter(n => n.type === 'option')
    .map(n => n.props?.value);
  assert.ok(optionValues.includes('EXPORTS'), 'RESOURCE_OPTIONS must include EXPORTS');

  const dateInputs = nodes(view.body).filter(n => n.type === 'input' && n.props?.type === 'date');
  dateInputs[0].props.onChange({ target: { value: '2026-11-27' } });
  dateInputs[1].props.onChange({ target: { value: '2026-11-27' } });
  view = renderPage();
  hooks.flushEffects();
  await tick();

  const lastQuery = queries[queries.length - 1];
  assert.equal(lastQuery.from, new Date('2026-11-27T00:00:00.000').toISOString());
  assert.equal(lastQuery.to, new Date('2026-11-27T23:59:59.999').toISOString());
});

test('AdminItemsPage Group modal sends null on cleared fields and reorders/adds itemIds', async () => {
  const hooks = hookHarness();
  let updatedGroupPayload: any = null;
  const existingGroup = {
    id: 'grp-1',
    skill: 'LISTENING',
    title: 'Part 1 Conversation',
    cefrLevel: 'B1',
    partNumber: 1,
    passage: 'Old passage',
    audioUrl: '/media/placement/old.wav',
    transcript: 'Old transcript',
    usageScope: 'MOCK_EXAM',
    itemsCount: 2,
    items: [
      { id: 'item-b', externalId: 'ext-b', itemOrder: 2, skillCode: 'listening.detail', type: 'MULTIPLE_CHOICE', prompt: 'Second item' },
      { id: 'item-a', externalId: 'ext-a', itemOrder: 1, skillCode: 'listening.gist', type: 'MULTIPLE_CHOICE', prompt: 'First item' },
    ],
    createdAt: new Date().toISOString(),
  };

  const AdminItemsPage = loadComponent('app/admin/items/page.tsx', {
    react: hooks.react,
    'next/link': () => null,
    'lucide-react': {},
    '@/components/admin/AdminShell': { AdminShell: (props: any) => props },
    '@/components/admin/AssessmentItemModal': {},
    '@/components/admin/GlobalPagination': {},
    '@/components/admin/LegacyStatCard': {},
    '@/components/admin/MediaUploadField': { MediaUploadField: () => null },
    '@/lib/use-debounced-value': { useDebouncedValue: (v: any) => v },
    '@/lib/admin-api': {
      listDescriptors: async () => [],
      listAdminAssessmentGroups: async () => ({
        items: [existingGroup],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
      listAdminAssessmentItems: async () => ({
        items: [
          {
            id: 'item-c',
            externalId: 'ext-c',
            groupId: 'grp-other',
            group: { id: 'grp-other', title: 'Other', skill: 'LISTENING', cefrLevel: 'B1', partNumber: 3 },
            skill: 'LISTENING',
            skillCode: 'listening.detail',
            cefrLevel: 'B1',
            type: 'MULTIPLE_CHOICE',
            usageScope: 'MOCK_EXAM',
            passage: null,
            prompt: 'Candidate item C',
            options: [],
            correctOption: null,
            explanation: null,
            audioUrl: null,
            irtA: 1,
            irtB: 0,
            irtC: 0.25,
            responsesCount: 4,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      createAdminAssessmentGroup: async () => existingGroup,
      updateAdminAssessmentGroup: async (_id: string, payload: any) => {
        updatedGroupPayload = payload;
        return existingGroup;
      },
      deleteAdminAssessmentGroup: async () => ({ id: 'grp-1', action: 'DELETED', detachedItemsCount: 0 }),
      deleteAdminAssessmentItem: async () => ({ id: 'x', action: 'DELETED' }),
      downloadAdminExport: async () => undefined,
    },
  }).default;

  const renderPage = () => {
    const shell = hooks.render(AdminItemsPage);
    return { shell, body: shell.props.children[0]() };
  };

  let view = renderPage();
  view.shell.props.onAuthenticated();
  view = renderPage();
  hooks.flushEffects();
  await tick();

  // Switch to Groups tab and open Edit Group modal
  button(view.body, 'Nhóm đề (Groups').props.onClick();
  view = renderPage();
  hooks.flushEffects();
  await tick();
  view = renderPage();
  button(view.body, 'Sửa').props.onClick();
  view = renderPage();
  hooks.flushEffects();
  await tick();
  view = renderPage();

  // Verify candidate badge for another group & responsesCount > 0, then add item-c
  const pickerText = text(view.body).replace(/\s+/g, ' ');
  assert.ok(pickerText.includes('Thuộc nhóm khác'));
  assert.ok(pickerText.includes('4 lượt trả lời'));
  button(view.body, '+ Thêm').props.onClick();
  view = renderPage();

  // Move second item (item-b) up to first position -> order becomes [item-b, item-a, item-c]
  const upButtons = nodes(view.body).filter(n => n.type === 'button' && n.props?.['aria-label'] === 'Di chuyển lên');
  upButtons[1].props.onClick();
  view = renderPage();

  // Clear title, passage, transcript; save group
  const titleInput = nodes(view.body).find(n => n.type === 'input' && n.props?.value === 'Part 1 Conversation');
  const passageArea = nodes(view.body).find(n => n.type === 'textarea' && n.props?.value === 'Old passage');
  const transcriptArea = nodes(view.body).find(n => n.type === 'textarea' && n.props?.value === 'Old transcript');
  titleInput.props.onChange({ target: { value: '  ' } });
  passageArea.props.onChange({ target: { value: '' } });
  transcriptArea.props.onChange({ target: { value: '' } });
  view = renderPage();

  // Also clear audioUrl via MediaUploadField prop
  const mediaField = nodes(view.body).find(n => typeof n.type === 'function' && n.props?.value === '/media/placement/old.wav');
  mediaField.props.onChange('');
  view = renderPage();

  const forms = nodes(view.body).filter(n => n.type === 'form');
  await forms[forms.length - 1].props.onSubmit({ preventDefault() {} });
  await tick();

  assert.ok(updatedGroupPayload, 'Expected updateAdminAssessmentGroup to be called');
  assert.equal(updatedGroupPayload.title, null);
  assert.equal(updatedGroupPayload.passage, null);
  assert.equal(updatedGroupPayload.audioUrl, null);
  assert.equal(updatedGroupPayload.transcript, null);
  assert.deepEqual(updatedGroupPayload.itemIds, ['item-b', 'item-a', 'item-c']);
});

test('AdminUsersPage surfaces detail load errors and renders all 5 recent activity entries', async () => {
  const hooks = hookHarness();
  let detailShouldFail = true;
  const sampleUser = {
    id: 'u-1',
    email: 'learner@example.com',
    name: 'Learner One',
    avatarUrl: null,
    provider: 'LOCAL',
    role: 'LEARNER',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: { targetCefr: 'B1', dailyGoalMinutes: 15, learningPurpose: 'WORK' },
    stats: { learningAttempts: 5, placementSessions: 5, vocabularyDecks: 1, speakingSubmissions: 5 },
  };
  const AdminUsersPage = loadComponent('app/admin/users/page.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/components/admin/AdminShell': { AdminShell: (props: any) => props },
    '@/components/admin/GlobalPagination': {},
    '@/components/admin/LegacyStatCard': {},
    '@/lib/admin-api': {
      listAdminUsers: async () => ({
        items: [sampleUser],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        summary: { total: 1, activeLearners30d: 1, learners: 1, admins: 0 },
      }),
      getAdminUserDetail: async () => {
        if (detailShouldFail) throw new Error('Detail fetch failed 503');
        return {
          ...sampleUser,
          recentAttempts: [1, 2, 3, 4, 5].map(i => ({
            id: `att-${i}`, lessonTitle: `Lesson #${i}`, status: 'COMPLETED', correctCount: 4, totalQuestions: 5, startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(),
          })),
          recentPlacements: [1, 2, 3, 4, 5].map(i => ({
            id: `pl-${i}`, status: 'COMPLETED', estimatedCefr: 'B1', correctCount: 10 + i, totalItems: 20, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
          })),
          recentSpeaking: [1, 2, 3, 4, 5].map(i => ({
            id: `sp-${i}`, promptTitle: `Prompt #${i}`, status: 'SUCCEEDED', overallScore: 80 + i, createdAt: new Date().toISOString(),
          })),
        };
      },
      downloadAdminExport: async () => undefined,
    },
  }).default;

  const renderPage = () => {
    const shell = hooks.render(AdminUsersPage);
    return { shell, body: shell.props.children[0]({ id: 'admin-1', role: 'ADMIN' }) };
  };

  let view = renderPage();
  view.shell.props.onAuthenticated();
  view = renderPage();
  hooks.flushEffects();
  await tick();
  view = renderPage();

  // First open fails -> error is surfaced instead of swallowed
  button(view.body, 'Xem / Sửa').props.onClick();
  await tick();
  view = renderPage();
  assert.ok(text(view.body).includes('Detail fetch failed 503'));

  // Second open succeeds -> all 5 attempts, placements, speaking items render without slicing
  detailShouldFail = false;
  button(view.body, 'Xem / Sửa').props.onClick();
  await tick();
  view = renderPage();
  const bodyText = text(view.body);
  assert.ok(bodyText.includes('Lesson #5'));
  assert.ok(bodyText.replace(/\s+/g, '').includes('15/20'));
  assert.ok(bodyText.includes('Prompt #5'));
});
