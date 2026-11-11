import { PrismaClient, SpeakingMode } from '@prisma/client';

export const readingTexts = [
  'I have lived here for five years', 'My name is Anna', 'I am a student from Hanoi',
  'I usually have breakfast at seven in the morning.',
  'My sister enjoys reading books and listening to music.',
  'Could you tell me how to get to the nearest bus stop?',
  'Last weekend, I visited my grandparents. We cooked dinner together and talked about our family.',
  'Learning a new language takes time and practice. I try to learn something new every day.',
  'Although the weather was cold, we decided to go for a walk. The streets were quiet, and the air felt fresh.',
];
export const topicReadingTexts = [
  'I like playing badminton after class.',
  'My favourite food is chicken noodle soup.',
  'I live near my university.',
];
export const topicContent = [
  ['Introduce yourself', 'What is your name?', 'Where do you live?', 'What do you enjoy doing?'],
  ['My day', 'When do you wake up?', 'What do you do during the day?', 'What is your favourite part of the day?'],
  ['My family', 'Who is in your family?', 'What do you like doing together?', 'Who are you closest to?'],
  ['My hobbies', 'What is your favourite hobby?', 'How often do you do it?', 'Why do you enjoy it?'],
  ['My favourite food', 'What food do you like?', 'How does it taste?', 'When do you usually eat it?'],
  ['Where I live', 'Where do you live?', 'What is interesting about your area?', 'What do you like about it?'],
];
export const twisters = [
  'Red lorry, yellow lorry.', 'She sees cheese.', 'Four fine fresh fish for you.',
  'A big black bug bit a big black bear.', 'Six slippery snails slid slowly seaward.',
  'Betty baked big batches of buttery biscuits before breakfast.',
  'She sells seashells by the seashore.', 'Fresh fried fish, fish fresh fried.',
  'Three free throws thrilled the thoughtful crowd.',
  'Peter Piper picked a peck of pickled peppers.',
  'Which wristwatches are Swiss wristwatches?',
  'The thirty-three thieves thought that they thrilled the throne throughout Thursday.',
];

export async function seedSpeakingContent(prisma: PrismaClient) {
  const groups = [
    { mode: SpeakingMode.READ_ALOUD, prefix: 'read-aloud', texts: readingTexts },
    { mode: SpeakingMode.READ_ALOUD, prefix: 'topic-read-aloud', texts: topicReadingTexts },
    { mode: SpeakingMode.TOPIC, prefix: 'topic', texts: topicContent.map(item => item[0]) },
    { mode: SpeakingMode.TONGUE_TWISTER, prefix: 'twister', texts: twisters },
  ];
  for (const group of groups) {
    for (const [index, text] of group.texts.entries()) {
      const metadata = { mode: group.mode, title: text, difficulty: Math.min(3, Math.floor(index / Math.ceil(group.texts.length / 3)) + 1),
        maxDurationSeconds: group.mode === SpeakingMode.TOPIC ? 60 : 30,
        hints: group.mode === SpeakingMode.TOPIC ? topicContent[index].slice(1) : [],
        sampleAsset: group.mode === SpeakingMode.TOPIC ? null : `${group.prefix}-${index + 1}`,
        sortOrder: index + 1 };
      await prisma.speakingPrompt.upsert({ where: { code: `${group.prefix}-${index + 1}` },
        update: metadata, create: { code: `${group.prefix}-${index + 1}`, text, ...metadata } });
    }
  }
}
if (require.main === module) {
  const prisma = new PrismaClient();
  seedSpeakingContent(prisma).catch(() => { console.error('Speaking seed failed'); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
