import 'dotenv/config';
import axios from 'axios';
import { Prisma, PrismaClient, SpeakingMode } from '@prisma/client';
import { isSafeImageUrl, LearningContent, validateLearningContent } from '../src/modules/learning/learning.types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const REQUEST_HEADERS = { 'User-Agent': 'LingoRoad-LessonMedia/2.0 (https://lingoroad.local)' };
const NON_PHOTO_EXT = /\.(svg|gif|pdf|tif|tiff|xcf|djvu|ogg|webm)(\?|$)/i;

function usablePhotoUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://') || NON_PHOTO_EXT.test(trimmed)) return null;
  return trimmed.length <= 500 && isSafeImageUrl(trimmed) ? trimmed : null;
}

async function fetchFromPexels(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`;
    const res = await axios.get<{ photos?: Array<{ src?: { large?: string; medium?: string } }> }>(url, {
      headers: { Authorization: apiKey },
      timeout: 6000,
    });
    for (const photo of res.data?.photos ?? []) {
      const candidate = usablePhotoUrl(photo.src?.large || photo.src?.medium);
      if (candidate) return candidate;
    }
  } catch {
    // Fallback to next photo provider.
  }
  return null;
}

async function fetchFromUnsplash(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&content_filter=high`;
    const res = await axios.get<{ results?: Array<{ urls?: { regular?: string; small?: string } }> }>(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      timeout: 6000,
    });
    for (const item of res.data?.results ?? []) {
      const candidate = usablePhotoUrl(item.urls?.regular || item.urls?.small);
      if (candidate) return candidate;
    }
  } catch {
    // Fallback to next photo provider.
  }
  return null;
}

async function fetchFromPixabayPhoto(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query.trim())}&image_type=photo&safesearch=true&order=popular&per_page=3`;
    const res = await axios.get<{ hits?: Array<{ webformatURL?: string; largeImageURL?: string }> }>(url, { timeout: 6000 });
    for (const hit of res.data?.hits ?? []) {
      const candidate = usablePhotoUrl(hit.webformatURL || hit.largeImageURL);
      if (candidate) return candidate;
    }
  } catch {
    // Fallback to next photo provider.
  }
  return null;
}

async function fetchFromOpenverse(query: string): Promise<string | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query.trim())}&category=photograph&page_size=5`;
    const res = await axios.get<{ results?: Array<{ url?: string; thumbnail?: string; width?: number; height?: number }> }>(url, {
      headers: REQUEST_HEADERS,
      timeout: 7000,
    });
    for (const item of res.data?.results ?? []) {
      if ((item.width ?? 600) < 300 || (item.height ?? 400) < 220) continue;
      const candidate = usablePhotoUrl(item.url || item.thumbnail);
      if (candidate) return candidate;
    }
  } catch {
    // Fallback to Wikimedia.
  }
  return null;
}

async function fetchFromWikimedia(query: string): Promise<string | null> {
  try {
    const searchQuery = `filetype:bitmap ${query.trim()}`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json`;
    const res = await axios.get<{
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string; width?: number; height?: number }> }> };
    }>(url, { timeout: 7000, headers: REQUEST_HEADERS });
    const pages = Object.values(res.data?.query?.pages ?? {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = (info.mime ?? '').toLowerCase();
      if (!mime.includes('jpeg') && !mime.includes('png') && !mime.includes('webp')) continue;
      if ((info.width ?? 0) < 300 || (info.height ?? 0) < 220) continue;
      const candidate = usablePhotoUrl(info.thumburl || info.url);
      if (candidate) return candidate;
    }
  } catch {
    // No photo found.
  }
  return null;
}

/** Searches real photographic sources in priority order: Pexels -> Unsplash -> Pixabay Photo -> Openverse -> Wikimedia. */
export async function findLessonImage(query: string): Promise<string | null> {
  const pexels = process.env.PEXELS_API_KEY?.trim();
  if (pexels) {
    const url = await fetchFromPexels(query, pexels);
    if (url) return url;
  }
  const unsplash = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (unsplash) {
    const url = await fetchFromUnsplash(query, unsplash);
    if (url) return url;
  }
  const pixabay = process.env.PIXABAY_API_KEY?.trim();
  if (pixabay) {
    const url = await fetchFromPixabayPhoto(query, pixabay);
    if (url) return url;
  }
  const openverse = await fetchFromOpenverse(query);
  if (openverse) return openverse;
  return fetchFromWikimedia(query);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const includeReading = args.includes('--reading');
  const includeSpeaking = args.includes('--speaking');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const prisma = new PrismaClient();
  try {
    const kinds: Array<'LISTENING' | 'READING'> = includeReading ? ['LISTENING', 'READING'] : ['LISTENING'];
    const lessons = await prisma.learningLesson.findMany({
      where: { kind: { in: kinds }, published: true },
      orderBy: { sortOrder: 'asc' },
    });

    let updated = 0;
    for (const lesson of lessons) {
      if (limit !== undefined && updated >= limit) break;
      const content = structuredClone(lesson.content as unknown as LearningContent);
      let changed = false;

      if (forceAll || !content.coverImageUrl) {
        const foundCover = await findLessonImage(lesson.title);
        if (foundCover) {
          content.coverImageUrl = foundCover;
          changed = true;
        }
        await sleep(150);
      }

      if (Array.isArray(content.keyVocabulary)) {
        for (const item of content.keyVocabulary) {
          if (!forceAll && item.imageUrl) continue;
          const found = await findLessonImage(item.word);
          if (found) {
            item.imageUrl = found;
            changed = true;
          }
          await sleep(150);
        }
      }

      if (changed && !dryRun) {
        validateLearningContent(content, lesson.kind);
        await prisma.learningLesson.update({
          where: { id: lesson.id },
          data: {
            content: content as unknown as Prisma.InputJsonValue,
            contentVersion: { increment: 1 },
          },
        });
      }
      if (changed) {
        updated++;
        console.log(`${dryRun ? '[dry-run] ' : ''}Updated photo assets for ${lesson.code}`);
      }
    }
    console.log(`Processed ${lessons.length} lessons (${kinds.join(', ')}); updated=${updated}.`);

    if (includeSpeaking) {
      const prompts = await prisma.speakingPrompt.findMany({
        where: { published: true, mode: { in: [SpeakingMode.TOPIC, SpeakingMode.PICTURE_DESCRIPTION] } },
        orderBy: { sortOrder: 'asc' },
      });
      let updatedSpeaking = 0;
      for (const prompt of prompts) {
        if (limit !== undefined && updated + updatedSpeaking >= limit) break;
        if (!forceAll && prompt.imageUrl) continue;
        const found = await findLessonImage(prompt.title || prompt.text);
        if (found && !dryRun) {
          await prisma.speakingPrompt.update({
            where: { id: prompt.id },
            data: { imageUrl: found, contentVersion: { increment: 1 } },
          });
        }
        if (found) {
          updatedSpeaking++;
          console.log(`${dryRun ? '[dry-run] ' : ''}Updated speaking photo for ${prompt.code}`);
        }
        await sleep(150);
      }
      console.log(`Processed ${prompts.length} speaking prompts; updated=${updatedSpeaking}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Lesson image enrichment failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
