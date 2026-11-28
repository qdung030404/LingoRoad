import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import { FAQ_DATA } from '../src/data/landing-content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const requireFromTest = createRequire(import.meta.url);

describe('Public Web SEO & Production Plumbing', () => {
  test('robots() allows public routes and disallows admin & health endpoints', () => {
    const previousUrl = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      const result = robots();
      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

      assert.ok(rules, 'robots() must return at least one rule');
      assert.strictEqual(rules.userAgent, '*');

      const allowList = Array.isArray(rules.allow) ? rules.allow : rules.allow ? [rules.allow] : [];
      const disallowList = Array.isArray(rules.disallow)
        ? rules.disallow
        : rules.disallow
          ? [rules.disallow]
          : [];

      assert.ok(allowList.includes('/'), 'robots() must allow /');
      assert.ok(allowList.includes('/privacy'), 'robots() must allow /privacy');
      assert.ok(allowList.includes('/terms'), 'robots() must allow /terms');

      assert.ok(disallowList.includes('/admin'), 'robots() must disallow /admin');
      assert.ok(disallowList.includes('/admin/'), 'robots() must disallow /admin/');
      assert.ok(disallowList.includes('/health'), 'robots() must disallow /health');

      assert.strictEqual(
        result.sitemap,
        'https://lingoroad-admin-wfpi3gzq.azurewebsites.net/sitemap.xml'
      );
    } finally {
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previousUrl;
      }
    }
  });

  test('robots() and sitemap() respect NEXT_PUBLIC_SITE_URL without trailing slash duplication', () => {
    const previousUrl = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://lingoroad.app/';
      const robotsResult = robots();
      const sitemapResult = sitemap();

      assert.strictEqual(robotsResult.sitemap, 'https://lingoroad.app/sitemap.xml');

      const urls = sitemapResult.map((entry) => entry.url);
      assert.deepStrictEqual(urls, [
        'https://lingoroad.app/',
        'https://lingoroad.app/privacy',
        'https://lingoroad.app/terms',
      ]);
    } finally {
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previousUrl;
      }
    }
  });

  test('sitemap() includes /, /privacy, /terms and excludes /admin & /health', () => {
    const entries = sitemap();
    const pathnames = entries.map((entry) => new URL(entry.url).pathname);

    assert.ok(pathnames.includes('/'), 'sitemap() must include /');
    assert.ok(pathnames.includes('/privacy'), 'sitemap() must include /privacy');
    assert.ok(pathnames.includes('/terms'), 'sitemap() must include /terms');
    assert.ok(
      !pathnames.some((pathname) => pathname.startsWith('/admin') || pathname.startsWith('/health')),
      'sitemap() must not expose /admin or /health routes'
    );
  });

  test('FAQ reflects iOS upcoming status instead of claiming iOS is already live', () => {
    const deviceFaq = FAQ_DATA.find((item) => item.answer.includes('iOS'));
    assert.ok(deviceFaq, 'Expected a device availability FAQ entry mentioning iOS');
    assert.ok(
      deviceFaq.answer.includes('Sắp ra mắt'),
      'iOS availability FAQ must state "Sắp ra mắt"'
    );
  });

  test('Self-hosted Be Vietnam Pro fonts and typography config are wired across layout, CSS, and Tailwind', () => {
    const fontsDir = path.join(WEB_ROOT, 'src', 'app', 'fonts');
    const expectedFontFiles = [
      'BeVietnamPro-Regular.ttf',
      'BeVietnamPro-Italic.ttf',
      'BeVietnamPro-Medium.ttf',
      'BeVietnamPro-SemiBold.ttf',
      'BeVietnamPro-Bold.ttf',
      'BeVietnamPro-ExtraBold.ttf',
    ];

    for (const fontFile of expectedFontFiles) {
      const fullPath = path.join(fontsDir, fontFile);
      assert.ok(fs.existsSync(fullPath), `Missing local font file: ${fontFile}`);
      assert.ok(fs.statSync(fullPath).size > 0, `Font file must not be empty: ${fontFile}`);
    }

    const layoutSource = fs.readFileSync(
      path.join(WEB_ROOT, 'src', 'app', 'layout.tsx'),
      'utf8'
    );
    assert.ok(
      layoutSource.includes("from 'next/font/local'"),
      'layout.tsx must load fonts via next/font/local'
    );
    assert.ok(
      !layoutSource.includes('next/font/google'),
      'layout.tsx must not depend on next/font/google'
    );
    assert.ok(
      layoutSource.includes("variable: '--font-be-vietnam-pro'"),
      'layout.tsx must expose --font-be-vietnam-pro CSS variable'
    );
    for (const fontFile of expectedFontFiles) {
      assert.ok(
        layoutSource.includes(`./fonts/${fontFile}`),
        `layout.tsx must register ${fontFile}`
      );
    }
    assert.ok(
      layoutSource.includes('beVietnamPro.variable') && layoutSource.includes('font-sans'),
      'layout.tsx must attach beVietnamPro.variable to <html> and font-sans to <body>'
    );

    const globalsCss = fs.readFileSync(
      path.join(WEB_ROOT, 'src', 'app', 'globals.css'),
      'utf8'
    );
    assert.ok(
      globalsCss.includes('font-family: var(--font-be-vietnam-pro), "Be Vietnam Pro"'),
      'globals.css must prioritize --font-be-vietnam-pro and "Be Vietnam Pro"'
    );

    const tailwindConfig = requireFromTest('../tailwind.config.js');
    const sansStack: string[] = tailwindConfig?.theme?.extend?.fontFamily?.sans ?? [];
    assert.strictEqual(
      sansStack[0],
      'var(--font-be-vietnam-pro)',
      'tailwind.config.js fontFamily.sans[0] must be var(--font-be-vietnam-pro)'
    );
    assert.strictEqual(
      sansStack[1],
      '"Be Vietnam Pro"',
      'tailwind.config.js fontFamily.sans[1] must be "Be Vietnam Pro"'
    );
  });
});
