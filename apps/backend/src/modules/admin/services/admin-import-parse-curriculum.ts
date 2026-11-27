import { AssessmentSkill, CefrLevel, ItemUsageScope, LearningKind } from '@prisma/client';
import {
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  validateGrammarTopicPayload,
} from '../../grammar/grammar.types';
import { validateLearningContent } from '../../learning/learning.types';
import { validateListeningAudio } from '../../learning/listening-media';
import { learningMediaRoot } from '../../learning/learning.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ASSESSMENT_SKILL_VALUES,
  CEFR_LEVEL_VALUES,
  GRAMMAR_CODE_REGEX,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  LEARNING_KIND_VALUES,
  NormalizedAssessmentGroupInput,
  NormalizedBundle,
  NormalizedGrammarTopicInput,
  NormalizedLessonInput,
  NormalizedUnitInput,
  SLUG_REGEX,
  USAGE_SCOPE_VALUES,
  UUID_REGEX,
  asTrimmedString,
  emptyBundle,
  isPlainObject,
  isSafeMediaUrl,
} from './admin-import.types';

export function normalizeBundleShapeHelper(rawBundle: unknown): {
  bundle: NormalizedBundle;
  shapeError: string | null;
} {
  if (Array.isArray(rawBundle)) {
    const bundle = emptyBundle();
    for (const entry of rawBundle) {
      if (!isPlainObject(entry)) {
        return { bundle, shapeError: 'Mỗi phần tử trong mảng JSON phải là một đối tượng (Object).' };
      }
      if (('topic' in entry && 'words' in entry) || ('slug' in entry && 'words' in entry)) {
        bundle.topics.push(entry);
      } else if ('content' in entry && 'kind' in entry) {
        bundle.lessons.push(entry);
      } else if ('mode' in entry && 'text' in entry && 'code' in entry) {
        bundle.speakingPrompts.push(entry);
      } else if ('isLeaf' in entry && 'titleEn' in entry && 'code' in entry) {
        bundle.grammarTopics.push(entry);
      } else if ('partNumber' in entry && 'skill' in entry && !('prompt' in entry)) {
        bundle.assessmentGroups.push(entry);
      } else if ('prompt' in entry && ('cefrLevel' in entry || 'skill' in entry)) {
        bundle.items.push(entry);
      } else if ('code' in entry && 'cefrLevel' in entry && 'orderIndex' in entry && 'title' in entry) {
        bundle.units.push(entry);
      } else {
        return {
          bundle,
          shapeError:
            'Không thể tự nhận diện loại bản ghi trong mảng JSON. Hãy dùng cấu trúc { "units": [], "lessons": [], "items": [], "topics": [], "speakingPrompts": [], "grammarTopics": [], "assessmentGroups": [] }.',
        };
      }
    }
    return { bundle, shapeError: null };
  }

  if (!isPlainObject(rawBundle)) {
    return {
      bundle: emptyBundle(),
      shapeError:
        'Dữ liệu import phải là đối tượng JSON ({ units, lessons, items, topics, speakingPrompts, grammarTopics, assessmentGroups }) hoặc mảng JSON hợp lệ.',
    };
  }

  const keys = ['units', 'lessons', 'items', 'topics', 'speakingPrompts', 'grammarTopics', 'assessmentGroups'] as const;
  const bundle = emptyBundle();
  for (const key of keys) {
    const value = rawBundle[key];
    if (value !== undefined && !Array.isArray(value)) {
      return { bundle, shapeError: `Trường "${key}" bắt buộc phải là một mảng (Array).` };
    }
    bundle[key] = Array.isArray(value) ? value : [];
  }
  return { bundle, shapeError: null };
}

