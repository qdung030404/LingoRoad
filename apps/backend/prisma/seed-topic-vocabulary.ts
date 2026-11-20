import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

export interface TopicDefinition {
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string;
  icon: string;
  displayOrder: number;
}

export const MASTER_TOPICS: TopicDefinition[] = [
  {
    slug: 'travel',
    titleEn: 'Travel & Tourism',
    titleVi: 'Du lịch & Lữ hành',
    description: 'Từ vựng thông dụng khi đi du lịch, đặt vé, sân bay và khách sạn.',
    icon: 'airplane',
    displayOrder: 1,
  },
  {
    slug: 'technology',
    titleEn: 'Technology & Computing',
    titleVi: 'Công nghệ & Máy tính',
    description: 'Từ vựng về phần mềm, phần cứng, Internet và công nghệ số.',
    icon: 'laptop',
    displayOrder: 2,
  },
  {
    slug: 'business',
    titleEn: 'Business & Finance',
    titleVi: 'Kinh doanh & Tài chính',
    description: 'Từ vựng về đàm phán, thương mại, tài chính doanh nghiệp.',
    icon: 'briefcase',
    displayOrder: 3,
  },
  {
    slug: 'food',
    titleEn: 'Food & Dining',
    titleVi: 'Ẩm thực & Ăn uống',
    description: 'Từ vựng về món ăn, nguyên liệu, nấu nướng và nhà hàng.',
    icon: 'utensils',
    displayOrder: 4,
  },
  {
    slug: 'health',
    titleEn: 'Health & Medicine',
    titleVi: 'Sức khỏe & Y tế',
    description: 'Từ vựng về bệnh viện, triệu chứng, thuốc men và lối sống lành mạnh.',
    icon: 'heart-pulse',
    displayOrder: 5,
  },
  {
    slug: 'education',
    titleEn: 'Education & School',
    titleVi: 'Giáo dục & Học tập',
    description: 'Từ vựng về trường học, thi cử, bằng cấp và nghiên cứu.',
    icon: 'graduation-cap',
    displayOrder: 6,
  },
  {
    slug: 'environment',
    titleEn: 'Environment & Nature',
    titleVi: 'Môi trường & Tự nhiên',
    description: 'Từ vựng về khí hậu, động thực vật, năng lượng tái tạo.',
    icon: 'leaf',
    displayOrder: 7,
  },
  {
    slug: 'sports',
    titleEn: 'Sports & Fitness',
    titleVi: 'Thể thao & Thể hình',
    description: 'Từ vựng về các môn thể thao, tập luyện và thi đấu.',
    icon: 'dumbbell',
    displayOrder: 8,
  },
  {
    slug: 'entertainment',
    titleEn: 'Arts & Entertainment',
    titleVi: 'Nghệ thuật & Giải trí',
    description: 'Từ vựng về điện ảnh, âm nhạc, hội họa và biểu diễn.',
    icon: 'film',
    displayOrder: 9,
  },
  {
    slug: 'shopping',
    titleEn: 'Shopping & Fashion',
    titleVi: 'Mua sắm & Thời trang',
    description: 'Từ vựng về hàng hóa, thanh toán, trang phục và xu hướng.',
    icon: 'shopping-bag',
    displayOrder: 10,
  },
  {
    slug: 'transportation',
    titleEn: 'Transportation & Traffic',
    titleVi: 'Giao thông & Phương tiện',
    description: 'Từ vựng về xe cộ, luật giao thông, đường bộ và đường sắt.',
    icon: 'car',
    displayOrder: 11,
  },
  {
    slug: 'work',
    titleEn: 'Jobs & Career',
    titleVi: 'Công việc & Sự nghiệp',
    description: 'Từ vựng về tuyển dụng, nơi làm việc, kỹ năng và thăng tiến.',
    icon: 'user-tie',
    displayOrder: 12,
  },
];

interface DatamuseItem {
  word: string;
  score: number;
  tags?: string[];
}

interface MinhqndMeaning {
  definition: string;
  definition_lang: string;
  pos?: string;
  example?: string | null;
}

interface MinhqndPronunciation {
  ipa?: string;
  region?: string | null;
}

