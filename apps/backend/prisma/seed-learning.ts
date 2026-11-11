import 'dotenv/config';
import { LearningKind, Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent, LearningQuestion, validateLearningContent } from '../src/modules/learning/learning.types';

export interface LearningSeed {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  contentVersion: number;
  content: LearningContent;
}

const transcript = 'Hello! My name is Anna. I am twenty years old. I am from Hanoi. I am a student. I like reading books with my friends.';
const question = (id: string, prompt: string, options: string[], correctIndex: number, explanation: string): LearningQuestion => ({
  id, prompt, options: options.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
  correctOptionId: String.fromCharCode(65 + correctIndex), explanation,
});

export function loadLearningContent(): LearningSeed[] {
  const comprehension = (prefix: string) => [
    question(`${prefix}-1`, 'What is the speaker’s name?', ['Anna', 'Mai', 'Lan', 'Jane'], 0, 'Người nói tự giới thiệu: “My name is Anna.”'),
    question(`${prefix}-2`, 'Where is Anna from?', ['London', 'Hanoi', 'Paris', 'Tokyo'], 1, 'Anna nói “I am from Hanoi”, nên cô ấy đến từ Hà Nội.'),
    question(`${prefix}-3`, 'What does Anna do?', ['A doctor', 'A teacher', 'A student', 'A nurse'], 2, '“I am a student” có nghĩa là Anna là sinh viên.'),
    question(`${prefix}-4`, 'What does Anna like?', ['Running', 'Cooking', 'Dancing', 'Reading'], 3, 'Anna nói cô ấy thích đọc sách cùng bạn bè: “I like reading books with my friends.”'),
    question(`${prefix}-5`, 'How old is Anna?', ['Twenty', 'Twelve', 'Thirty', 'Eighteen'], 0, '“I am twenty years old” nghĩa là Anna hai mươi tuổi.'),
  ];
  const words = [
    ['mother', '/ˈmʌðə(r)/', 'mẹ', 'My mother is a teacher.', 'Mẹ tôi là giáo viên.'],
    ['father', '/ˈfɑːðə(r)/', 'bố', 'My father is a doctor.', 'Bố tôi là bác sĩ.'],
    ['sister', '/ˈsɪstə(r)/', 'chị/em gái', 'My sister is a student.', 'Chị tôi là sinh viên.'],
    ['brother', '/ˈbrʌðə(r)/', 'anh/em trai', 'My brother likes football.', 'Anh tôi thích bóng đá.'],
    ['grandmother', '/ˈɡrænmʌðə(r)/', 'bà', 'My grandmother is kind.', 'Bà tôi rất tốt bụng.'],
    ['grandfather', '/ˈɡrænfɑːðə(r)/', 'ông', 'My grandfather likes reading.', 'Ông tôi thích đọc sách.'],
    ['parents', '/ˈpeərənts/', 'bố mẹ', 'My parents live in Hanoi.', 'Bố mẹ tôi sống ở Hà Nội.'],
    ['family', '/ˈfæməli/', 'gia đình', 'I love my family.', 'Tôi yêu gia đình mình.'],
    ['daughter', '/ˈdɔːtə(r)/', 'con gái', 'Their daughter is five.', 'Con gái của họ năm tuổi.'],
    ['son', '/sʌn/', 'con trai', 'Their son is a student.', 'Con trai của họ là sinh viên.'],
  ];
  return [
    { code: 'grammar-pronouns-to-be', kind: 'GRAMMAR', title: 'Subject pronouns and “to be”', description: 'Đại từ nhân xưng, câu khẳng định, phủ định và câu hỏi với to be.', estimatedMinutes: 10, sortOrder: 1, contentVersion: 1,
      content: { steps: [{ id: 'grammar-theory', title: 'Đại từ nhân xưng và động từ to be',
        body: 'I → am; He / She / It → is; You / We / They → are.\n\nKhẳng định: Chủ ngữ + am / is / are.\nI am a student. She is a teacher. They are friends.\n\nPhủ định: Chủ ngữ + am / is / are + not.\nWe are not tired. He is not a doctor.\n\nCâu hỏi: Am / Is / Are + chủ ngữ …?\nIs she a teacher? Are you from Hanoi?\n\nTên một người như Lan dùng “is”.' }], questions: [
        question('grammar-1', 'I … a student.', ['am', 'is', 'are', 'be'], 0, 'Chủ ngữ “I” đi với “am”: I am a student.'),
        question('grammar-2', 'Lan … from Hanoi.', ['am', 'is', 'are', 'be'], 1, 'Lan là tên một người, tương đương “she”, nên dùng “is”.'),
        question('grammar-3', 'They … my friends.', ['am', 'is', 'are', 'be'], 2, 'Chủ ngữ số nhiều “They” đi với “are”.'),
        question('grammar-4', '… she a teacher?', ['Am', 'Are', 'Be', 'Is'], 3, 'Đảo “Is” lên trước “she” để tạo câu hỏi: Is she a teacher?'),
        question('grammar-5', 'We … not tired.', ['are', 'is', 'am', 'be'], 0, '“We” đi với “are”; câu phủ định là “We are not tired”.'),
      ] } },
    { code: 'vocabulary-family', kind: 'VOCABULARY', title: 'Family and relationships', description: 'Học 10 từ về gia đình qua phát âm và ví dụ, sau đó luyện tập.', estimatedMinutes: 10, sortOrder: 2, contentVersion: 1,
      content: { steps: words.map(([word, phonetic, meaning, example, body]) => ({ id: `word-${word}`, title: word, word, phonetic, meaning, example, body, audioUrl: `/media/learning/v1/${word}.wav` })), questions: [
        question('vocabulary-1', 'My father and mother are my …', ['parents', 'sisters', 'brothers', 'sons'], 0, '“Parents” nghĩa là bố mẹ, gồm father và mother.'),
        question('vocabulary-2', 'My mother’s mother is my …', ['sister', 'grandmother', 'daughter', 'brother'], 1, 'Mẹ của mẹ là bà ngoại: “grandmother”.'),
        question('vocabulary-3', 'A daughter is a …', ['boy', 'father', 'girl', 'grandfather'], 2, '“Daughter” là con gái, vì vậy đáp án là “girl”.'),
        question('vocabulary-4', 'My parents have two children: me and a boy. The boy is my …', ['mother', 'sister', 'grandmother', 'brother'], 3, 'Cậu bé là người con trai còn lại của bố mẹ, tức anh/em trai: “brother”.'),
        question('vocabulary-5', 'A son is a …', ['boy', 'girl', 'mother', 'grandmother'], 0, '“Son” nghĩa là con trai, nên chọn “boy”.'),
      ] } },
    { code: 'reading-everyday-introductions', kind: 'READING', title: 'Everyday Introductions', description: 'Đọc đoạn tự giới thiệu và xác định thông tin tên, tuổi, quê quán và sở thích.', estimatedMinutes: 5, sortOrder: 3, contentVersion: 1,
      content: { steps: [], passage: transcript, questions: comprehension('reading') } },
    { code: 'listening-greetings-introductions', kind: 'LISTENING', title: 'Greetings and Introductions', description: 'Nghe Anna tự giới thiệu. Được nghe lại và tua không giới hạn.', estimatedMinutes: 5, sortOrder: 4, contentVersion: 1,
      content: { steps: [], audioUrl: '/media/learning/v1/listening.wav', transcript, questions: comprehension('listening') } },
  ];
}

