import { CefrLevel } from '@prisma/client';
import {
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  validateGrammarTopicPayload,
} from '../../../grammar/grammar.types';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  asTrimmedString,
  CEFR_LEVEL_VALUES,
  GRAMMAR_CODE_REGEX,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  isPlainObject,
  NormalizedGrammarTopicInput,
} from './admin-import.types';

export interface ExistingGrammarTopicRecord {
  id: string;
  code: string;
  isLeaf: boolean;
  parentId: string | null;
  parent: { code: string } | null;
}

export async function validateAndParseGrammarTopics(params: {
  rawGrammarTopics: unknown[];
  existingGrammarTopics: ExistingGrammarTopicRecord[];
  prisma: PrismaService;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): Promise<{
  parsedGrammarTopics: NormalizedGrammarTopicInput[];
  bundleGrammarByCode: Map<string, NormalizedGrammarTopicInput>;
  existingGrammarByCode: Map<string, ExistingGrammarTopicRecord>;
}> {
  const {
    rawGrammarTopics,
    existingGrammarTopics,
    prisma,
    errors,
    records,
    counts,
  } = params;

  const existingGrammarByCode = new Map(
    existingGrammarTopics.map((g) => [g.code, g]),
  );
  const parsedGrammarTopics: NormalizedGrammarTopicInput[] = [];
  const bundleGrammarByCode = new Map<string, NormalizedGrammarTopicInput>();
  const grammarSourceIdxByCode = new Map<string, number>();

  rawGrammarTopics.forEach((raw, idx) => {
    const path = `grammarTopics[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'GrammarTopic phải là một đối tượng JSON.' });
      return;
    }

    const code = asTrimmedString(raw.code).toLowerCase();
    const parentCode = asTrimmedString(raw.parentCode).toLowerCase() || null;
    const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
    const isLeaf = typeof raw.isLeaf === 'boolean' ? raw.isLeaf : true;
    const titleEn = asTrimmedString(raw.titleEn);
    const titleVi = asTrimmedString(raw.titleVi);
    const summaryVi = asTrimmedString(raw.summaryVi);
    const orderIndex =
      raw.orderIndex !== undefined ? Number(raw.orderIndex) : idx;
    const published = typeof raw.published === 'boolean' ? raw.published : true;
    const formulas = (
      Array.isArray(raw.formulas) ? raw.formulas : []
    ) as GrammarFormulaItem[];
    const usageNotes = (
      Array.isArray(raw.usageNotes) ? raw.usageNotes : []
    ) as GrammarUsageItem[];
    const examples = (
      Array.isArray(raw.examples) ? raw.examples : []
    ) as GrammarExampleItem[];

    let itemValid = true;
    if (!code || !GRAMMAR_CODE_REGEX.test(code) || code.length > 100) {
      errors.push({
        path: `${path}.code`,
        message:
          'Mã ngữ pháp phải bắt đầu bằng "grammar", phân tách bằng dấu chấm và chỉ gồm chữ thường a-z hoặc dấu gạch dưới (<= 100 ký tự).',
      });
      itemValid = false;
    } else if (bundleGrammarByCode.has(code)) {
      errors.push({
        path: `${path}.code`,
        message: `Mã ngữ pháp "${code}" bị trùng trong gói JSON.`,
      });
      itemValid = false;
    }

    if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
      errors.push({
        path: `${path}.cefrLevel`,
        message: 'cefrLevel phải thuộc A1..C2.',
      });
      itemValid = false;
    }

    if (!titleEn || titleEn.length > 150 || !titleVi || titleVi.length > 150) {
      errors.push({
        path: `${path}.title`,
        message: 'titleEn và titleVi không được rỗng (<= 150 ký tự).',
      });
      itemValid = false;
    }

    if (!Number.isInteger(orderIndex) || orderIndex < 0) {
      errors.push({
        path: `${path}.orderIndex`,
        message: 'orderIndex phải là số nguyên >= 0.',
      });
      itemValid = false;
    }

    let prerequisiteCodes: string[] | undefined;
    if (raw.prerequisiteCodes !== undefined) {
      if (!Array.isArray(raw.prerequisiteCodes)) {
        errors.push({
          path: `${path}.prerequisiteCodes`,
          message: 'prerequisiteCodes phải là một mảng chuỗi mã ngữ pháp.',
        });
        itemValid = false;
      } else {
        const deduped: string[] = [];
        const seenPrereqs = new Set<string>();
        for (const entry of raw.prerequisiteCodes) {
          if (typeof entry !== 'string' || !entry.trim()) {
            errors.push({
              path: `${path}.prerequisiteCodes`,
              message:
                'Mỗi phần tử trong prerequisiteCodes phải là chuỗi mã ngữ pháp hợp lệ.',
            });
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
        errors.push({
          path,
          message:
            err instanceof Error
              ? err.message
              : 'Nội dung cấu trúc ngữ pháp không hợp lệ.',
        });
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

    const op: 'CREATE' | 'UPDATE' = existingGrammarByCode.has(code)
      ? 'UPDATE'
      : 'CREATE';
    if (op === 'CREATE') counts.grammarTopics.create += 1;
    else counts.grammarTopics.update += 1;

    records.push({
      entity: 'grammarTopic',
      identifier: code,
      title: `[${cefrLevel}] ${titleVi}`,
      operation: op,
    });
  });

  // Validate parentCode links and hierarchy cycles across bundle + DB
  const existingGrammarById = new Map(existingGrammarTopics.map((g) => [g.id, g]));
  const mergedParentByCode = new Map<string, string | null>();
  for (const g of existingGrammarTopics) {
    const dbParentCode =
      g.parent?.code ??
      (g.parentId ? (existingGrammarById.get(g.parentId)?.code ?? null) : null);
    mergedParentByCode.set(g.code, dbParentCode);
  }
  for (const g of parsedGrammarTopics) {
    mergedParentByCode.set(g.code, g.parentCode);
  }

  parsedGrammarTopics.forEach((g) => {
    const idx = grammarSourceIdxByCode.get(g.code) ?? 0;
    if (!g.parentCode) return;
    if (g.parentCode === g.code) {
      errors.push({
        path: `grammarTopics[${idx}].parentCode`,
        message: `Chủ điểm ngữ pháp "${g.code}" không thể là cha của chính nó.`,
      });
      return;
    }
    const inBundle = bundleGrammarByCode.get(g.parentCode);
    const inDb = existingGrammarByCode.get(g.parentCode);
    if (!inBundle && !inDb) {
      errors.push({
        path: `grammarTopics[${idx}].parentCode`,
        message: `Không tìm thấy parentCode "${g.parentCode}" trong DB hoặc gói JSON.`,
      });
      return;
    }
    if ((inBundle && inBundle.isLeaf) || (!inBundle && inDb?.isLeaf)) {
      errors.push({
        path: `grammarTopics[${idx}].parentCode`,
        message: `Nút cha "${g.parentCode}" phải là nhóm (isLeaf = false).`,
      });
      return;
    }

    const visited = new Set<string>([g.code]);
    let cursor: string | null = g.parentCode;
    while (cursor) {
      if (visited.has(cursor)) {
        errors.push({
          path: `grammarTopics[${idx}].parentCode`,
          message: `Phát hiện vòng lặp phân cấp Cha – Con (parentCode cycle) liên quan tới "${g.code}".`,
        });
        break;
      }
      visited.add(cursor);
      cursor = mergedParentByCode.get(cursor) ?? null;
    }
  });

  // Validate prerequisiteCodes links & full DAG cycle check across merged DB + bundle edges
  const topicsWithPrereqs = parsedGrammarTopics.filter(
    (g) => g.prerequisiteCodes !== undefined,
  );
  if (topicsWithPrereqs.length > 0) {
    let hasPrereqLinkError = false;
    for (const g of topicsWithPrereqs) {
      const idx = grammarSourceIdxByCode.get(g.code) ?? 0;
      const prereqs = g.prerequisiteCodes ?? [];
      if (prereqs.length > 0 && !g.isLeaf) {
        errors.push({
          path: `grammarTopics[${idx}].prerequisiteCodes`,
          message: `Chỉ cấu trúc ngữ pháp lá (isLeaf = true) mới được gắn prerequisiteCodes ("${g.code}").`,
        });
        hasPrereqLinkError = true;
        continue;
      }
      for (const prereqCode of prereqs) {
        if (prereqCode === g.code) {
          errors.push({
            path: `grammarTopics[${idx}].prerequisiteCodes`,
            message: `Cấu trúc ngữ pháp "${g.code}" không thể là điều kiện tiên quyết của chính nó.`,
          });
          hasPrereqLinkError = true;
          continue;
        }
        const inBundle = bundleGrammarByCode.get(prereqCode);
        const inDb = existingGrammarByCode.get(prereqCode);
        if (!inBundle && !inDb) {
          errors.push({
            path: `grammarTopics[${idx}].prerequisiteCodes`,
            message: `Không tìm thấy prerequisiteCode "${prereqCode}" trong DB hoặc gói JSON.`,
          });
          hasPrereqLinkError = true;
        } else if (
          (inBundle && !inBundle.isLeaf) ||
          (!inBundle && inDb && !inDb.isLeaf)
        ) {
          errors.push({
            path: `grammarTopics[${idx}].prerequisiteCodes`,
            message: `Điều kiện tiên quyết "${prereqCode}" phải là cấu trúc lá (isLeaf = true).`,
          });
          hasPrereqLinkError = true;
        }
      }
    }

    if (!hasPrereqLinkError) {
      const existingEdges = prisma.grammarPrerequisite?.findMany
        ? await prisma.grammarPrerequisite.findMany({
            select: {
              prerequisite: { select: { code: true } },
              target: { select: { code: true } },
            },
          })
        : [];
      const prereqsByTarget = new Map<string, Set<string>>();
      for (const edge of existingEdges) {
        const targetCode = edge.target.code;
        const prereqCode = edge.prerequisite.code;
        const set = prereqsByTarget.get(targetCode) ?? new Set<string>();
        set.add(prereqCode);
        prereqsByTarget.set(targetCode, set);
      }
      for (const g of topicsWithPrereqs) {
        prereqsByTarget.set(g.code, new Set(g.prerequisiteCodes ?? []));
      }

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
            const cycleNodes =
              cycleStart >= 0 ? stack.slice(cycleStart) : [node, next];
            const blameCode =
              cycleNodes.find((code) => grammarSourceIdxByCode.has(code)) ??
              topicsWithPrereqs[0].code;
            if (!reportedCycleNodes.has(blameCode)) {
              reportedCycleNodes.add(blameCode);
              const idx = grammarSourceIdxByCode.get(blameCode) ?? 0;
              errors.push({
                path: `grammarTopics[${idx}].prerequisiteCodes`,
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
        if ((color.get(node) ?? 0) === 0) {
          visit(node);
        }
      }
    }
  }

  return { parsedGrammarTopics, bundleGrammarByCode, existingGrammarByCode };
}
