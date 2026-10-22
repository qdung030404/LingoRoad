const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function item(name, method, endpoint, body, script = []) {
  const result = { name, request: {
    method,
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url: { raw: '{{baseUrl}}' + endpoint, host: ['{{baseUrl}}'], path: endpoint.slice(1).split('/') },
    ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}),
  } };
  if (script.length) result.event = [{ listen: 'test', script: { type: 'text/javascript', exec: script } }];
  return result;
}
const tokens = ['const data = pm.response.json().data;', 'if (data) { pm.collectionVariables.set("accessToken", data.accessToken); pm.collectionVariables.set("refreshToken", data.refreshToken); }'];
const currentItem = [
  'const data = pm.response.json().data;',
  'if (data) {',
  '  if (data.sessionId) pm.collectionVariables.set("sessionId", data.sessionId);',
  '  const item = data.firstItem || data.nextItem;',
  '  if (item) { pm.collectionVariables.set("itemId", item.id); pm.collectionVariables.set("itemIndex", item.index); pm.collectionVariables.set("selectedOption", item.options[0]); }',
  '}',
];
const collection = {
  info: { name: 'LingoRoad First Demo — Reading + Listening', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: '10 câu (5 Đọc, 5 Nghe); CEFR sơ bộ. Chạy trên database demo riêng. Chọn đáp án theo nội dung trước khi gửi; đáp án đã nộp bị khóa.' },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }, { key: 'email', value: 'demo-learner@example.com' }, { key: 'password', value: 'DemoEnglish123' }, ...['accessToken', 'refreshToken', 'sessionId', 'itemId', 'selectedOption'].map((key) => ({ key, value: '' })), { key: 'itemIndex', value: '0' }],
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  item: [
    item('Health', 'GET', '/health'),
    item('Register', 'POST', '/auth/register', { name: 'Học viên Demo', email: '{{email}}', password: '{{password}}' }, tokens),
    item('Login', 'POST', '/auth/login', { email: '{{email}}', password: '{{password}}' }, tokens),
    item('Refresh', 'POST', '/auth/refresh', { refreshToken: '{{refreshToken}}' }, tokens),
    item('Get profile', 'GET', '/auth/me'),
    item('Complete onboarding / update profile', 'PATCH', '/auth/me', { learningPurpose: 'WORK', dailyGoalMinutes: 10, selfAssessedCefr: null }),
    item('Placement status', 'GET', '/placement/status'),
    item('Start or resume placement', 'POST', '/placement/start', undefined, currentItem),
    item('Submit current answer', 'POST', '/placement/{{sessionId}}/answer', { itemId: '{{itemId}}', itemIndex: '{{itemIndex}}', selectedOption: '{{selectedOption}}', responseTimeMs: 1500 }, currentItem),
    item('Placement result', 'GET', '/placement/{{sessionId}}/result'),
    item('Read-only review', 'GET', '/placement/{{sessionId}}/review'),
    item('Change password', 'POST', '/auth/change-password', { oldPassword: '{{password}}', newPassword: 'NewDemoEnglish456' }),
    item('Logout', 'POST', '/auth/logout', { refreshToken: '{{refreshToken}}' }),
  ],
};
// itemIndex must be JSON integer after Postman substitution, not a numeric string.
collection.item.find((i) => i.name === 'Submit current answer').request.body.raw = collection.item.find((i) => i.name === 'Submit current answer').request.body.raw.replace('"{{itemIndex}}"', '{{itemIndex}}');
fs.writeFileSync(path.join(root, 'LingoRoad_Demo_API.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log('Updated LingoRoad_Demo_API.postman_collection.json');
