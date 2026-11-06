export type AssessmentSkillType =
  "LISTENING" | "READING" | "WRITING" | "SPEAKING";
export type CefrLevelType = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface CanDoDescriptor {
  readonly skillCode: string;
  readonly skill: AssessmentSkillType;
  readonly cefrLevel: CefrLevelType;
  readonly name: string;
  readonly statementEn: string;
  readonly statementVi: string;
  readonly defaultIrtB: number;
}

export const CEFR_LEVELS: readonly CefrLevelType[] = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const;
export const ASSESSMENT_SKILLS: readonly AssessmentSkillType[] = [
  "LISTENING",
  "READING",
  "WRITING",
  "SPEAKING",
] as const;

export const CEFR_CAN_DO_DESCRIPTORS: readonly CanDoDescriptor[] = [
  // --- LISTENING ---
  {
    skillCode: "listening.identifying_facts",
    skill: "LISTENING",
    cefrLevel: "A1",
    name: "Nhận biết từ vựng quen thuộc",
    statementEn:
      "Can recognize familiar words and very basic phrases concerning oneself, family and immediate surroundings when people speak slowly.",
    statementVi:
      "Nhận biết từ vựng quen thuộc và các chỉ dẫn rất đơn giản khi người nói phát âm chậm và rõ ràng.",
    defaultIrtB: -2.0,
  },
  {
    skillCode: "listening.identifying_facts",
    skill: "LISTENING",
    cefrLevel: "A2",
    name: "Hiểu hội thoại ngắn thường nhật",
    statementEn:
      "Can understand phrases and highest frequency vocabulary related to areas of personal relevance (shopping, local geography, employment).",
    statementVi:
      "Hiểu các cụm từ và đoạn hội thoại ngắn trong bối cảnh mua sắm, gia đình, công việc gần gũi.",
    defaultIrtB: -1.0,
  },
  {
    skillCode: "listening.gist",
    skill: "LISTENING",
    cefrLevel: "B1",
    name: "Hiểu ý chính bài nói chuẩn mực",
    statementEn:
      "Can understand the main points of clear standard speech on familiar matters regularly encountered in work, school, leisure.",
    statementVi:
      "Hiểu ý chính các cuộc trò chuyện về công việc, trường học hoặc giải trí khi dùng ngôn ngữ chuẩn.",
    defaultIrtB: 0.0,
  },
  {
    skillCode: "listening.detail",
    skill: "LISTENING",
    cefrLevel: "B2",
    name: "Hiểu bài giảng & tin tức truyền hình",
    statementEn:
      "Can understand extended speech and lectures and follow even complex lines of argument provided the topic is reasonably familiar.",
    statementVi:
      "Hiểu bài giảng, bài nói dài và hầu hết các bản tin thời sự hoặc truyền hình chuẩn mực.",
    defaultIrtB: 1.0,
  },
  {
    skillCode: "listening.inference",
    skill: "LISTENING",
    cefrLevel: "C1",
    name: "Hiểu ngôn ngữ trừu tượng & thành ngữ",
    statementEn:
      "Can understand a wide range of demanding, longer texts and recognize implicit meaning in spoken discourse.",
    statementVi:
      "Hiểu các bài nói dài mang tính trừu tượng, chứa thành ngữ, hàm ý và tiếng lóng xã hội.",
    defaultIrtB: 1.8,
  },
  {
    skillCode: "listening.inference",
    skill: "LISTENING",
    cefrLevel: "C2",
    name: "Hiểu mọi phong cách nói bản xứ",
    statementEn:
      "Can understand any kind of spoken language, whether live or broadcast, even when delivered at fast native speed.",
    statementVi:
      "Hiểu trọn vẹn không gặp khó khăn trước bất kỳ loại ngôn ngữ nói nào, kể cả ở tốc độ nói nhanh của người bản ngữ.",
    defaultIrtB: 2.5,
  },

  // --- READING ---
  {
    skillCode: "reading.scanning",
    skill: "READING",
    cefrLevel: "A1",
    name: "Đọc biển báo & biểu mẫu cơ bản",
    statementEn:
      "Can understand very short, simple texts, for example on notices and posters or in catalogues.",
    statementVi:
      "Đọc biển báo ngắn, tên riêng, từ đơn, form thông tin và danh mục cơ bản.",
    defaultIrtB: -2.0,
  },
  {
    skillCode: "reading.scanning",
    skill: "READING",
    cefrLevel: "A2",
    name: "Đọc thư ngắn & thông tin thực tế",
    statementEn:
      "Can find specific, predictable information in simple everyday material such as advertisements, prospectuses, menus and timetables.",
    statementVi:
      "Tìm thông tin cụ thể trong tài liệu hàng ngày như thư ngắn, thực đơn, mẩu tin quảng cáo và lịch trình.",
    defaultIrtB: -1.0,
  },
  {
    skillCode: "reading.skimming",
    skill: "READING",
    cefrLevel: "B1",
    name: "Đọc văn bản sự kiện & cảm xúc",
    statementEn:
      "Can understand texts that consist mainly of high frequency everyday or job-related language and personal letters describing events.",
    statementVi:
      "Đọc văn bản thực tế, hiểu các sự kiện, cảm xúc và mong muốn cá nhân trong thư từ và báo chí phổ thông.",
    defaultIrtB: 0.0,
  },
  {
    skillCode: "reading.author_purpose",
    skill: "READING",
    cefrLevel: "B2",
    name: "Đọc báo cáo & lập luận tác giả",
    statementEn:
      "Can read articles and reports concerned with contemporary problems in which the writers adopt particular attitudes or viewpoints.",
    statementVi:
      "Đọc các bài báo hiện đại, phân tích lập luận, quan điểm và thái độ của tác giả đối với các vấn đề thời sự.",
    defaultIrtB: 1.0,
  },
  {
    skillCode: "reading.vocabulary_in_context",
    skill: "READING",
    cefrLevel: "C1",
    name: "Đọc văn bản học thuật & chuyên ngành",
    statementEn:
      "Can understand long and complex factual and literary texts, appreciating distinctions of style and specialized articles.",
    statementVi:
      "Đọc văn bản học thuật, kỹ thuật phức tạp với phong cách hành văn đa dạng và nhận biết sự khác biệt tinh tế.",
    defaultIrtB: 1.8,
  },
  {
    skillCode: "reading.vocabulary_in_context",
    skill: "READING",
    cefrLevel: "C2",
    name: "Đọc hiểu tài liệu chuyên sâu & pháp lý",
    statementEn:
      "Can read with ease virtually all forms of the written language, including abstract, structurally or linguistically complex texts.",
    statementVi:
      "Đọc hiểu mọi dạng văn bản phức tạp, bao gồm cả văn học cổ điển, hợp đồng hoặc văn bản pháp lý chuyên sâu.",
    defaultIrtB: 2.5,
  },

  // --- WRITING ---
  {
    skillCode: "writing.sentence_building",
    skill: "WRITING",
    cefrLevel: "A1",
    name: "Viết thiệp & điền biểu mẫu ngắn",
    statementEn:
      "Can write a short, simple postcard and fill in forms with personal details.",
    statementVi:
      "Viết thiệp chúc mừng ngắn, điền thông tin cá nhân cơ bản vào biểu mẫu.",
    defaultIrtB: -2.0,
  },
  {
    skillCode: "writing.transactional_letter",
    skill: "WRITING",
    cefrLevel: "A2",
    name: "Viết ghi chú & nhật ký ngắn",
    statementEn:
      "Can write short, simple notes and messages relating to matters in areas of immediate need.",
    statementVi:
      "Viết ghi chú ngắn (note), đoạn văn kể về sinh hoạt thường nhật và lời cảm ơn đơn giản.",
    defaultIrtB: -1.0,
  },
  {
    skillCode: "writing.transactional_letter",
    skill: "WRITING",
    cefrLevel: "B1",
    name: "Viết thư cá nhân & tường thuật sự kiện",
    statementEn:
      "Can write straightforward connected text on topics which are familiar or of personal interest.",
    statementVi:
      "Viết email, thư cá nhân, bài văn ngắn kết nối các chuỗi sự kiện và chia sẻ cảm xúc.",
    defaultIrtB: 0.0,
  },
  {
    skillCode: "writing.opinion_essay",
    skill: "WRITING",
    cefrLevel: "B2",
    name: "Viết bài luận quan điểm rõ ràng",
    statementEn:
      "Can write clear, detailed text on a wide range of subjects and present an essay or report evaluating advantages and disadvantages.",
    statementVi:
      "Viết bài luận rõ ràng, chi tiết, tổng hợp thông tin và phân tích ưu nhược điểm của các giải pháp.",
    defaultIrtB: 1.0,
  },
  {
    skillCode: "writing.cause_solution",
    skill: "WRITING",
    cefrLevel: "C1",
    name: "Viết văn bản học thuật chặt chẽ",
    statementEn:
      "Can write clear, well-structured text, expressing points of view at some length with complex synthesis.",
    statementVi:
      "Viết bài luận phân tích sâu, dùng từ học thuật, cấu trúc liên kết chặt chẽ và văn phong trang trọng.",
    defaultIrtB: 1.8,
  },
  {
    skillCode: "writing.cause_solution",
    skill: "WRITING",
    cefrLevel: "C2",
    name: "Soạn thảo văn bản nghiên cứu chuyên sâu",
    statementEn:
      "Can write clear, smoothly flowing text in an appropriate style and create complex reports or articles with logical structure.",
    statementVi:
      "Viết báo cáo học thuật, bài nghiên cứu với phong cách tinh tế, ngữ pháp và từ vựng chuẩn xác tuyệt đối.",
    defaultIrtB: 2.5,
  },

  // --- SPEAKING ---
  {
    skillCode: "speaking.personal_info",
    skill: "SPEAKING",
    cefrLevel: "A1",
    name: "Tương tác thông tin bản thân cơ bản",
    statementEn:
      "Can interact in a simple way provided the other person is prepared to repeat or rephrase things at a slower rate.",
    statementVi:
      "Trả lời câu hỏi đơn giản về bản thân, nơi ở, gia đình và những người quen biết.",
    defaultIrtB: -2.0,
  },
  {
    skillCode: "speaking.social_interaction",
    skill: "SPEAKING",
    cefrLevel: "A2",
    name: "Giao tiếp tình huống hàng ngày",
    statementEn:
      "Can communicate in simple and routine tasks requiring a simple and direct exchange of information on familiar topics.",
    statementVi:
      "Miêu tả người, hoàn cảnh sống, công việc và trao đổi thông tin trực tiếp bằng các mẫu câu đơn giản.",
    defaultIrtB: -1.0,
  },
  {
    skillCode: "speaking.solution_presentation",
    skill: "SPEAKING",
    cefrLevel: "B1",
    name: "Bày tỏ quan điểm & giải thích ngắn",
    statementEn:
      "Can enter unprepared into conversation on familiar topics, connect phrases to describe experiences and explain opinions.",
    statementVi:
      "Bày tỏ ý kiến cá nhân, kể lại câu chuyện hoặc trải nghiệm, giải thích lý do ngắn gọn.",
    defaultIrtB: 0.0,
  },
  {
    skillCode: "speaking.topic_argument",
    skill: "SPEAKING",
    cefrLevel: "B2",
    name: "Tranh luận lưu loát & tự nhiên",
    statementEn:
      "Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible.",
    statementVi:
      "Giao tiếp lưu loát, tự nhiên với người bản xứ, tích cực tham gia thảo luận và đưa ra lập luận chặt chẽ.",
    defaultIrtB: 1.0,
  },
  {
    skillCode: "speaking.topic_argument",
    skill: "SPEAKING",
    cefrLevel: "C1",
    name: "Thuyết trình linh hoạt & hiệu quả",
    statementEn:
      "Can express ideas fluently and spontaneously without much obvious searching for expressions, using language flexibly for social and academic purposes.",
    statementVi:
      "Thuyết trình lưu loát, linh hoạt, diễn đạt ý tưởng chuẩn xác mà không gặp trở ngại ngôn từ.",
    defaultIrtB: 1.8,
  },
  {
    skillCode: "speaking.topic_argument",
    skill: "SPEAKING",
    cefrLevel: "C2",
    name: "Diễn đạt xuất sắc & sắc thái tinh tế",
    statementEn:
      "Can take part effortlessly in any conversation or discussion and has a good familiarity with idiomatic expressions and colloquialisms.",
    statementVi:
      "Diễn đạt tự nhiên, chính xác, phân biệt rõ ràng các sắc thái nghĩa tinh tế trong mọi tình huống giao tiếp phức tạp.",
    defaultIrtB: 2.5,
  },
];

export function findDescriptors(
  skill?: AssessmentSkillType,
  cefrLevel?: CefrLevelType,
): readonly CanDoDescriptor[] {
  return CEFR_CAN_DO_DESCRIPTORS.filter((item) => {
    if (skill && item.skill !== skill) return false;
    if (cefrLevel && item.cefrLevel !== cefrLevel) return false;
    return true;
  });
}
