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
 * 1. Tìm ảnh qua Pixabay API (hỗ trợ ưu tiên ảnh thật với --photo hoặc hình minh họa mặc định)
 */
async function fetchFromPixabay(word: string, apiKey: string, preferPhoto: boolean): Promise<string | null> {
  const cleanWord = word.trim();
  const order: Array<'photo' | 'illustration' | 'vector' | 'all'> = preferPhoto
    ? ['photo', 'all']
    : ['illustration', 'vector', 'all'];
  for (const imageType of order) {
    try {
      const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(cleanWord)}&image_type=${imageType}&safesearch=true&order=popular&per_page=5`;
      const res = await axios.get<{ hits?: Array<{ webformatURL?: string; previewURL?: string }> }>(url, {
        timeout: 5000,
      });
      const hit = res.data?.hits?.[0];
      if (hit?.webformatURL || hit?.previewURL) {
        return hit.webformatURL || hit.previewURL || null;
      }
    } catch {
      // Fallback sang loại ảnh hoặc nguồn tiếp theo
    }
  }
  return null;
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
 * 3. Tìm ảnh qua Unsplash API (nếu có UNSPLASH_ACCESS_KEY trong .env)
 */
async function fetchFromUnsplash(word: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(word)}&per_page=1&content_filter=high`;
    const res = await axios.get<{ results?: Array<{ urls?: { regular?: string; small?: string } }> }>(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      timeout: 5000,
    });
    const photo = res.data?.results?.[0];
    return photo?.urls?.regular || photo?.urls?.small || null;
  } catch {
    return null;
  }
}

/**
 * 4. Tìm ảnh chụp qua Openverse API (Miễn phí, Không cần API Key)
 */
async function fetchFromOpenverse(word: string): Promise<string | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(word)}&category=photograph&page_size=3`;
    const res = await axios.get<{ results?: Array<{ url?: string; thumbnail?: string }> }>(url, {
      timeout: 6000,
      headers: { 'User-Agent': 'LingoRoad-VocabularyApp/1.0 (contact: support@lingoroad.com)' },
    });
    for (const item of res.data?.results ?? []) {
      const candidate = item.url || item.thumbnail;
      if (candidate && candidate.startsWith('https://') && !/\.(svg|gif)(\?|$)/i.test(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 5. Tìm ảnh qua Wikipedia PageImages API (100% Miễn phí, Không cần API Key)
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
 * 6. Tìm ảnh qua Wikimedia Commons Search (100% Miễn phí, Không cần API Key)
 */
async function fetchFromWikimediaCommons(word: string): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap ' + word)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json`;
    const res = await axios.get<{ query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }> } }>(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'LingoRoad-VocabularyApp/1.0 (contact: support@lingoroad.com)' },
    });
    const pages = res.data?.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    const info = pages[pageId]?.imageinfo?.[0];
    if (info?.mime && !info.mime.includes('jpeg') && !info.mime.includes('png') && !info.mime.includes('webp')) {
      return null;
    }
    return info?.thumburl || info?.url || null;
  } catch {
    return null;
  }
}

/**
 * Điều phối tìm ảnh theo thứ tự ưu tiên (Pexels/Unsplash/Pixabay -> Openverse -> Wikipedia -> Wikimedia)
 */
async function findImageForWord(word: string, preferPhoto = false): Promise<string | null> {
  if (preferPhoto) {
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      const img = await fetchFromPexels(word, pexelsKey);
      if (img) return img;
    }
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      const img = await fetchFromUnsplash(word, unsplashKey);
      if (img) return img;
    }
  }

  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    const img = await fetchFromPixabay(word, pixabayKey, preferPhoto);
    if (img) return img;
  }

  if (!preferPhoto) {
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      const img = await fetchFromPexels(word, pexelsKey);
      if (img) return img;
    }

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      const img = await fetchFromUnsplash(word, unsplashKey);
      if (img) return img;
    }
  }

  // Fallback miễn phí không cần API Key: Openverse ảnh chụp thật -> Wikipedia -> Wikimedia
  const openverseImg = await fetchFromOpenverse(word);
  if (openverseImg) return openverseImg;

  const wikiImg = await fetchFromWikipedia(word);
  if (wikiImg) return wikiImg;

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
  const preferPhoto = args.includes('--photo');
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

  if (preferPhoto) {
    console.log(`- Chế độ: Ưu tiên ẢNH CHỤP THẬT (--photo: Pexels / Unsplash / Pixabay Photo / Openverse)`);
  } else if (process.env.PIXABAY_API_KEY) {
    console.log(`- Nguồn ảnh ưu tiên 1: Pixabay API (Ưu tiên hình vẽ minh họa / Illustration & Vector Flashcard)`);
  } else if (process.env.PEXELS_API_KEY) {
    console.log(`- Nguồn ảnh ưu tiên 1: Pexels API (Đã có Key)`);
  } else if (process.env.UNSPLASH_ACCESS_KEY) {
    console.log(`- Nguồn ảnh ưu tiên 1: Unsplash API (Đã có Key)`);
  } else {
    console.log(`- Nguồn ảnh: Openverse Photograph / Wikipedia / Wikimedia Commons (Miễn phí 100%, không cần API Key)`);
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

          const imageUrl = await findImageForWord(wordText, preferPhoto);

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
