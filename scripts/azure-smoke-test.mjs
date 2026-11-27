#!/usr/bin/env node
/**
 * Smoke test tự động cho bản triển khai LingoRoad Admin & Backend trên Azure App Service.
 *
 * Kiểm chứng:
 * 1. Backend GET /health trả về 200 kèm { database: 'ready', schema: 'ready' }, khớp version (nếu truyền --expected-version) và không lộ header X-Powered-By.
 * 2. Web Admin GET /health trả về 200 kèm { status: 'ok', service: 'web-frontend' } và khớp version (nếu truyền --expected-version).
 * 3. Các trang Admin mở trực tiếp trả về HTTP 200, có header Content-Security-Policy và không chứa localhost:3000 trong HTML.
 * 4. Chính sách CORS trên Backend: cho phép origin của Web Admin và từ chối origin lạ.
 * 5. Bảo vệ API /admin/users khi không có token trả về 401.
 * 6. Media Listening tĩnh (/media/learning/v1/...) hoặc ranh giới payload > 5 MB trả 413 REQUEST_BODY_TOO_LARGE.
 */

import assert from 'node:assert/strict';

function parseArgs(argv) {
  const args = {
    backendUrl: process.env.BACKEND_URL || '',
    frontendUrl: process.env.FRONTEND_URL || '',
    expectedVersion: process.env.EXPECTED_VERSION || '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--backend-url' && argv[i + 1]) {
      args.backendUrl = argv[++i];
    } else if (token === '--frontend-url' && argv[i + 1]) {
      args.frontendUrl = argv[++i];
    } else if (token === '--expected-version' && argv[i + 1]) {
      args.expectedVersion = argv[++i];
    }
  }

  args.backendUrl = args.backendUrl.trim().replace(/\/+$/, '');
  args.frontendUrl = args.frontendUrl.trim().replace(/\/+$/, '');
  return args;
}

