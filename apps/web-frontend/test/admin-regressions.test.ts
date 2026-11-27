import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as helpers from '../src/lib/admin-validation';
import {
  button,
  hookHarness,
  loadComponent,
  nodes,
  text,
  tick,
} from './admin-regression-harness';
function content() {
  return {
    steps: [], passage: 'A reading passage.', coverImageUrl: 'https://example.com/cover.png',
    keyVocabulary: [{ id: 'v1', word: 'reading', meaning: 'đọc' }],
    questions: [1, 2, 3].map(i => ({
      id: `q${i}`, type: 'MULTIPLE_CHOICE' as const, prompt: `Question ${i}`, explanation: 'Explanation',
      options: ['A', 'B', 'C', 'D'].map(id => ({ id, text: id, imageUrl: `https://example.com/${id}.png` })), correctOptionId: 'B'
    })),
  };
}

test('lesson editor preserves media and vocabulary through JSON → form → JSON → save, including empty steps', async () => {
  interface SavedLessonCall {
    content: {
      steps: unknown[];
      keyVocabulary: unknown[];
      questions: Array<{ options: Array<{ imageUrl?: string }> }>;
    };
  }
  const hooks = hookHarness();
  let saved: SavedLessonCall | undefined;
  const { LessonComposerModal } = loadComponent('components/admin/LessonComposerModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    './ListeningLessonForm': { ListeningLessonForm: () => null },
    '@/lib/admin-api': {
      updateAdminLesson: async (_id: string, payload: SavedLessonCall) => { saved = payload; },
      resolveAdminMediaUrl: (u: string) => u,
    },
  });
  const original = content();
  const props = { units: [], editingLesson: { id: 'l1', code: 'reading', kind: 'READING', title: 'Reading', description: 'Description', estimatedMinutes: 5, content: original }, onClose() { }, onSaved() { }, onUnitCreated() { } };
  let tree = hooks.render(LessonComposerModal, props);
  // Saving a valid lesson with no steps must not inject an empty required step.
  await nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();
  assert.ok(saved);
  assert.equal(saved.content.steps.length, 0);
  assert.deepEqual(saved.content.keyVocabulary, original.keyVocabulary);
  assert.equal(saved.content.questions[0].options[0].imageUrl, original.questions[0].options[0].imageUrl);
  button(tree, 'Soạn JSON nâng cao').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  const edited = content(); edited.questions[0].prompt = 'Updated in JSON';
  nodes(tree).find(node => node.type === 'textarea' && node.props.rows === 14)!.props.onChange({ target: { value: JSON.stringify(edited) } });
  tree = hooks.render(LessonComposerModal, props);
  button(tree, 'Biểu mẫu trực quan').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  button(tree, 'Soạn JSON nâng cao').props.onClick();
  tree = hooks.render(LessonComposerModal, props);
  await nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() { } });
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
  interface SavedItemCall {
    correctOption?: string | null;
    options?: unknown;
  }
  const hooks = hookHarness(); let saved: SavedItemCall | undefined;
  const { AssessmentItemModal } = loadComponent('components/admin/AssessmentItemModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': { updateAdminAssessmentItem: async (_id: string, payload: SavedItemCall) => { saved = payload; } },
  });
  const options = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((label, i) => ({ id: String(i), text: label }));
  const tree = hooks.render(AssessmentItemModal, { descriptors: [], editingItem: { id: 'i1', skill: 'READING', skillCode: 'reading.scanning', cefrLevel: 'A2', type: 'MULTIPLE_CHOICE', usageScope: 'ALL', prompt: 'Question?', options, correctOption: '2' }, onClose() { }, onSaved() { } });
  await nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() { } }); await tick();
  assert.ok(saved);
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
    onClose() { },
    onSaved() { },
  };
  let tree = hooks.render(AssessmentItemModal, props);
  await nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() { } });
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
  const hooks = hookHarness(); let resolveValidation: (value: unknown) => void = () => { }; let applyCount = 0;
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
  const render = () => (hooks.render(Page).props.children as Array<() => unknown>)[0]();
  let tree = render();
  nodes(tree).find(node => node.type === 'textarea')!.props.onChange({ target: { value: '{"items":[{"prompt":"A"}]}' } });
  tree = render(); button(tree, '1. Kiểm tra').props.onClick();
  tree = render(); nodes(tree).find(node => node.type === 'textarea')!.props.onChange({ target: { value: '{"items":[{"prompt":"B"}]}' } });
  resolveValidation({ isValid: true, errors: [], preview: { totalRecords: 1, counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(key => [key, { create: 0, update: 0 }])), records: [] } });
  await tick(); tree = render();
  assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node).includes('Tiếp tục bước Xác nhận')));
  assert.equal(nodes(tree).find(node => node.type === 'textarea')!.props.value, '{"items":[{"prompt":"B"}]}');
  assert.equal(applyCount, 0);
  button(tree, '1. Kiểm tra').props.onClick();
  resolveValidation({ isValid: true, errors: [], preview: { totalRecords: 1, counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(key => [key, { create: 0, update: 0 }])), records: [] } });
  await tick(); tree = render();
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(node => node.type === 'input' && node.props.type === 'checkbox')!.props.onChange({ target: { checked: true } });
  tree = render();
  const apply = button(tree, '4.');
  apply.props.onClick(); apply.props.onClick();
  await tick();
  assert.equal(applyCount, 1, 'the current validated draft applies once, even before the next render');
});