export function parseUnitsSection(
  rawUnits: unknown[],
  existingUnitByCode: Map<string, { id: string; code: string }>,
  existingUnitByLevelOrder: Map<string, string>,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): { parsedUnits: NormalizedUnitInput[]; bundleUnitCodes: Set<string> } {
  const parsedUnits: NormalizedUnitInput[] = [];
  const bundleUnitCodes = new Set<string>();
  const bundleUnitOrderKeys = new Map<string, string>();

  rawUnits.forEach((raw, idx) => {
    const path = `units[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'Unit phải là một đối tượng JSON.' });
      return;
    }
    const code = asTrimmedString(raw.code).toLowerCase();
    const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
    const orderIndex = Number(raw.orderIndex);
    const title = asTrimmedString(raw.title);
    const description = asTrimmedString(raw.description);

    let itemValid = true;
    if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
      errors.push({ path: `${path}.code`, message: 'Mã chương chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).' });
      itemValid = false;
    } else if (bundleUnitCodes.has(code)) {
      errors.push({ path: `${path}.code`, message: `Mã chương "${code}" bị trùng trong gói JSON.` });
      itemValid = false;
    }
    if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
      errors.push({ path: `${path}.cefrLevel`, message: 'cefrLevel phải thuộc A1, A2, B1, B2, C1 hoặc C2.' });
      itemValid = false;
    }
    if (!Number.isInteger(orderIndex) || orderIndex < 1) {
      errors.push({ path: `${path}.orderIndex`, message: 'orderIndex phải là số nguyên >= 1.' });
      itemValid = false;
    }
    if (!title || title.length > 200) {
      errors.push({ path: `${path}.title`, message: 'Tiêu đề chương không được rỗng và tối đa 200 ký tự.' });
      itemValid = false;
    }
    if (!description) {
      errors.push({ path: `${path}.description`, message: 'Mô tả chương không được để trống.' });
      itemValid = false;
    }
    if (CEFR_LEVEL_VALUES.has(cefrLevel) && Number.isInteger(orderIndex)) {
      const orderKey = `${cefrLevel}:${orderIndex}`;
      const prevInBundle = bundleUnitOrderKeys.get(orderKey);
      const ownerInDb = existingUnitByLevelOrder.get(orderKey);
      if (prevInBundle && prevInBundle !== code) {
        errors.push({ path: `${path}.orderIndex`, message: `Cặp (${cefrLevel}, orderIndex=${orderIndex}) bị trùng với "${prevInBundle}" trong gói JSON.` });
        itemValid = false;
      } else if (ownerInDb && ownerInDb !== code) {
        errors.push({ path: `${path}.orderIndex`, message: `Bậc ${cefrLevel} đã có chương thứ ${orderIndex} ("${ownerInDb}") trong DB.` });
        itemValid = false;
      } else if (code) {
        bundleUnitOrderKeys.set(orderKey, code);
      }
    }
    if (!itemValid) return;

    bundleUnitCodes.add(code);
    const op: 'CREATE' | 'UPDATE' = existingUnitByCode.has(code) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.units.create += 1;
    else counts.units.update += 1;

    records.push({ entity: 'unit', identifier: code, title: `[${cefrLevel}] ${title}`, operation: op });
    parsedUnits.push({ code, cefrLevel: cefrLevel as CefrLevel, orderIndex, title, description });
  });

  return { parsedUnits, bundleUnitCodes };
}

type ExistingGrammarTopic = {
  id: string;
  code: string;
  isLeaf: boolean;
  parentId: string | null;
  parent: { code: string } | null;
};

export async function parseGrammarTopicsSection(
  prisma: PrismaService,
  rawTopics: unknown[],
  existingGrammarTopics: ExistingGrammarTopic[],
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): Promise<{
  parsedGrammarTopics: NormalizedGrammarTopicInput[];
  bundleGrammarByCode: Map<string, NormalizedGrammarTopicInput>;
  existingGrammarByCode: Map<string, ExistingGrammarTopic>;
}> {
  const existingGrammarByCode = new Map(existingGrammarTopics.map((g) => [g.code, g]));
  const parsedGrammarTopics: NormalizedGrammarTopicInput[] = [];
  const bundleGrammarByCode = new Map<string, NormalizedGrammarTopicInput>();
  const grammarSourceIdxByCode = new Map<string, number>();

  rawTopics.forEach((raw, idx) => {
    const path = `grammarTopics[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'GrammarTopic phải là một đối tượng JSON.' });
      return;
    }

    const code = asTrimmedString(raw.code).toLowerCase();
    const existingInDb = existingGrammarByCode.get(code);
    const parentCode = asTrimmedString(raw.parentCode).toLowerCase() || null;
    const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
    const hasExplicitIsLeaf = typeof raw.isLeaf === 'boolean';
    const isLeaf = hasExplicitIsLeaf
      ? (raw.isLeaf as boolean)
      : (existingInDb?.isLeaf ?? true);
    const titleEn = asTrimmedString(raw.titleEn);
    const titleVi = asTrimmedString(raw.titleVi);
    const summaryVi = asTrimmedString(raw.summaryVi);
    const orderIndex = raw.orderIndex !== undefined ? Number(raw.orderIndex) : idx;
    const published = typeof raw.published === 'boolean' ? raw.published : true;
    const formulas = (Array.isArray(raw.formulas) ? raw.formulas : []) as GrammarFormulaItem[];
    const usageNotes = (Array.isArray(raw.usageNotes) ? raw.usageNotes : []) as GrammarUsageItem[];
    const examples = (Array.isArray(raw.examples) ? raw.examples : []) as GrammarExampleItem[];

    let itemValid = true;
    if (!code || !GRAMMAR_CODE_REGEX.test(code) || code.length > 100) {
      errors.push({ path: `${path}.code`, message: 'Mã ngữ pháp phải bắt đầu bằng "grammar", phân tách bằng dấu chấm và chỉ gồm chữ thường a-z hoặc dấu gạch dưới (<= 100 ký tự).' });
      itemValid = false;
    } else if (bundleGrammarByCode.has(code)) {
      errors.push({ path: `${path}.code`, message: `Mã ngữ pháp "${code}" bị trùng trong gói JSON.` });
      itemValid = false;
    } else if (existingInDb && hasExplicitIsLeaf && raw.isLeaf !== existingInDb.isLeaf) {
      errors.push({
        path: `${path}.isLeaf`,
        message: `Không thể thay đổi trạng thái isLeaf của chủ điểm ngữ pháp "${code}" đã tồn tại.`,
      });
      itemValid = false;
    }
    if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
      errors.push({ path: `${path}.cefrLevel`, message: 'cefrLevel phải thuộc A1..C2.' });
      itemValid = false;
    }
    if (!titleEn || titleEn.length > 150 || !titleVi || titleVi.length > 150) {
      errors.push({ path: `${path}.title`, message: 'titleEn và titleVi không được rỗng (<= 150 ký tự).' });
      itemValid = false;
    }
    if (!Number.isInteger(orderIndex) || orderIndex < 0) {
      errors.push({ path: `${path}.orderIndex`, message: 'orderIndex phải là số nguyên >= 0.' });
      itemValid = false;
    }

    let prerequisiteCodes: string[] | undefined;
    if (raw.prerequisiteCodes !== undefined) {
      if (!Array.isArray(raw.prerequisiteCodes)) {
        errors.push({ path: `${path}.prerequisiteCodes`, message: 'prerequisiteCodes phải là một mảng chuỗi mã ngữ pháp.' });
        itemValid = false;
      } else {
        const deduped: string[] = [];
        const seenPrereqs = new Set<string>();
        for (const entry of raw.prerequisiteCodes) {
          if (typeof entry !== 'string' || !entry.trim()) {
            errors.push({ path: `${path}.prerequisiteCodes`, message: 'Mỗi phần tử trong prerequisiteCodes phải là chuỗi mã ngữ pháp hợp lệ.' });
            itemValid = false;
            break;
          }
          const normalizedPrereq = entry.trim().toLowerCase();
          if (!seenPrereqs.has(normalizedPrereq)) {
            seenPrereqs.add(normalizedPrereq);
            deduped.push(normalizedPrereq);
          }
        }
        prerequisiteCodes = deduped;
      }
    }

    if (itemValid) {
      try {
        validateGrammarTopicPayload({ formulas, usageNotes, examples }, isLeaf, code);
      } catch (err) {
        errors.push({ path, message: err instanceof Error ? err.message : 'Nội dung cấu trúc ngữ pháp không hợp lệ.' });
        itemValid = false;
      }
    }
    if (!itemValid) return;

    const normalized: NormalizedGrammarTopicInput = {
      code,
      parentCode,
      cefrLevel: cefrLevel as CefrLevel,
      isLeaf,
      titleEn,
      titleVi,
      summaryVi,
      formulas,
      usageNotes,
      examples,
      orderIndex,
      published,
      ...(prerequisiteCodes !== undefined ? { prerequisiteCodes } : {}),
    };
    bundleGrammarByCode.set(code, normalized);
    grammarSourceIdxByCode.set(code, idx);
    parsedGrammarTopics.push(normalized);

    const op: 'CREATE' | 'UPDATE' = existingGrammarByCode.has(code) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.grammarTopics.create += 1;
    else counts.grammarTopics.update += 1;

    records.push({ entity: 'grammarTopic', identifier: code, title: `[${cefrLevel}] ${titleVi}`, operation: op });
  });

  const existingGrammarById = new Map(existingGrammarTopics.map((g) => [g.id, g]));
  const mergedParentByCode = new Map<string, string | null>();
  for (const g of existingGrammarTopics) {
    mergedParentByCode.set(g.code, g.parent?.code ?? (g.parentId ? (existingGrammarById.get(g.parentId)?.code ?? null) : null));
  }
  for (const g of parsedGrammarTopics) mergedParentByCode.set(g.code, g.parentCode);

  parsedGrammarTopics.forEach((g) => {
    const idx = grammarSourceIdxByCode.get(g.code) ?? 0;
    if (!g.parentCode) return;
    if (g.parentCode === g.code) {
      errors.push({ path: `grammarTopics[${idx}].parentCode`, message: `Chủ điểm ngữ pháp "${g.code}" không thể là cha của chính nó.` });
      return;
    }
    const inBundle = bundleGrammarByCode.get(g.parentCode);
    const inDb = existingGrammarByCode.get(g.parentCode);
    if (!inBundle && !inDb) {
      errors.push({ path: `grammarTopics[${idx}].parentCode`, message: `Không tìm thấy parentCode "${g.parentCode}" trong DB hoặc gói JSON.` });
      return;
    }
    if ((inBundle && inBundle.isLeaf) || (!inBundle && inDb?.isLeaf)) {
      errors.push({ path: `grammarTopics[${idx}].parentCode`, message: `Nút cha "${g.parentCode}" phải là nhóm (isLeaf = false).` });
      return;
    }
    const visited = new Set<string>([g.code]);
    let cursor: string | null = g.parentCode;
    while (cursor) {
      if (visited.has(cursor)) {
        errors.push({ path: `grammarTopics[${idx}].parentCode`, message: `Phát hiện vòng lặp phân cấp Cha – Con (parentCode cycle) liên quan tới "${g.code}".` });
        break;
      }
      visited.add(cursor);
      cursor = mergedParentByCode.get(cursor) ?? null;
    }
  });

  const topicsWithPrereqs = parsedGrammarTopics.filter((g) => g.prerequisiteCodes !== undefined);
  if (topicsWithPrereqs.length > 0) {
    let hasPrereqLinkError = false;
    for (const g of topicsWithPrereqs) {
      const idx = grammarSourceIdxByCode.get(g.code) ?? 0;
      const prereqs = g.prerequisiteCodes ?? [];
      if (prereqs.length > 0 && !g.isLeaf) {
        errors.push({ path: `grammarTopics[${idx}].prerequisiteCodes`, message: `Chỉ cấu trúc ngữ pháp lá (isLeaf = true) mới được gắn prerequisiteCodes ("${g.code}").` });
        hasPrereqLinkError = true;
        continue;
      }
      for (const prereqCode of prereqs) {
        if (prereqCode === g.code) {
          errors.push({ path: `grammarTopics[${idx}].prerequisiteCodes`, message: `Cấu trúc ngữ pháp "${g.code}" không thể là điều kiện tiên quyết của chính nó.` });
          hasPrereqLinkError = true;
          continue;
        }
        const inBundle = bundleGrammarByCode.get(prereqCode);
        const inDb = existingGrammarByCode.get(prereqCode);
        if (!inBundle && !inDb) {
          errors.push({ path: `grammarTopics[${idx}].prerequisiteCodes`, message: `Không tìm thấy prerequisiteCode "${prereqCode}" trong DB hoặc gói JSON.` });
          hasPrereqLinkError = true;
        } else if ((inBundle && !inBundle.isLeaf) || (!inBundle && inDb && !inDb.isLeaf)) {
          errors.push({ path: `grammarTopics[${idx}].prerequisiteCodes`, message: `Điều kiện tiên quyết "${prereqCode}" phải là cấu trúc lá (isLeaf = true).` });
          hasPrereqLinkError = true;
        }
      }
    }

    if (!hasPrereqLinkError) {
      const existingEdges = prisma.grammarPrerequisite?.findMany
        ? await prisma.grammarPrerequisite.findMany({
            select: { prerequisite: { select: { code: true } }, target: { select: { code: true } } },
          })
        : [];
      const prereqsByTarget = new Map<string, Set<string>>();
      for (const edge of existingEdges) {
        const set = prereqsByTarget.get(edge.target.code) ?? new Set<string>();
        set.add(edge.prerequisite.code);
        prereqsByTarget.set(edge.target.code, set);
      }
      for (const g of topicsWithPrereqs) prereqsByTarget.set(g.code, new Set(g.prerequisiteCodes ?? []));

      const color = new Map<string, 0 | 1 | 2>();
      const stack: string[] = [];
      const reportedCycleNodes = new Set<string>();
      const visit = (node: string): void => {
        color.set(node, 1);
        stack.push(node);
        for (const next of prereqsByTarget.get(node) ?? []) {
          const nextColor = color.get(next) ?? 0;
          if (nextColor === 1) {
            const cycleStart = stack.indexOf(next);
            const cycleNodes = cycleStart >= 0 ? stack.slice(cycleStart) : [node, next];
            const blameCode = cycleNodes.find((c) => grammarSourceIdxByCode.has(c)) ?? topicsWithPrereqs[0].code;
            if (!reportedCycleNodes.has(blameCode)) {
              reportedCycleNodes.add(blameCode);
              errors.push({
                path: `grammarTopics[${grammarSourceIdxByCode.get(blameCode) ?? 0}].prerequisiteCodes`,
                message: `Phát hiện chu trình phụ thuộc vòng lặp (DAG cycle) trong prerequisiteCodes: ${[...cycleNodes, next].join(' -> ')}.`,
              });
            }
          } else if (nextColor === 0) {
            visit(next);
          }
        }
        stack.pop();
        color.set(node, 2);
      };
      for (const node of prereqsByTarget.keys()) {
        if ((color.get(node) ?? 0) === 0) visit(node);
      }
    }
  }

  return { parsedGrammarTopics, bundleGrammarByCode, existingGrammarByCode };
}