interface MinhqndResponse {
  exists: boolean;
  word: string;
  results?: Array<{
    lang_code: string;
    lang_name: string;
    audio?: string;
    meanings: MinhqndMeaning[];
    pronunciations?: MinhqndPronunciation[];
  }>;
}

export interface EnrichedWord {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  audioUrl: string;
  frequency: number;
}

export interface TopicVocabularyResult {
  topic: TopicDefinition;
  words: EnrichedWord[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1. Lấy danh sách từ liên quan từ Datamuse theo chủ đề
 */
export async function fetchCandidatesFromDatamuse(topicSlug: string, maxWords = 60): Promise<string[]> {
  try {
    const [mlRes, relRes] = await Promise.all([
      axios.get<DatamuseItem[]>(`https://api.datamuse.com/words?ml=${encodeURIComponent(topicSlug)}&topics=${encodeURIComponent(topicSlug)}&md=f&max=${maxWords}`, { timeout: 8000 }).catch(() => ({ data: [] })),
      axios.get<DatamuseItem[]>(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(topicSlug)}&max=${maxWords}`, { timeout: 8000 }).catch(() => ({ data: [] })),
    ]);

    const combined = [...mlRes.data, ...relRes.data];
    const uniqueMap = new Map<string, number>();

    for (const item of combined) {
      const w = item.word.toLowerCase().trim();
      // Chỉ lấy từ đơn bằng chữ cái tiếng Anh, độ dài 3-20 ký tự
      if (/^[a-z]{3,20}$/.test(w)) {
        const currentScore = uniqueMap.get(w) ?? 0;
        if (item.score > currentScore) {
          uniqueMap.set(w, item.score);
        }
      }
    }

    // Sắp xếp theo score giảm dần
    return Array.from(uniqueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Datamuse] Lỗi tìm từ cho chủ đề "${topicSlug}": ${errorMsg}`);
    return [];
  }
}

/**
 * 2. Làm giàu từ vựng với nghĩa tiếng Việt, phiên âm và phát âm từ dict.minhqnd.com
 */
export async function enrichWordWithMinhqnd(word: string): Promise<EnrichedWord | null> {
  try {
    const url = `https://dict.minhqnd.com/api/v1/lookup?word=${encodeURIComponent(word)}&lang=en&def_lang=vi`;
    const res = await axios.get<MinhqndResponse>(url, { timeout: 6000 });

    if (!res.data || !res.data.exists || !res.data.results || res.data.results.length === 0) {
      return null;
    }

    const firstResult = res.data.results[0];
    const viMeanings = firstResult.meanings?.filter((m) => m.definition_lang === 'vi' || !m.definition_lang) ?? [];
    if (viMeanings.length === 0) return null;

    const topMeaning = viMeanings[0];
    const ipa = firstResult.pronunciations?.[0]?.ipa ?? '';

    return {
      word,
      phonetic: ipa,
      partOfSpeech: topMeaning.pos || 'Từ vựng',
      meaningVi: topMeaning.definition.replace(/\n+/g, ' ').trim(),
      exampleEn: topMeaning.example?.trim() || '',
      exampleVi: '',
      audioUrl: `https://dict.minhqnd.com/api/v1/tts?word=${encodeURIComponent(word)}&lang=en`,
      frequency: 1.0,
    };
  } catch {
    return null;
  }
}

/**
 * 3. Xử lý toàn bộ cho một chủ đề
 */
export async function generateTopicVocabulary(
  topic: TopicDefinition,
  targetCount = 20,
): Promise<TopicVocabularyResult> {
  console.log(`\n========================================`);
  console.log(`[ETL] Bắt đầu chủ đề: ${topic.titleEn} (${topic.titleVi})`);
  console.log(`========================================`);

  const candidates = await fetchCandidatesFromDatamuse(topic.slug, targetCount * 3);
  console.log(`[Datamuse] Tìm thấy ${candidates.length} từ ứng viên.`);

  const enrichedWords: EnrichedWord[] = [];

  for (const candidate of candidates) {
    if (enrichedWords.length >= targetCount) break;

    const enriched = await enrichWordWithMinhqnd(candidate);
    if (enriched && enriched.meaningVi) {
      enrichedWords.push(enriched);
      console.log(`  ✓ [${enrichedWords.length}/${targetCount}] ${enriched.word} (${enriched.partOfSpeech}): ${enriched.meaningVi}`);
    }

    // Delay 100ms bảo đảm tính lịch sự với server
    await sleep(100);
  }

  console.log(`[Hoàn tất] Chủ đề "${topic.titleEn}": Thu thập thành công ${enrichedWords.length} từ.`);
  return { topic, words: enrichedWords };
}

/**
 * 4. Lưu vào Database (PostgreSQL via Prisma)
 */
export async function seedTopicToDatabase(prisma: PrismaClient, result: TopicVocabularyResult): Promise<void> {
  const { topic, words } = result;

  const savedTopic = await prisma.curatedTopic.upsert({
    where: { slug: topic.slug },
    update: {
      titleEn: topic.titleEn,
      titleVi: topic.titleVi,
      description: topic.description,
      icon: topic.icon,
      displayOrder: topic.displayOrder,
    },
    create: {
      slug: topic.slug,
      titleEn: topic.titleEn,
      titleVi: topic.titleVi,
      description: topic.description,
      icon: topic.icon,
      displayOrder: topic.displayOrder,
    },
  });

  for (const w of words) {
    const existing = await prisma.curatedTopicWord.findFirst({
      where: { topicId: savedTopic.id, word: w.word },
    });

    if (existing) {
      await prisma.curatedTopicWord.update({
        where: { id: existing.id },
        data: {
          phonetic: w.phonetic,
          partOfSpeech: w.partOfSpeech,
          meaningVi: w.meaningVi,
          exampleEn: w.exampleEn,
          audioUrl: w.audioUrl,
          imageUrl: (w as any).imageUrl ?? (existing as any).imageUrl ?? null,
        } as any,
      });
    } else {
      await prisma.curatedTopicWord.create({
        data: {
          topicId: savedTopic.id,
          word: w.word,
          phonetic: w.phonetic,
          partOfSpeech: w.partOfSpeech,
          meaningVi: w.meaningVi,
          exampleEn: w.exampleEn,
          audioUrl: w.audioUrl,
          imageUrl: (w as any).imageUrl ?? null,
        } as any,
      });
    }
  }

  console.log(`[DB] Đã lưu chủ đề "${topic.titleVi}" (${words.length} từ) vào Database.`);
}

/**
 * CLI Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const wordsPerTopicArg = args.find((a) => a.startsWith('--words='));
  const targetWords = wordsPerTopicArg ? parseInt(wordsPerTopicArg.split('=')[1], 10) : 10;
  const topicsFilterArg = args.find((a) => a.startsWith('--topics='));
  const filteredSlugs = topicsFilterArg ? topicsFilterArg.split('=')[1].split(',') : null;
  const saveJson = args.includes('--save-json') || !args.includes('--no-json');
  const seedDb = args.includes('--seed-db');

  const topicsToRun = filteredSlugs
    ? MASTER_TOPICS.filter((t) => filteredSlugs.includes(t.slug))
    : MASTER_TOPICS;

  console.log(`Bắt đầu chạy ETL Pipeline:`);
  console.log(`- Số lượng chủ đề: ${topicsToRun.length}`);
  console.log(`- Số từ mỗi chủ đề: ${targetWords}`);
  console.log(`- Lưu JSON: ${saveJson}`);
  console.log(`- Seed vào DB: ${seedDb}`);

  const allResults: TopicVocabularyResult[] = [];
  const prisma = seedDb ? new PrismaClient() : null;

  try {
    for (const topic of topicsToRun) {
      const result = await generateTopicVocabulary(topic, targetWords);
      allResults.push(result);

      if (prisma) {
        await seedTopicToDatabase(prisma, result);
      }
    }

    if (saveJson) {
      const outputDir = path.resolve(__dirname, 'demo-content');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(outputDir, 'topic-vocabulary.json');
      fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf-8');
      console.log(`\n[Export] Đã xuất file JSON thành công: ${outputPath}`);
    }

    console.log(`\n🎉 Pipeline hoàn tất thành công cho ${allResults.length} chủ đề!`);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi thực thi:', err);
    process.exit(1);
  });
}
