import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  button,
  hookHarness,
  loadComponent,
  nodes,
  text,
  tick,
} from './admin-test-harness';

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