export function validateLearningSeeds(seeds = loadLearningContent()): void {
  if (seeds.length !== 4 || new Set(seeds.map((seed) => seed.code)).size !== 4 || new Set(seeds.map((seed) => seed.kind)).size !== 4) throw new Error('Expected four distinct lesson kinds.');
  for (const seed of seeds) {
    validateLearningContent(seed.content);
    if (!seed.title.trim() || !seed.description.trim() || seed.contentVersion < 1 || seed.estimatedMinutes < 1) throw new Error('Invalid lesson metadata.');
    if (seed.kind === 'LISTENING' && (!seed.content.audioUrl || !seed.content.transcript)) throw new Error('Listening audio and transcript are required.');
    if (seed.kind === 'READING' && !seed.content.passage) throw new Error('Reading passage is required.');
    const urls = [seed.content.audioUrl, ...seed.content.steps.map((step) => step.audioUrl)].filter((url): url is string => !!url);
    for (const url of urls) {
      if (!/^\/media\/learning\/v1\/[a-z]+\.wav$/.test(url)) throw new Error('Invalid curriculum audio path.');
      const file = join(__dirname, '..', url.replace(/^\/media\//, 'media/'));
      if (!existsSync(file) || readFileSync(file).toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Missing or invalid learning audio: ${url}`);
    }
  }
}

export async function seedLearningContent(prisma: PrismaClient): Promise<number> {
  const seeds = loadLearningContent();
  validateLearningSeeds(seeds);
  await prisma.$transaction(seeds.map((seed) => {
    const data = { ...seed, published: true, content: seed.content as unknown as Prisma.InputJsonValue };
    return prisma.learningLesson.upsert({ where: { code: seed.code }, create: data, update: data });
  }));
  return seeds.length;
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate')) { validateLearningSeeds(); console.log('Validated 4 lessons, 20 questions and 11 curriculum audio files.'); return; }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^lingoroad_(demo|test|[a-z0-9_]+_test)$/.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error('Seed CLI requires an isolated lingoroad_demo or lingoroad_*test database.');
  }
  const prisma = new PrismaClient();
  try { console.log(`Seeded ${await seedLearningContent(prisma)} learning lessons (upsert by stable code).`); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Learning seed failed.'); process.exitCode = 1; });
