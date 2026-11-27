import { test, describe } from 'node:test';
import assert from 'node:assert';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import { FAQ_DATA } from '../src/data/landing-content';

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
});
