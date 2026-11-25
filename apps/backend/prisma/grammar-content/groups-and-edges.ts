import { CefrLevel } from '@prisma/client';
import { GrammarExampleItem, GrammarFormulaItem, GrammarUsageItem } from '../../src/modules/grammar/grammar.types';

export interface GrammarTopicSeed {
  code: string;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  orderIndex: number;
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
}

export interface GrammarPrerequisiteEdgeSeed {
  prerequisiteCode: string;
  targetCode: string;
}

export const GRAMMAR_GROUPS: readonly GrammarTopicSeed[] = [
  {
    code: 'grammar',
    parentCode: null,
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'English Grammar',
    titleVi: 'Hệ thống Ngữ pháp Tiếng Anh (A1 → C2)',
    summaryVi: 'Cấu trúc ngữ pháp toàn diện từ nền tảng câu đơn A1 đến cú pháp học thuật và tu từ C2.',
    orderIndex: 0,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.foundations',
    parentCode: 'grammar',
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'Foundations & Parts of Speech',
    titleVi: 'Từ loại & Nền tảng Câu',
    summaryVi: 'Đại từ, danh từ, mạo từ, giới từ, liên từ và động từ khuyết thiếu nền tảng.',
    orderIndex: 10,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.tenses',
    parentCode: 'grammar',
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'Verb Tenses & Aspect',
    titleVi: 'Hệ thống 12 Thì & Thói quen Quá khứ',
    summaryVi: 'Trọn bộ 12 thì động từ tiếng Anh và cấu trúc chỉ thói quen trong quá khứ.',
    orderIndex: 20,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.questions',
    parentCode: 'grammar',
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'Question Structures',
    titleVi: 'Các Cấu trúc Câu hỏi',
    summaryVi: 'Từ câu hỏi Yes/No, Wh-questions đến câu hỏi đuôi, câu hỏi chủ ngữ và câu hỏi gián tiếp lịch sự.',
    orderIndex: 30,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.quantifiers',
    parentCode: 'grammar',
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'Quantifiers & Determiners',
    titleVi: 'Lượng từ & Sự Định lượng',
    summaryVi: 'Danh từ đếm được/không đếm được và hệ thống từ chỉ số lượng theo ngữ cảnh.',
    orderIndex: 40,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.comparatives_superlatives',
    parentCode: 'grammar',
    cefrLevel: 'A2',
    isLeaf: false,
    titleEn: 'Comparisons',
    titleVi: 'Các Cấp bậc So sánh',
    summaryVi: 'So sánh bằng, so sánh hơn và so sánh nhất của tính từ và trạng từ.',
    orderIndex: 50,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.verb_forms',
    parentCode: 'grammar',
    cefrLevel: 'B1',
    isLeaf: false,
    titleEn: 'Verb Patterns & Participles',
    titleVi: 'Danh động từ, Nguyên mẫu & Phân từ',
    summaryVi: 'Quy tắc kết hợp V-ing, to-V và mệnh đề phân từ rút gọn câu.',
    orderIndex: 60,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.conditionals',
    parentCode: 'grammar',
    cefrLevel: 'B1',
    isLeaf: false,
    titleEn: 'Conditional Sentences',
    titleVi: 'Hệ thống Câu Điều kiện',
    summaryVi: 'Câu điều kiện loại 0, 1, 2, 3 và điều kiện hỗn hợp đa thời gian.',
    orderIndex: 70,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.clauses_voice',
    parentCode: 'grammar',
    cefrLevel: 'B1',
    isLeaf: false,
    titleEn: 'Voice, Clauses & Reported Speech',
    titleVi: 'Thể Bị động, Mệnh đề & Câu Tường thuật',
    summaryVi: 'Câu bị động, thể sai khiến, mệnh đề quan hệ, câu ước và lời nói gián tiếp.',
    orderIndex: 80,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
  {
    code: 'grammar.discourse_emphasis',
    parentCode: 'grammar',
    cefrLevel: 'C1',
    isLeaf: false,
    titleEn: 'Academic Syntax, Inversion & Discourse',
    titleVi: 'Cú pháp Học thuật, Đảo ngữ & Tu từ (C1–C2)',
    summaryVi: 'Đảo ngữ, câu chẻ nhấn mạnh, thức giả định, tỉnh lược và cấu trúc tu từ bậc cao.',
    orderIndex: 90,
    formulas: [],
    usageNotes: [],
    examples: [],
  },
];

export const GRAMMAR_PREREQUISITE_EDGES: readonly GrammarPrerequisiteEdgeSeed[] = [
  // Tenses progression
  { prerequisiteCode: 'grammar.pronouns', targetCode: 'grammar.tenses.present_simple' },
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.tenses.present_continuous' },
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.tenses.past_simple' },
  { prerequisiteCode: 'grammar.tenses.present_continuous', targetCode: 'grammar.tenses.past_continuous' },
  { prerequisiteCode: 'grammar.tenses.past_simple', targetCode: 'grammar.tenses.past_continuous' },
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.tenses.future_forms' },
  { prerequisiteCode: 'grammar.tenses.past_simple', targetCode: 'grammar.tenses.present_perfect' },
  { prerequisiteCode: 'grammar.tenses.past_simple', targetCode: 'grammar.tenses.used_to_would' },
  { prerequisiteCode: 'grammar.tenses.present_perfect', targetCode: 'grammar.tenses.present_perfect_continuous' },
  { prerequisiteCode: 'grammar.tenses.future_forms', targetCode: 'grammar.tenses.future_continuous' },
  { prerequisiteCode: 'grammar.tenses.present_perfect', targetCode: 'grammar.tenses.past_perfect' },
  { prerequisiteCode: 'grammar.tenses.past_perfect', targetCode: 'grammar.tenses.past_perfect_continuous' },
  { prerequisiteCode: 'grammar.tenses.future_continuous', targetCode: 'grammar.tenses.future_perfect' },
  { prerequisiteCode: 'grammar.tenses.future_perfect', targetCode: 'grammar.tenses.future_perfect_continuous' },
  // Foundations & Modals progression
  { prerequisiteCode: 'grammar.nouns', targetCode: 'grammar.articles' },
  { prerequisiteCode: 'grammar.nouns', targetCode: 'grammar.quantifiers.countable_uncountable' },
  { prerequisiteCode: 'grammar.quantifiers.countable_uncountable', targetCode: 'grammar.quantifiers.some_any' },
  { prerequisiteCode: 'grammar.quantifiers.some_any', targetCode: 'grammar.quantifiers.much_many_alotof' },
  { prerequisiteCode: 'grammar.quantifiers.much_many_alotof', targetCode: 'grammar.quantifiers.few_little' },
  { prerequisiteCode: 'grammar.quantifiers.much_many_alotof', targetCode: 'grammar.quantifiers.all_most_some' },
  { prerequisiteCode: 'grammar.modals', targetCode: 'grammar.nuanced_modality' },
  // Questions progression
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.questions.yes_no' },
  { prerequisiteCode: 'grammar.questions.yes_no', targetCode: 'grammar.questions.wh' },
  { prerequisiteCode: 'grammar.questions.yes_no', targetCode: 'grammar.questions.tag' },
  { prerequisiteCode: 'grammar.questions.wh', targetCode: 'grammar.questions.indirect' },
  { prerequisiteCode: 'grammar.questions.wh', targetCode: 'grammar.questions.subject_object' },
  // Comparisons progression
  { prerequisiteCode: 'grammar.comparatives_superlatives.as_as', targetCode: 'grammar.comparatives_superlatives.comparative_adjectives' },
  { prerequisiteCode: 'grammar.comparatives_superlatives.comparative_adjectives', targetCode: 'grammar.comparatives_superlatives.superlative_adjectives' },
  { prerequisiteCode: 'grammar.comparatives_superlatives.comparative_adjectives', targetCode: 'grammar.comparatives_superlatives.comparative_adverbs' },
  { prerequisiteCode: 'grammar.comparatives_superlatives.superlative_adjectives', targetCode: 'grammar.comparatives_superlatives.superlative_adverbs' },
  // Verb forms progression
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.verb_forms.gerunds' },
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.verb_forms.infinitives' },
  { prerequisiteCode: 'grammar.verb_forms.gerunds', targetCode: 'grammar.verb_forms.verbs_gerund' },
  { prerequisiteCode: 'grammar.verb_forms.infinitives', targetCode: 'grammar.verb_forms.verbs_infinitive' },
  { prerequisiteCode: 'grammar.verb_forms.verbs_gerund', targetCode: 'grammar.verb_forms.verbs_both' },
  { prerequisiteCode: 'grammar.verb_forms.verbs_infinitive', targetCode: 'grammar.verb_forms.verbs_both' },
  { prerequisiteCode: 'grammar.relative_clauses', targetCode: 'grammar.verb_forms.participles' },
  // Conditionals progression
  { prerequisiteCode: 'grammar.tenses.present_simple', targetCode: 'grammar.conditionals.zero' },
  { prerequisiteCode: 'grammar.tenses.future_forms', targetCode: 'grammar.conditionals.first' },
  { prerequisiteCode: 'grammar.conditionals.first', targetCode: 'grammar.conditionals.second' },
  { prerequisiteCode: 'grammar.conditionals.second', targetCode: 'grammar.conditionals.third' },
  { prerequisiteCode: 'grammar.tenses.past_perfect', targetCode: 'grammar.conditionals.third' },
  { prerequisiteCode: 'grammar.conditionals.third', targetCode: 'grammar.conditionals.mixed' },
  { prerequisiteCode: 'grammar.conditionals.second', targetCode: 'grammar.wish_clauses' },
  // Voice, Clauses & Discourse progression
  { prerequisiteCode: 'grammar.tenses.present_perfect', targetCode: 'grammar.passive_voice' },
  { prerequisiteCode: 'grammar.passive_voice', targetCode: 'grammar.causative_verbs' },
  { prerequisiteCode: 'grammar.conjunctions', targetCode: 'grammar.relative_clauses' },
  { prerequisiteCode: 'grammar.tenses.past_perfect', targetCode: 'grammar.reported_speech' },
  { prerequisiteCode: 'grammar.conditionals.third', targetCode: 'grammar.inversion' },
  { prerequisiteCode: 'grammar.relative_clauses', targetCode: 'grammar.cleft_sentences' },
  { prerequisiteCode: 'grammar.modals', targetCode: 'grammar.subjunctive' },
  { prerequisiteCode: 'grammar.subjunctive', targetCode: 'grammar.formulaic_subjunctive' },
  { prerequisiteCode: 'grammar.inversion', targetCode: 'grammar.fronting_emphasis' },
  { prerequisiteCode: 'grammar.verb_forms.participles', targetCode: 'grammar.ellipsis_substitution' },
];
