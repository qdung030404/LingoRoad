import { PrismaClient, CefrLevel, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_ITEMS = [
  // ── A1 Items ──────────────────────────────────────────────────────────────
  {
    skillCode: 'grammar-present-simple',
    cefrLevel: CefrLevel.A1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'I ___ a student.',
    options: ['am', 'is', 'are', 'be'],
    correctOption: 'am',
    explanation: "With the first-person singular pronoun 'I', we use the verb 'am'.",
    irtA: 0.8,
    irtB: -1.5,
    irtC: 0.25,
  },
  {
    skillCode: 'vocabulary-daily-routine',
    cefrLevel: CefrLevel.A1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'She drinks coffee in the ___.',
    options: ['morning', 'tomorrow', 'night', 'clock'],
    correctOption: 'morning',
    explanation: "'In the morning' is the standard prepositional phrase for early day.",
    irtA: 0.9,
    irtB: -1.2,
    irtC: 0.25,
  },
  {
    skillCode: 'grammar-plurals',
    cefrLevel: CefrLevel.A1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'There are two ___ on the table.',
    options: ['book', 'books', 'bookes', 'booking'],
    correctOption: 'books',
    explanation: "Regular nouns form plural by adding '-s'.",
    irtA: 1.0,
    irtB: -1.0,
    irtC: 0.25,
  },

  // ── A2 Items ──────────────────────────────────────────────────────────────
  {
    skillCode: 'grammar-past-simple',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Yesterday, they ___ to the cinema.',
    options: ['go', 'went', 'gone', 'going'],
    correctOption: 'went',
    explanation: "'Went' is the irregular past tense of 'go'.",
    irtA: 1.1,
    irtB: -0.3,
    irtC: 0.25,
  },
  {
    skillCode: 'grammar-negation',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'She ___ like tea.',
    options: ["don't", "doesn't", 'not', 'no'],
    correctOption: "doesn't",
    explanation: "Third-person singular takes 'does not' or 'doesn't'.",
    irtA: 1.2,
    irtB: -0.1,
    irtC: 0.25,
  },
  {
    skillCode: 'vocabulary-directions',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Turn ___ at the traffic light.',
    options: ['left', 'straightly', 'under', 'along'],
    correctOption: 'left',
    explanation: "'Turn left' is the natural direction collocation.",
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
  },

  // ── B1 Items ──────────────────────────────────────────────────────────────
  {
    skillCode: 'grammar-present-perfect',
    cefrLevel: CefrLevel.B1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'How long ___ you lived in this city?',
    options: ['have', 'has', 'did', 'do'],
    correctOption: 'have',
    explanation: "Present perfect for duration with second-person pronoun 'you' uses 'have'.",
    irtA: 1.3,
    irtB: 0.5,
    irtC: 0.25,
  },
  {
    skillCode: 'grammar-conditionals',
    cefrLevel: CefrLevel.B1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'If it rains tomorrow, we ___ cancel the trip.',
    options: ['will', 'would', 'would have', 'are'],
    correctOption: 'will',
    explanation: 'First conditional (real future condition): If + present simple, will + base form.',
    irtA: 1.4,
    irtB: 0.8,
    irtC: 0.25,
  },
  {
    skillCode: 'vocabulary-workplace',
    cefrLevel: CefrLevel.B1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'The project was completed ahead of ___.',
    options: ['schedule', 'calendar', 'clock', 'appointment'],
    correctOption: 'schedule',
    explanation: "'Ahead of schedule' is an idiomatic business phrase meaning earlier than planned.",
    irtA: 1.2,
    irtB: 1.0,
    irtC: 0.25,
  },

  // ── B2 Items ──────────────────────────────────────────────────────────────
  {
    skillCode: 'grammar-passive-voice',
    cefrLevel: CefrLevel.B2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'The suspect is believed ___ the country last night.',
    options: ['to have left', 'to leave', 'leaving', 'having left'],
    correctOption: 'to have left',
    explanation: 'Perfect infinitive (to have + past participle) indicates an action prior to the reporting verb.',
    irtA: 1.5,
    irtB: 1.5,
    irtC: 0.25,
  },
  {
    skillCode: 'grammar-inversion',
    cefrLevel: CefrLevel.B2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Rarely ___ such a captivating performance.',
    options: ['have I seen', 'I have seen', 'I saw', 'did I saw'],
    correctOption: 'have I seen',
    explanation: 'Negative/restrictive adverbs at the beginning of a clause trigger subject-auxiliary inversion.',
    irtA: 1.6,
    irtB: 1.8,
    irtC: 0.25,
  },
  {
    skillCode: 'vocabulary-advanced-collocation',
    cefrLevel: CefrLevel.B2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'The government made a ___ commitment to reduce carbon emissions.',
    options: ['solemn', 'heavy', 'thick', 'grave'],
    correctOption: 'solemn',
    explanation: "'Solemn commitment' is an advanced formal collocation.",
    irtA: 1.4,
    irtB: 1.9,
    irtC: 0.25,
  },
];

async function seedPlacement(): Promise<void> {
  console.log('Seeding placement assessment items...');

  for (const item of SAMPLE_ITEMS) {
    await prisma.assessmentItem.create({
      data: item,
    });
  }

  const count = await prisma.assessmentItem.count();
  console.log(`Successfully seeded. Total assessment items in DB: ${count}`);
}

seedPlacement()
  .catch((e) => {
    console.error('Error seeding placement:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
