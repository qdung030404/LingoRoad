import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Tiện ích delay giữa các request để bảo đảm an toàn rate-limit
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1. Tìm ảnh qua Pixabay API (Ưu tiên hình vẽ minh họa / đồ họa vector phong cách flashcard)
 */
async function fetchFromPixabay(word: string, apiKey: string): Promise<string | null> {
  const cleanWord = word.trim();
  try {
    // Bước 1: Ưu tiên số 1 - Hình vẽ minh họa (illustration) phong cách giáo dục, biểu tượng trực quan
    const illustrationUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(cleanWord)}&image_type=illustration&safesearch=true&order=popular&per_page=5`;
    const resIllu = await axios.get<{ hits?: Array<{ webformatURL?: string; previewURL?: string }> }>(illustrationUrl, {
      timeout: 5000,
    });
    const illuHit = resIllu.data?.hits?.[0];
    if (illuHit?.webformatURL || illuHit?.previewURL) {
      return illuHit.webformatURL || illuHit.previewURL || null;
    }

    // Bước 2: Ưu tiên số 2 - Đồ họa vector (vector)
    const vectorUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(cleanWord)}&image_type=vector&safesearch=true&order=popular&per_page=5`;
    const resVec = await axios.get<{ hits?: Array<{ webformatURL?: string; previewURL?: string }> }>(vectorUrl, {
      timeout: 5000,
    });
    const vecHit = resVec.data?.hits?.[0];
    if (vecHit?.webformatURL || vecHit?.previewURL) {
      return vecHit.webformatURL || vecHit.previewURL || null;
    }

    // Bước 3: Fallback - Tìm ảnh chung (all) nếu từ khóa hiếm không có hình vẽ minh họa
    const allUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(cleanWord)}&image_type=all&safesearch=true&order=popular&per_page=3`;
    const resAll = await axios.get<{ hits?: Array<{ webformatURL?: string; previewURL?: string }> }>(allUrl, {
      timeout: 5000,
    });
    const allHit = resAll.data?.hits?.[0];
    return allHit?.webformatURL || allHit?.previewURL || null;
  } catch {
    return null;
  }
}

/**
 * 2. Tìm ảnh qua Pexels API (nếu có PEXELS_API_KEY trong .env)
 */
async function fetchFromPexels(word: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(word)}&per_page=1`;
    const res = await axios.get<{ photos?: Array<{ src?: { medium?: string; small?: string } }> }>(url, {
      headers: { Authorization: apiKey },
      timeout: 5000,
    });
    const photo = res.data?.photos?.[0];
    return photo?.src?.medium || photo?.src?.small || null;
  } catch {
    return null;
  }
}

/**
 * 3. Tìm ảnh qua Wikipedia PageImages API (100% Miễn phí, Không cần API Key)
 */
async function fetchFromWikipedia(word: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=600&titles=${encodeURIComponent(word)}`;
    const res = await axios.get<{ query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } }>(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'LingoRoad-VocabularyApp/1.0 (contact: support@lingoroad.com)' },
    });
    const pages = res.data?.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return null;
    return pages[pageId]?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

/**
 * 4. Tìm ảnh qua Wikimedia Commons Search (100% Miễn phí, Không cần API Key)
 */
async function fetchFromWikimediaCommons(word: string): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(word)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`;
    const res = await axios.get<{ query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> } }>(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'LingoRoad-VocabularyApp/1.0 (contact: support@lingoroad.com)' },
    });
    const pages = res.data?.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    const info = pages[pageId]?.imageinfo?.[0];
    return info?.thumburl || info?.url || null;
  } catch {
    return null;
  }
}

/**
 * Điều phối tìm ảnh theo thứ tự ưu tiên (Pixabay -> Pexels -> Wikipedia -> Wikimedia)
 */
async function findImageForWord(word: string): Promise<string | null> {
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    const img = await fetchFromPixabay(word, pixabayKey);
    if (img) return img;
  }

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    const img = await fetchFromPexels(word, pexelsKey);
    if (img) return img;
  }

  // Fallback miễn phí không cần API Key: Wikipedia
  const wikiImg = await fetchFromWikipedia(word);
  if (wikiImg) return wikiImg;

  // Fallback: Wikimedia Commons
  const commonsImg = await fetchFromWikimediaCommons(word);
  if (commonsImg) return commonsImg;

  return null;
}

/**
 * Runner chính
 */