async function fetchWithRetry(url, options = {}, retries = 12, delayMs = 5000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500 || attempt === retries) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function main() {
  const { backendUrl, frontendUrl, expectedVersion } = parseArgs(process.argv);
  assert.ok(backendUrl, 'Thiếu --backend-url hoặc biến môi trường BACKEND_URL.');
  assert.ok(frontendUrl, 'Thiếu --frontend-url hoặc biến môi trường FRONTEND_URL.');

  const report = {
    checkedAt: new Date().toISOString(),
    backendUrl,
    frontendUrl,
    expectedVersion: expectedVersion || null,
    checks: [],
  };

  // 1. Backend /health (chờ container mới hoàn tất swap nếu có --expected-version)
  let backendHealth = null;
  let backendStatus = 0;
  let backendHealthHeaders = null;
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    try {
      const res = await fetch(`${backendUrl}/health`);
      backendStatus = res.status;
      backendHealthHeaders = res.headers;
      if (res.status === 200) {
        const body = await res.json();
        backendHealth = body;
        const versionMatches =
          !expectedVersion || body?.data?.version === expectedVersion;
        if (
          body?.success === true &&
          body?.data?.status === 'ok' &&
          body?.data?.database === 'ready' &&
          body?.data?.schema === 'ready' &&
          versionMatches
        ) {
          break;
        }
      }
    } catch {
      // Thử lại trong thời gian container khởi động
    }
    if (attempt < 36) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  assert.equal(
    backendStatus,
    200,
    `Backend /health phải trả 200, nhận được ${backendStatus}`,
  );
  assert.equal(backendHealth?.success, true);
  assert.equal(backendHealth?.data?.status, 'ok');
  assert.equal(backendHealth?.data?.database, 'ready');
  assert.equal(backendHealth?.data?.schema, 'ready');
  if (expectedVersion) {
    assert.equal(
      backendHealth?.data?.version,
      expectedVersion,
      `Phiên bản backend (${backendHealth?.data?.version}) không khớp expectedVersion (${expectedVersion})`,
    );
  }
  assert.equal(
    backendHealthHeaders?.get('x-powered-by'),
    null,
    'Backend không được để lộ header X-Powered-By',
  );
  report.checks.push({
    name: 'backend_health',
    status: 'passed',
    version: backendHealth?.data?.version ?? null,
  });

  // 2. Frontend /health (chờ container mới hoàn tất swap nếu có --expected-version)
  let frontendHealth = null;
  let frontendStatus = 0;
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    try {
      const res = await fetch(`${frontendUrl}/health`);
      frontendStatus = res.status;
      if (res.status === 200) {
        const body = await res.json();
        frontendHealth = body;
        const versionMatches =
          !expectedVersion || body?.data?.version === expectedVersion;
        if (
          body?.success === true &&
          body?.data?.status === 'ok' &&
          body?.data?.service === 'web-frontend' &&
          versionMatches
        ) {
          break;
        }
      }
    } catch {
      // Thử lại trong thời gian container khởi động
    }
    if (attempt < 36) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  assert.equal(
    frontendStatus,
    200,
    `Frontend /health phải trả 200, nhận được ${frontendStatus}`,
  );
  assert.equal(frontendHealth?.success, true);
  assert.equal(frontendHealth?.data?.status, 'ok');
  assert.equal(frontendHealth?.data?.service, 'web-frontend');
  if (expectedVersion) {
    assert.equal(
      frontendHealth?.data?.version,
      expectedVersion,
      `Phiên bản frontend (${frontendHealth?.data?.version}) không khớp expectedVersion (${expectedVersion})`,
    );
  }
  report.checks.push({
    name: 'frontend_health',
    status: 'passed',
    version: frontendHealth?.data?.version,
  });

  // 3. Mở trực tiếp các trang Admin trên Web Admin
  const adminRoutes = [
    '/admin/login',
    '/admin/users',
    '/admin/system',
    '/admin/units',
    '/admin/lessons',
    '/admin/grammar',
    '/admin/vocabulary',
    '/admin/speaking',
    '/admin/items',
    '/admin/import',
    '/admin/audit-logs',
  ];
  for (const route of adminRoutes) {
    const pageRes = await fetchWithRetry(`${frontendUrl}${route}`, {}, 3, 2000);
    assert.equal(
      pageRes.status,
      200,
      `Trang ${route} phải trả 200, nhận được ${pageRes.status}`,
    );
    assert.ok(
      pageRes.headers.get('content-security-policy')?.trim(),
      `Trang ${route} phải có header Content-Security-Policy`,
    );
    const html = await pageRes.text();
    assert.ok(
      !html.includes('http://localhost:3000'),
      `Trang ${route} không được chứa tham chiếu http://localhost:3000`,
    );
  }
  report.checks.push({
    name: 'frontend_admin_routes',
    status: 'passed',
    routes: adminRoutes,
  });
  report.checks.push({
    name: 'security_headers',
    status: 'passed',
  });

  // 4. Kiểm tra CORS trên Backend: cho phép origin Frontend, chặn origin lạ
  const corsAllowedRes = await fetch(`${backendUrl}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendUrl,
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.equal(
    corsAllowedRes.headers.get('access-control-allow-origin'),
    frontendUrl,
    `CORS Backend phải cho phép origin ${frontendUrl}`,
  );

  const corsBlockedRes = await fetch(`${backendUrl}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted-origin.example.com',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.notEqual(
    corsBlockedRes.headers.get('access-control-allow-origin'),
    'https://untrusted-origin.example.com',
    'CORS Backend phải chặn origin không nằm trong CORS_ALLOWED_ORIGINS',
  );
  report.checks.push({ name: 'backend_cors_policy', status: 'passed' });

  // 5. Bảo vệ endpoint /admin/users khi chưa đăng nhập
  const unauthRes = await fetch(`${backendUrl}/admin/users`);
  assert.equal(
    unauthRes.status,
    401,
    `GET /admin/users không có token phải trả 401, nhận được ${unauthRes.status}`,
  );
  report.checks.push({ name: 'backend_admin_auth_guard', status: 'passed' });

  // 6. Kiểm tra giới hạn payload > 5 MB trả về 413 REQUEST_BODY_TOO_LARGE rõ ràng
  const oversizedRes = await fetch(`${backendUrl}/admin/imports/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundle: 'x'.repeat(5 * 1024 * 1024 + 1024) }),
  });
  assert.equal(
    oversizedRes.status,
    413,
    `Payload vượt 5 MB phải trả 413, nhận được ${oversizedRes.status}`,
  );
  const oversizedBody = await oversizedRes.json();
  assert.equal(oversizedBody?.error?.code, 'REQUEST_BODY_TOO_LARGE');
  report.checks.push({ name: 'backend_payload_5mb_limit', status: 'passed' });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    'Smoke test thất bại:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
