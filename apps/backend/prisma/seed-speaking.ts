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

export const topicImages = [
  '/media/learning/v1/images/topic-introduce-yourself.jpg',
  '/media/learning/v1/images/topic-my-day.jpg',
  '/media/learning/v1/images/topic-my-family.jpg',
  '/media/learning/v1/images/topic-my-hobbies.jpg',
  '/media/learning/v1/images/topic-favourite-food.jpg',
  '/media/learning/v1/images/topic-where-i-live.jpg',
];

export const pictureDescriptions = [
  {
    code: 'picture-1',
    title: 'At a busy campus café',
    text: 'Describe the people, food and atmosphere in this campus café picture.',
    difficulty: 1,
    hints: [
      'What is the barista doing with the coffee machine?',
      'What clothes and equipment can you see?',
      'What kind of drink is being prepared?',
    ],
    imageUrl: '/media/learning/v1/images/picture-campus-cafe.jpg',
    visualContext: 'A close-up café counter scene: a barista wearing a light blue shirt and black apron uses a tamper to press coffee grounds into a portafilter next to a stainless-steel espresso machine with glowing orange switches.',
  },
  {
    code: 'picture-2',
    title: 'Sunny weekend in the park',
    text: 'Describe the activities and surroundings in this weekend park picture.',
    difficulty: 1,
    hints: [
      'Who is sitting on the blanket and how do they look?',
      'What fruit are the children sharing?',
      'How does the weather and grass look in the background?',
    ],
    imageUrl: '/media/learning/v1/images/picture-weekend-park.jpg',
    visualContext: 'A bright sunny park picnic: a boy and two young girls sit closely together on a white blanket over green grass, smiling happily and sharing fresh red strawberries.',
  },
  {
    code: 'picture-3',
    title: 'Cooking dinner at home',
    text: 'Describe the family members and what they are preparing in the kitchen.',
    difficulty: 2,
    hints: [
      'Who is in the kitchen and what are they doing together?',
      'What vegetables, drinks or kitchen items can you see on the counter?',
      'How do the mother and children feel?',
    ],
    imageUrl: '/media/learning/v1/images/picture-family-kitchen.jpg',
    visualContext: 'A bright modern family kitchen: a smiling mother stands at the counter with bell peppers, an eggplant on a cutting board, a glass bowl, and a pitcher of orange juice while handing a slice of green pepper to her young son sitting on the counter beside another child.',
  },
  {
    code: 'picture-4',
    title: 'Group study at the library',
    text: 'Describe the students, objects on the table and setting in this library.',
    difficulty: 2,
    hints: [
      'Who are the two main students and what are they looking at?',
      'What can you see on the shelves and in the background?',
      'Why does this library look good for studying?',
    ],
    imageUrl: '/media/learning/v1/images/picture-study-library.jpg',
    visualContext: 'A bright spacious university library: a bearded young man in a light shirt and a young woman wearing glasses stand together browsing a row of colourful hardcover books, with more bookshelves and students studying in the background.',
  },
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
        imageUrl: group.mode === SpeakingMode.TOPIC ? topicImages[index] ?? null : null,
        visualContext: null,
        ...(group.mode === SpeakingMode.TOPIC ? { contentVersion: 2 } : {}),
        sortOrder: index + 1 };
      await prisma.speakingPrompt.upsert({ where: { code: `${group.prefix}-${index + 1}` },
        update: metadata, create: { code: `${group.prefix}-${index + 1}`, text, ...metadata } });
    }
  }
  for (const [index, item] of pictureDescriptions.entries()) {
    const metadata = {
      mode: SpeakingMode.PICTURE_DESCRIPTION,
      title: item.title,
      difficulty: item.difficulty,
      maxDurationSeconds: 60,
      hints: item.hints,
      sampleAsset: null,
      imageUrl: item.imageUrl,
      visualContext: item.visualContext,
      contentVersion: 2,
      sortOrder: index + 1,
    };
    await prisma.speakingPrompt.upsert({
      where: { code: item.code },
      update: metadata,
      create: { code: item.code, text: item.text, ...metadata },
    });
  }
}
if (require.main === module) {
  const prisma = new PrismaClient();
  seedSpeakingContent(prisma).catch(() => { console.error('Speaking seed failed'); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