async function main() {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--force') || args.includes('--all');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const topicArg = args.find((a) => a.startsWith('--topic='));
  const filterTopic = topicArg ? topicArg.split('=')[1].trim().toLowerCase() : undefined;

  console.log(`\n======================================================`);
  console.log(`🖼️  BẮT ĐẦU SCRIPT BỔ SUNG HÌNH ẢNH CHO BẢNG TOPIC_WORDS`);
  console.log(`======================================================`);
  console.log(`- Ghi đè ảnh cũ (--force): ${forceAll ? 'CÓ' : 'KHÔNG (chỉ bổ sung từ chưa có ảnh)'}`);
  if (filterTopic) console.log(`- Lọc chủ đề: ${filterTopic}`);
  if (limit) console.log(`- Giới hạn số từ: ${limit}`);

  if (process.env.PIXABAY_API_KEY) {
    console.log(`- Nguồn ảnh ưu tiên 1: Pixabay API (Ưu tiên hình vẽ minh họa / Illustration & Vector Flashcard)`);
  } else if (process.env.PEXELS_API_KEY) {
    console.log(`- Nguồn ảnh ưu tiên 1: Pexels API (Đã có Key)`);
  } else {
    console.log(`- Nguồn ảnh: Wikipedia / Wikimedia Commons (Miễn phí 100%, không cần API Key)`);
  }

  const prisma = new PrismaClient();

  try {
    // 1. Lấy danh sách từ từ bảng topic_words sử dụng Prisma Client chuẩn hóa
    const clientRows = await prisma.curatedTopicWord.findMany({
      where: filterTopic ? { topic: { slug: filterTopic } } : undefined,
      include: { topic: true },
      orderBy: { word: 'asc' },
    });

    const wordsInDb = clientRows.map((r) => ({
      id: r.id,
      word: r.word,
      imageUrl: r.imageUrl,
      topicTitle: r.topic?.titleVi || 'Chủ đề',
    }));

    console.log(`\n[Database] Tổng số từ tìm thấy: ${wordsInDb.length}`);

    const wordsToProcess = wordsInDb.filter((w) => forceAll || !w.imageUrl);
    const targetList = limit ? wordsToProcess.slice(0, limit) : wordsToProcess;

    console.log(`[Cần xử lý] ${targetList.length} từ cần cập nhật hình ảnh.\n`);

    let successCount = 0;
    let failedCount = 0;
    const updatedMap = new Map<string, string>(); // word -> imageUrl

    // Tối ưu hiệu năng (M7): Xử lý song song theo lô 4 từ để tăng tốc 4x mà không nghẽn mạng
    const BATCH_SIZE = 4;
    for (let i = 0; i < targetList.length; i += BATCH_SIZE) {
      const batch = targetList.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (w, batchIdx) => {
          const idx = i + batchIdx + 1;
          const wordText = w.word.trim();
          const topicTitle = w.topicTitle;

          const imageUrl = await findImageForWord(wordText);

          if (imageUrl) {
            await prisma.curatedTopicWord.update({
              where: { id: w.id },
              data: { imageUrl },
            });
            updatedMap.set(wordText.toLowerCase(), imageUrl);
            successCount++;
            console.log(`[${idx}/${targetList.length}] ✓ Đã lưu ảnh cho "${wordText}" (${topicTitle})`);
          } else {
            failedCount++;
            console.log(`[${idx}/${targetList.length}] ✗ Không tìm thấy ảnh cho "${wordText}" (${topicTitle})`);
          }
        }),
      );

      // Giãn cách 200ms giữa các đợt lô để tránh rate-limit
      if (i + BATCH_SIZE < targetList.length) {
        await sleep(200);
      }
    }

    // 2. Đồng bộ ngược lại file JSON demo-content/topic-vocabulary.json (nếu có)
    const jsonPath = path.resolve(__dirname, 'demo-content', 'topic-vocabulary.json');
    if (fs.existsSync(jsonPath) && updatedMap.size > 0) {
      console.log(`\n[Đồng bộ JSON] Đang cập nhật hình ảnh vào: ${jsonPath}...`);
      try {
        const rawJson = fs.readFileSync(jsonPath, 'utf-8');
        const jsonTopics: any[] = JSON.parse(rawJson);
        let jsonUpdatedCount = 0;

        for (const t of jsonTopics) {
          if (Array.isArray(t.words)) {
            for (const item of t.words) {
              const matchedUrl = updatedMap.get(item.word?.trim().toLowerCase());
              if (matchedUrl) {
                item.imageUrl = matchedUrl;
                jsonUpdatedCount++;
              }
            }
          }
        }

        fs.writeFileSync(jsonPath, JSON.stringify(jsonTopics, null, 2), 'utf-8');
        console.log(`✓ Đã đồng bộ ${jsonUpdatedCount} ảnh vào file JSON!`);
      } catch (err) {
        console.warn(`[Cảnh báo] Không thể cập nhật file JSON:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`\n======================================================`);
    console.log(`🎉 HOÀN TẤT TIẾN TRÌNH:`);
    console.log(`- Thành công: ${successCount} từ`);
    console.log(`- Bỏ qua / Thất bại: ${failedCount} từ`);
    console.log(`======================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi khi thực thi script:', err);
    process.exit(1);
  });
}
