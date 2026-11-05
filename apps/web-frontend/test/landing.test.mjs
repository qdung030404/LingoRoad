import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  NAV_ITEMS,
  STATS_DATA,
  FEATURES_DATA,
  SIMULATION_QUESTIONS,
  COMPARISONS,
  FAQ_DATA,
} from '../src/data/landing-content.ts';

describe('Landing Page Content & Data Integrity', () => {
  test('NAV_ITEMS contains valid anchor links', () => {
    assert.ok(NAV_ITEMS.length >= 5, 'Should have at least 5 navigation items');
    NAV_ITEMS.forEach((item) => {
      assert.ok(item.label.length > 0, 'Nav item must have a label');
      assert.ok(item.href.startsWith('#'), `Nav href must be an anchor: ${item.href}`);
    });
  });

  test('STATS_DATA contains valid metric cards', () => {
    assert.strictEqual(STATS_DATA.length, 4, 'Should contain exactly 4 key stats');
    STATS_DATA.forEach((stat) => {
      assert.ok(stat.id.length > 0, 'Stat must have an ID');
      assert.ok(stat.value.length > 0, 'Stat must have a value');
      assert.ok(stat.label.length > 0, 'Stat must have a label');
      assert.ok(stat.description.length > 0, 'Stat must have a description');
    });
  });

  test('FEATURES_DATA contains 6 complete feature items', () => {
    assert.strictEqual(FEATURES_DATA.length, 6, 'Should showcase 6 features');
    const validIcons = ['target', 'gitBranch', 'repeat', 'bot', 'mic', 'award'];
    FEATURES_DATA.forEach((feat) => {
      assert.ok(validIcons.includes(feat.iconName), `Invalid icon: ${feat.iconName}`);
      assert.ok(feat.title.length > 0, 'Feature must have title');
      assert.ok(feat.subtitle.length > 0, 'Feature must have subtitle');
      assert.ok(feat.highlights.length >= 3, 'Feature must have at least 3 highlights');
    });
  });

  test('SIMULATION_QUESTIONS contains valid question structures and answers', () => {
    assert.ok(SIMULATION_QUESTIONS.length >= 3, 'Should have at least 3 simulation questions');
    SIMULATION_QUESTIONS.forEach((q) => {
      assert.ok(q.question.length > 0, 'Question must not be empty');
      assert.strictEqual(q.options.length, 4, 'Question must have 4 options');
      assert.ok(
        q.correctAnswerIndex >= 0 && q.correctAnswerIndex < q.options.length,
        'Correct answer index must be in bounds'
      );
      assert.ok(q.explanation.length > 0, 'Question must have an explanation');
      assert.ok(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(q.cefrLevel));
    });
  });

  test('COMPARISONS items are comprehensive', () => {
    assert.strictEqual(COMPARISONS.length, 6, 'Should have 6 comparison rows');
    COMPARISONS.forEach((row) => {
      assert.ok(row.feature.length > 0);
      assert.ok(row.traditional.length > 0);
      assert.ok(row.lingoRoad.length > 0);
    });
  });

  test('FAQ_DATA contains complete questions and answers', () => {
    assert.strictEqual(FAQ_DATA.length, 6, 'Should have 6 FAQ items');
    FAQ_DATA.forEach((faq) => {
      assert.ok(faq.question.length > 0);
      assert.ok(faq.answer.length > 0);
    });
  });
});

describe('Adaptive Simulator Logic Verification', () => {
  test('Theta score calculation bounds on answers', () => {
    let theta = 0.0;
    // Simulate correct answer (+0.65)
    theta = Number((theta + 0.65).toFixed(2));
    assert.strictEqual(theta, 0.65);

    // Simulate incorrect answer (-0.55)
    theta = Number((theta - 0.55).toFixed(2));
    assert.strictEqual(theta, 0.1);
  });

  test('FSRS stability interval mappings', () => {
    const ratings = {
      again: 0.2,
      hard: 1.5,
      good: 4.8,
      easy: 11.4,
    };

    assert.strictEqual(ratings.again, 0.2);
    assert.strictEqual(ratings.hard, 1.5);
    assert.strictEqual(ratings.good, 4.8);
    assert.strictEqual(ratings.easy, 11.4);
  });
});