test('shell persists profile using refreshed tokens rather than captured tokens', async () => {
  const hooks = hookHarness(); const user = { id: 'a1', name: 'Admin', role: 'ADMIN' };
  let session: { accessToken: string; refreshToken: string; user: typeof user } = { accessToken: 'old', refreshToken: 'old-refresh', user };
  const { AdminShell } = loadComponent('components/admin/AdminShell.tsx', {
    react: hooks.react, 'next/link': () => null, 'next/navigation': { useRouter: () => ({ replace() { } }), usePathname: () => '/admin' }, 'lucide-react': {}, './LingoRoadWordmark': {},
    '@/lib/admin-api': { getStoredAdminSession: () => session, getAdminMe: async () => { session = { ...session, accessToken: 'new', refreshToken: 'new-refresh' }; return user; }, saveAdminSession: (value: { accessToken: string; refreshToken: string; user: typeof user }) => { session = value; }, clearAdminSession() { } },
  });
  hooks.render(AdminShell, { title: 'Admin', children() { } }); hooks.effects[0](); await tick();
  assert.equal(session.accessToken, 'new'); assert.equal(session.refreshToken, 'new-refresh');
});

test('GrammarTopicModal preserves comma typing in signalWords and submits canonical BE schema', async () => {
  interface SavedGrammarPayload {
    code: string;
    formulas: Array<Record<string, unknown>>;
    usageNotes: Array<Record<string, unknown>>;
    examples: Array<Record<string, unknown>>;
  }
  const hooks = hookHarness();
  let createdPayload: SavedGrammarPayload | null = null;
  const { GrammarTopicModal } = loadComponent('components/admin/GrammarTopicModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    '@/lib/admin-api': {
      createAdminGrammarTopic: async (payload: SavedGrammarPayload) => { createdPayload = payload; },
      updateAdminGrammarTopic: async () => undefined,
    },
  });

  const props = { allTopics: [], editingTopic: null, onClose() { }, onSaved() { } };
  let tree = hooks.render(GrammarTopicModal, props);
  const findInput = (t: unknown, placeholder: string) =>
    nodes(t).find(n => n.type === 'input' && typeof n.props?.placeholder === 'string' && n.props.placeholder.includes(placeholder))!;

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

  await nodes(tree).find(n => n.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();

  const captured = createdPayload as SavedGrammarPayload | null;
  assert.ok(captured, 'Expected createAdminGrammarTopic to be called');
  assert.equal(captured.code, 'grammar.tenses.present_simple');
  assert.deepEqual(captured.formulas, [
    { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V(s/es) + O' },
  ]);
  assert.deepEqual(captured.usageNotes, [
    { useCaseVi: 'Diễn tả thói quen hàng ngày', signalWords: ['always', 'usually', 'every day'] },
  ]);
  assert.deepEqual(captured.examples, [
    { sentenceEn: 'She goes to work by bus.', translationVi: 'Cô ấy đi làm bằng xe buýt.', highlight: 'goes' },
  ]);
  assert.equal('label' in captured.formulas[0], false);
  assert.equal('pattern' in captured.formulas[0], false);
  assert.equal('usage' in captured.usageNotes[0], false);
  assert.equal('en' in captured.examples[0], false);
});