export function parseAssessmentGroupsSection(
  rawGroups: unknown[],
  existingGroupIds: Set<string>,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): { parsedGroups: NormalizedAssessmentGroupInput[]; bundleGroupIds: Set<string> } {
  const parsedGroups: NormalizedAssessmentGroupInput[] = [];
  const bundleGroupIds = new Set<string>();

  rawGroups.forEach((raw, idx) => {
    const path = `assessmentGroups[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'AssessmentGroup phải là một đối tượng JSON.' });
      return;
    }

    const id = asTrimmedString(raw.id) || undefined;
    const skill = asTrimmedString(raw.skill).toUpperCase();
    const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
    const usageScope = (asTrimmedString(raw.usageScope) || ItemUsageScope.ALL).toUpperCase();
    const partNumber = raw.partNumber !== undefined ? Number(raw.partNumber) : 1;
    const title = asTrimmedString(raw.title) || null;
    const passage = asTrimmedString(raw.passage) || null;
    const audioUrl = asTrimmedString(raw.audioUrl) || null;
    const transcript = asTrimmedString(raw.transcript) || null;

    let itemValid = true;
    if (id) {
      if (!UUID_REGEX.test(id)) {
        errors.push({ path: `${path}.id`, message: 'id của AssessmentGroup phải là UUID hợp lệ.' });
        itemValid = false;
      } else if (bundleGroupIds.has(id)) {
        errors.push({ path: `${path}.id`, message: `id "${id}" của AssessmentGroup bị trùng trong gói JSON.` });
        itemValid = false;
      }
    }
    if (!ASSESSMENT_SKILL_VALUES.has(skill)) {
      errors.push({ path: `${path}.skill`, message: 'skill phải là READING, LISTENING, WRITING hoặc SPEAKING.' });
      itemValid = false;
    }
    if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
      errors.push({ path: `${path}.cefrLevel`, message: 'cefrLevel phải thuộc A1..C2.' });
      itemValid = false;
    }
    if (!USAGE_SCOPE_VALUES.has(usageScope)) {
      errors.push({ path: `${path}.usageScope`, message: `usageScope "${usageScope}" không hợp lệ.` });
      itemValid = false;
    }
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 20) {
      errors.push({ path: `${path}.partNumber`, message: 'partNumber phải là số nguyên từ 1 đến 20.' });
      itemValid = false;
    }
    if (audioUrl && !isSafeMediaUrl(audioUrl)) {
      errors.push({ path: `${path}.audioUrl`, message: 'audioUrl không hợp lệ.' });
      itemValid = false;
    }
    if (!itemValid) return;

    if (id) bundleGroupIds.add(id);
    const op: 'CREATE' | 'UPDATE' = id && existingGroupIds.has(id) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.assessmentGroups.create += 1;
    else counts.assessmentGroups.update += 1;

    records.push({
      entity: 'assessmentGroup',
      identifier: id ?? `group-${idx + 1}`,
      title: title ?? `[${skill} ${cefrLevel}] Part ${partNumber}`,
      operation: op,
    });
    parsedGroups.push({
      id,
      skill: skill as AssessmentSkill,
      title,
      cefrLevel: cefrLevel as CefrLevel,
      partNumber,
      passage,
      audioUrl,
      transcript,
      usageScope: usageScope as ItemUsageScope,
    });
  });

  return { parsedGroups, bundleGroupIds };
}

export async function parseLessonsSection(
  rawLessons: unknown[],
  existingUnitByCode: Map<string, { id: string }>,
  bundleUnitCodes: Set<string>,
  existingGrammarByCode: Map<string, { isLeaf: boolean }>,
  bundleGrammarByCode: Map<string, NormalizedGrammarTopicInput>,
  existingLessonCodes: Set<string>,
  mediaStorage: MediaStorageService | undefined,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): Promise<NormalizedLessonInput[]> {
  const parsedLessons: NormalizedLessonInput[] = [];
  const bundleLessonCodes = new Set<string>();

  for (let idx = 0; idx < rawLessons.length; idx++) {
    const raw = rawLessons[idx];
    const path = `lessons[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'Lesson phải là một đối tượng JSON.' });
      continue;
    }

    const code = asTrimmedString(raw.code).toLowerCase();
    const kind = asTrimmedString(raw.kind).toUpperCase();
    const title = asTrimmedString(raw.title);
    const description = asTrimmedString(raw.description);
    const estimatedMinutes = Number(raw.estimatedMinutes ?? 5);
    const sortOrderRaw = raw.sortOrder;
    const sortOrder = sortOrderRaw !== undefined && sortOrderRaw !== null ? Number(sortOrderRaw) : undefined;
    const published = typeof raw.published === 'boolean' ? raw.published : true;
    const unitCode = asTrimmedString(raw.unitCode).toLowerCase() || undefined;
    const grammarTopicCode = asTrimmedString(raw.grammarTopicCode).toLowerCase() || undefined;

    let itemValid = true;
    if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
      errors.push({ path: `${path}.code`, message: 'Mã bài học chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).' });
      itemValid = false;
    } else if (bundleLessonCodes.has(code)) {
      errors.push({ path: `${path}.code`, message: `Mã bài học "${code}" bị trùng trong gói JSON.` });
      itemValid = false;
    }
    if (!LEARNING_KIND_VALUES.has(kind)) {
      errors.push({ path: `${path}.kind`, message: 'kind phải là GRAMMAR, VOCABULARY, READING hoặc LISTENING.' });
      itemValid = false;
    }
    if (!title || title.length > 200) {
      errors.push({ path: `${path}.title`, message: 'Tiêu đề bài học không được rỗng và tối đa 200 ký tự.' });
      itemValid = false;
    }
    if (!description) {
      errors.push({ path: `${path}.description`, message: 'Mô tả bài học không được để trống.' });
      itemValid = false;
    }
    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 120) {
      errors.push({ path: `${path}.estimatedMinutes`, message: 'estimatedMinutes phải là số nguyên từ 1 đến 120.' });
      itemValid = false;
    }
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      errors.push({ path: `${path}.sortOrder`, message: 'sortOrder phải là số nguyên >= 0.' });
      itemValid = false;
    }
    if (unitCode && !existingUnitByCode.has(unitCode) && !bundleUnitCodes.has(unitCode)) {
      errors.push({ path: `${path}.unitCode`, message: `Không tìm thấy unitCode "${unitCode}" trong DB hoặc trong danh sách units đính kèm.` });
      itemValid = false;
    }
    if (grammarTopicCode) {
      if (LEARNING_KIND_VALUES.has(kind) && kind !== LearningKind.GRAMMAR) {
        errors.push({
          path: `${path}.grammarTopicCode`,
          message: 'Chỉ bài học loại GRAMMAR mới được gắn grammarTopicCode.',
        });
        itemValid = false;
      } else {
        const bundledTopic = bundleGrammarByCode.get(grammarTopicCode);
        const dbTopic = existingGrammarByCode.get(grammarTopicCode);
        if (!bundledTopic && !dbTopic) {
          errors.push({ path: `${path}.grammarTopicCode`, message: `Không tìm thấy grammarTopicCode "${grammarTopicCode}" trong DB hoặc gói JSON.` });
          itemValid = false;
        } else if ((bundledTopic && !bundledTopic.isLeaf) || (!bundledTopic && dbTopic && !dbTopic.isLeaf)) {
          errors.push({ path: `${path}.grammarTopicCode`, message: `Chủ điểm ngữ pháp "${grammarTopicCode}" phải là cấu trúc lá (isLeaf = true).` });
          itemValid = false;
        }
      }
    }
    if (LEARNING_KIND_VALUES.has(kind)) {
      try {
        validateLearningContent(raw.content, kind as LearningKind);
        if (published) {
          if (mediaStorage) await mediaStorage.verifyListeningAudio(raw.content, learningMediaRoot());
          else validateListeningAudio(raw.content, learningMediaRoot());
        }
      } catch (err) {
        errors.push({ path: `${path}.content`, message: err instanceof Error ? err.message : 'Nội dung bài học không hợp lệ.' });
        itemValid = false;
      }
    }
    if (!itemValid) continue;

    bundleLessonCodes.add(code);
    const op: 'CREATE' | 'UPDATE' = existingLessonCodes.has(code) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.lessons.create += 1;
    else counts.lessons.update += 1;

    records.push({ entity: 'lesson', identifier: code, title, operation: op });
    parsedLessons.push({
      code,
      kind: kind as LearningKind,
      title,
      description,
      estimatedMinutes,
      sortOrder,
      published,
      unitCode,
      grammarTopicCode,
      content: raw.content,
    });
  }

  return parsedLessons;
}