test('SpeakingPromptModal preserves preparation.vocabulary[].imageUrl and requires TONGUE_TWISTER confirmation', async () => {
  interface SavedSpeakingPayload {
    preparation?: {
      vocabulary?: Array<{ imageUrl?: string }>;
    };
  }
  // Part A: TOPIC prompt preserves vocabulary imageUrl
  const topicHooks = hookHarness();
  let topicPayload: SavedSpeakingPayload | null = null;
  const { SpeakingPromptModal: TopicModal } = loadComponent('components/admin/SpeakingPromptModal.tsx', {
    react: topicHooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': {
      createAdminSpeakingPrompt: async () => undefined,
      updateAdminSpeakingPrompt: async (_id: string, payload: SavedSpeakingPayload) => { topicPayload = payload; },
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
    onClose() { },
    onSaved() { },
  };

  const topicTree = topicHooks.render(TopicModal, topicProps);
  await nodes(topicTree).find(n => n.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();

  const capturedTopic = topicPayload as SavedSpeakingPayload | null;
  assert.ok(capturedTopic, 'Expected updateAdminSpeakingPrompt to be called for TOPIC');
  assert.equal(
    capturedTopic.preparation?.vocabulary?.[0]?.imageUrl,
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
    onClose() { },
    onSaved() { },
  };

  let twisterTree = twisterHooks.render(TwisterModal, twisterProps);
  const textArea = nodes(twisterTree).find(n => n.type === 'textarea' && n.props?.required)!;
  textArea.props.onChange({ target: { value: 'She sells fresh seashells by the seashore.' } });
  twisterTree = twisterHooks.render(TwisterModal, twisterProps);

  const warningText = text(twisterTree);
  const compactWarning = warningText.replace(/\s+/g, '');
  assert.ok(warningText.includes('contentVersion'));
  assert.ok(compactWarning.includes('v2→v3'));
  assert.equal(button(twisterTree, 'Lưu thay đổi').props.disabled, true);

  await nodes(twisterTree).find(n => n.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();
  assert.equal(twisterCalls, 0, 'Must block submit before confirmation checkbox is checked');

  const checkboxes = nodes(twisterTree).filter(n => n.type === 'input' && n.props?.type === 'checkbox');
  checkboxes[checkboxes.length - 1].props.onChange({ target: { checked: true } });
  twisterTree = twisterHooks.render(TwisterModal, twisterProps);
  assert.equal(button(twisterTree, 'Lưu thay đổi').props.disabled, false);

  await nodes(twisterTree).find(n => n.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();
  assert.equal(twisterCalls, 1);
});

test('AssessmentItemModal preserves Writing rubric criteria and sends null for cleared nullable fields', async () => {
  interface SavedAssessmentPayload {
    externalId: string | null;
    passage: string | null;
    explanation: string | null;
    correctOption: string | null;
    rubricCriteria: Record<string, unknown> | null;
  }
  const hooks = hookHarness();
  let savedPayload: SavedAssessmentPayload | null = null;
  const { AssessmentItemModal } = loadComponent('components/admin/AssessmentItemModal.tsx', {
    react: hooks.react,
    'lucide-react': {},
    '@/lib/admin-validation': helpers,
    './MediaUploadField': { MediaUploadField: () => null },
    '@/lib/admin-api': {
      updateAdminAssessmentItem: async (_id: string, payload: SavedAssessmentPayload) => { savedPayload = payload; },
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
    onClose() { },
    onSaved() { },
  };

  let tree = hooks.render(AssessmentItemModal, props);
  const extInput = nodes(tree).find(n => n.type === 'input' && n.props?.value === 'writing-b1-essay-1')!;
  const passageArea = nodes(tree).find(n => n.type === 'textarea' && n.props?.value === 'Context passage to clear')!;
  const explanationArea = nodes(tree).find(n => n.type === 'textarea' && n.props?.value === 'Old explanation to clear')!;

  extInput.props.onChange({ target: { value: '   ' } });
  passageArea.props.onChange({ target: { value: '' } });
  explanationArea.props.onChange({ target: { value: '  ' } });
  tree = hooks.render(AssessmentItemModal, props);

  await nodes(tree).find(n => n.type === 'form')!.props.onSubmit({ preventDefault() { } });
  await tick();

  const capturedAssessment = savedPayload as SavedAssessmentPayload | null;
  assert.ok(capturedAssessment, 'Expected updateAdminAssessmentItem to be called');
  assert.equal(capturedAssessment.externalId, null);
  assert.equal(capturedAssessment.passage, null);
  assert.equal(capturedAssessment.explanation, null);
  assert.equal(capturedAssessment.correctOption, null);
  assert.deepEqual(capturedAssessment.rubricCriteria, seededRubric);
});

test('AdminImportPage resets validation when topicWordsMode changes and blocks stale apply', async () => {
  const hooks = hookHarness();
  const appliedModes: string[] = [];
  const validatedModes: string[] = [];
  const okValidation = {
    isValid: true,
    errors: [],
    preview: {
      totalRecords: 1,
      counts: Object.fromEntries(['units', 'lessons', 'items', 'topics'].map(k => [k, { create: 1, update: 0 }])),
      records: [],
    },
  };
  let resolveApply: ((v: { appliedAt: string; preview: typeof okValidation.preview }) => void) | null = null;

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

  const render = () => (hooks.render(Page).props.children as Array<() => unknown>)[0]();
  let tree = render();

  await button(tree, '1. Kiểm tra').props.onClick();
  await tick();
  tree = render();
  assert.deepEqual(validatedModes, ['merge']);
  assert.ok(nodes(tree).some(n => n.type === 'button' && text(n).includes('Tiếp tục bước Xác nhận')));

  // Advance to Step 3 and confirm
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(n => n.type === 'input' && n.props?.type === 'checkbox')!.props.onChange({ target: { checked: true } });
  tree = render();
  assert.ok(button(tree, '4.'));

  // Switching topicWordsMode from merge -> replace must reset validation back to Step 1
  const modeSelect = nodes(tree).find(n => n.type === 'select')!;
  modeSelect.props.onChange({ target: { value: 'replace' } });
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'select')!.props.value, 'replace');
  assert.ok(!nodes(tree).some(n => n.type === 'button' && text(n).includes('4.')));
  assert.equal(appliedModes.length, 0);

  // Re-validate under replace mode and apply; mode select must be disabled while applying
  await button(tree, '1. Kiểm tra').props.onClick();
  await tick();
  tree = render();
  button(tree, 'Tiếp tục bước Xác nhận').props.onClick();
  tree = render();
  nodes(tree).find(n => n.type === 'input' && n.props?.type === 'checkbox')!.props.onChange({ target: { checked: true } });
  tree = render();
  button(tree, '4.').props.onClick();
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'select')!.props.disabled, true);
  assert.deepEqual(appliedModes, ['replace']);

  resolveApply!({ appliedAt: new Date().toISOString(), preview: okValidation.preview });
  await tick();
});
