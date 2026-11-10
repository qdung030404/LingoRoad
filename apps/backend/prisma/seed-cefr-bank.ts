import "dotenv/config";
import {
  Prisma,
  PrismaClient,
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";

export const CEFR_SEED_VERSION = "cefr-v1";

export async function seedCefrBank(
  prisma: PrismaClient,
): Promise<{ groupsCount: number; itemsCount: number }> {
  let groupsCount = 0;

  // ==========================================
  // 1. READING: Grouped Items (Passage + Questions) - Level B1 (Part 3)
  // ==========================================
  const readingGroupB1 = await prisma.assessmentItemGroup.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {},
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      skill: AssessmentSkill.READING,
      title: "The Rise of Urban Farming in Modern Cities",
      cefrLevel: CefrLevel.B1,
      partNumber: 3,
      passage: `Urban farming has become an increasingly popular trend in major cities around the globe. As urban populations continue to expand, finding sustainable ways to produce fresh food close to consumers has turned into a necessity. Rooftop gardens, vertical farming units, and community plots are transforming unused concrete spaces into productive green areas.\n\nSupporters highlight numerous benefits. Firstly, local food production drastically reduces "food miles"—the distance food travels from farm to plate—thereby cutting transportation emissions. Secondly, city dwellers gain better access to nutritious produce. Moreover, community gardens foster social bonds among neighbors who work together.\n\nHowever, significant challenges persist. Space in metropolitan areas is notoriously expensive, and high initial setup costs for specialized vertical farming equipment can discourage investment. Nevertheless, with ongoing technological advancements, urban agriculture promises to be a vital component of future green cities.`,
      usageScope: ItemUsageScope.ALL,
    },
  });
  groupsCount++;

  const readingItemsB1 = [
    {
      externalId: "cefr-read-b1-001",
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "What is the main topic of the passage?",
      options: [
        "The financial problems of modern farmers",
        "The growth, benefits, and challenges of urban agriculture",
        "How to build rooftop gardens in suburban areas",
        "The history of food transportation emissions",
      ],
      correctOption:
        "The growth, benefits, and challenges of urban agriculture",
      explanation:
        "Đoạn văn giới thiệu xu hướng nông nghiệp đô thị, nêu các lợi ích giảm khí thải, gắn kết cộng đồng và những thách thức về chi phí.",
      irtA: 1.1,
      irtB: 0.1,
      irtC: 0.25,
    },
    {
      externalId: "cefr-read-b1-002",
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: 'According to the text, what does "food miles" refer to?',
      options: [
        "The speed at which food is transported",
        "The distance food travels from farm to consumer",
        "The cost of buying food in city supermarkets",
        "The amount of food eaten per person each year",
      ],
      correctOption: "The distance food travels from farm to consumer",
      explanation:
        'Trong bài nêu rõ: "food miles—the distance food travels from farm to plate".',
      irtA: 1.2,
      irtB: -0.2,
      irtC: 0.25,
    },
    {
      externalId: "cefr-read-b1-003",
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "What is mentioned as a major obstacle for urban farming?",
      options: [
        "Lack of interest from local residents",
        "Strict government regulations on pesticide use",
        "High setup expenses and expensive urban land",
        "A shortage of electricity in big cities",
      ],
      correctOption: "High setup expenses and expensive urban land",
      explanation:
        'Bài viết nêu: "Space in metropolitan areas is notoriously expensive, and high initial setup costs...".',
      irtA: 1.0,
      irtB: 0.2,
      irtC: 0.25,
    },
    {
      externalId: "cefr-read-b1-004",
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      type: ItemType.GAP_FILL,
      prompt:
        "Complete the sentence: Urban agriculture helps transform unused _______ areas into productive gardens.",
      options: ["concrete", "wooden", "fertile", "deserted"],
      correctOption: "concrete",
      explanation:
        'Dựa vào câu: "transforming unused concrete spaces into productive green areas".',
      irtA: 1.3,
      irtB: 0.3,
      irtC: 0.25,
    },
  ];

  // ==========================================
  // 2. LISTENING: Grouped Items (Audio + Transcript + Questions) - Level B2 (Part 2)
  // ==========================================
  const listeningGroupB2 = await prisma.assessmentItemGroup.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {},
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      skill: AssessmentSkill.LISTENING,
      title: "University Career Center Orientation Talk",
      cefrLevel: CefrLevel.B2,
      partNumber: 2,
      audioUrl:
        "https://cdn.lingoroad.com/media/audio/cefr/listening-b2-part2-talk.mp3",
      transcript: `Welcome everyone to the annual Career Development briefing. As final-year students, navigating the transition into the competitive job market can feel daunting. This semester, our department is launching three new initiatives. First, an automated AI resume critique tool that scans your CV for industry keywords. Second, monthly mock interviews conducted by alumni working in multinational tech companies. Finally, a series of networking sessions every Thursday evening. We strongly advise everyone to book appointments at least two weeks in advance, especially before the autumn recruitment fair starts in November.`,
      usageScope: ItemUsageScope.ALL,
    },
  });
  groupsCount++;

  const listeningItemsB2 = [
    {
      externalId: "cefr-list-b2-001",
      skillCode: "listening.detail",
      cefrLevel: CefrLevel.B2,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "Who is the speaker addressing in this orientation session?",
      options: [
        "First-year undergraduate students",
        "Final-year university students",
        "Alumni looking for academic staff positions",
        "Employers attending the job fair",
      ],
      correctOption: "Final-year university students",
      explanation:
        'Người nói bắt đầu bằng: "As final-year students, navigating the transition into the competitive job market...".',
      irtA: 1.1,
      irtB: 0.8,
      irtC: 0.25,
    },
    {
      externalId: "cefr-list-b2-002",
      skillCode: "listening.detail",
      cefrLevel: CefrLevel.B2,
      type: ItemType.MULTIPLE_CHOICE,
      prompt:
        "Which of the following is NOT one of the new initiatives mentioned?",
      options: [
        "An AI resume critique tool",
        "Guaranteed internship placements at tech companies",
        "Mock interviews with working alumni",
        "Thursday evening networking sessions",
      ],
      correctOption: "Guaranteed internship placements at tech companies",
      explanation:
        "Bài nói chỉ đề cập đến công cụ AI duyệt CV, phỏng vấn thử với cựu sinh viên, và các buổi giao lưu tối thứ Năm.",
      irtA: 1.3,
      irtB: 1.1,
      irtC: 0.25,
    },
    {
      externalId: "cefr-list-b2-003",
      skillCode: "listening.detail",
      cefrLevel: CefrLevel.B2,
      type: ItemType.MULTIPLE_CHOICE,
      prompt: "Why should students make appointments at least two weeks early?",
      options: [
        "The advisors take vacations during November",
        "High demand is expected before the autumn job fair",
        "It takes two weeks for the AI tool to process resumes",
        "University policy requires written permission from professors",
      ],
      correctOption: "High demand is expected before the autumn job fair",
      explanation:
        'Người nói giải thích: "book appointments at least two weeks in advance, especially before the autumn recruitment fair starts in November".',
      irtA: 1.2,
      irtB: 1.0,
      irtC: 0.25,
    },
  ];

  // ==========================================
  // 3. WRITING: Standalone Items (Essay & Letter) - Level A2, B1, B2
  // ==========================================
  const writingItems = [
    {
      externalId: "cefr-write-a2-001",
      skillCode: "writing.transactional_letter",
      cefrLevel: CefrLevel.A2,
      type: ItemType.ESSAY,
      prompt:
        "You recently stayed at a hotel in Hanoi and left your jacket in the room. Write an email (60-80 words) to the hotel receptionist. In your email: say who you are and when you stayed, describe your jacket, and ask how you can get it back.",
      rubricCriteria: {
        taskAchievement:
          "Viết đầy đủ 3 ý: thông tin lưu trú, miêu tả áo khoác, đề xuất cách nhận lại.",
        coherenceCohesion:
          "Có câu mở đầu và kết thúc thư lịch sự, liên kết cơ bản bằng and, but, because.",
        lexicalResource:
          "Sử dụng từ vựng chỉ màu sắc, đồ vật, ngày tháng phù hợp trình độ A2.",
        grammarAccuracy:
          "Sử dụng đúng thì quá khứ đơn (I stayed, I forgot) và câu hỏi đơn giản (Can you...?).",
        targetGrammars: [
          "Thì quá khứ đơn (Past Simple: stayed, forgot)",
          "Câu hỏi đề nghị lịch sự (Can you / Could you)",
          "Liên từ nối cơ bản (and, but, because)",
        ],
        wordCount: { min: 60, max: 100 },
      },
      irtA: 1.0,
      irtB: -0.9,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-a2-002",
      skillCode: "writing.transactional_letter",
      cefrLevel: CefrLevel.A2,
      type: ItemType.ESSAY,
      prompt:
        "You cannot go to an English class tomorrow evening. Write an email (50-70 words) to your English teacher, Mr. David. In your email: explain why you cannot attend the class, ask what homework you need to prepare, and state when you will hand in the assignment.",
      rubricCriteria: {
        taskAchievement:
          "Đủ 3 yêu cầu: lý do vắng mặt, hỏi bài tập về nhà, hẹn ngày nộp bài tập.",
        coherenceCohesion:
          "Mở đầu và kết thúc thư lịch sự (Dear Mr. David, Sincerely...), liên từ đơn giản (because, so, and).",
        lexicalResource:
          "Từ vựng về trường lớp, sức khỏe hoặc lý do cá nhân phù hợp bậc A2 (fever, appointment, homework, submit).",
        grammarAccuracy:
          "Thì hiện tại đơn, tương lai đơn (I will, I cannot come), câu hỏi lịch sự (Could you please tell me...?).",
        targetGrammars: [
          "Thì tương lai đơn & khuyết thiếu (will, cannot)",
          "Câu hỏi lịch sự trang trọng (Could you please...?)",
          "Liên từ chỉ nguyên nhân kết quả (because, so)",
        ],
        wordCount: { min: 50, max: 80 },
      },
      irtA: 1.0,
      irtB: -0.8,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-b1-001",
      skillCode: "writing.transactional_letter",
      cefrLevel: CefrLevel.B1,
      type: ItemType.ESSAY,
      prompt:
        "An English-speaking friend named Alex is planning to visit your hometown next month and has asked for your advice. Write an email (80-120 words) to Alex. In your email: suggest the best time to visit and why, recommend at least two interesting places to see, and advise on what local food to try.",
      rubricCriteria: {
        taskAchievement:
          "Đề cập đủ 3 ý: thời điểm du lịch lý tưởng kèm lý do, gợi ý ít nhất 2 địa điểm tham quan, và gợi ý món ăn địa phương nên thử.",
        coherenceCohesion:
          "Văn phong thân mật (Dear Alex / Hi Alex, Best wishes...), chuyển đoạn tự nhiên bằng từ nối (first, also, besides, if you have time).",
        lexicalResource:
          "Từ vựng về du lịch, phong cảnh, ẩm thực địa phương phù hợp Bậc B1 (specialty, breathtaking, atmospheric, recommend).",
        grammarAccuracy:
          "Sử dụng câu đề xuất (You should, I suggest that, Why don't you), thì tương lai và hiện tại đơn chính xác.",
        targetGrammars: [
          "Mẫu câu gợi ý & khuyên nhủ (You should, Why don't you, I recommend)",
          "Câu điều kiện loại 1 (If you visit..., you will see...)",
          "Trạng từ chỉ thứ tự và bổ sung (First, Besides, In addition)",
        ],
        wordCount: { min: 80, max: 130 },
      },
      irtA: 1.2,
      irtB: 0.1,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-b1-002",
      skillCode: "writing.transactional_letter",
      cefrLevel: CefrLevel.B1,
      type: ItemType.ESSAY,
      prompt:
        "You recently had a birthday dinner with your friends at a local restaurant, but you were very dissatisfied with the service and the food. Write a formal email (100-140 words) to the restaurant manager. In your email: state when and why you were there, explain what went wrong with the food and service, and state what action you expect the manager to take.",
      rubricCriteria: {
        taskAchievement:
          "Đầy đủ 3 nội dung: thời gian và mục đích bữa ăn, chi tiết sự cố món ăn/phục vụ, và yêu cầu bồi hoàn hoặc xin lỗi.",
        coherenceCohesion:
          "Văn phong lịch sự nhưng kiên quyết (Dear Manager, I am writing to express my disappointment...), kết thúc trang trọng (Yours sincerely).",
        lexicalResource:
          "Từ vựng phản ánh dịch vụ và phàn nàn (unacceptable, cold soup, delayed, compensation, apology).",
        grammarAccuracy:
          "Kết hợp thì quá khứ đơn, quá khứ tiếp diễn và câu điều kiện lịch sự (I would appreciate it if you could...).",
        targetGrammars: [
          "Thì quá khứ tiếp diễn kết hợp quá khứ đơn (While we were having dinner, ... happened)",
          "Cấu trúc yêu cầu lịch sự trang trọng (I would appreciate it if you could...)",
          "Thì hiện tại hoàn thành diễn tả trải nghiệm (We have never experienced...)",
        ],
        wordCount: { min: 100, max: 150 },
      },
      irtA: 1.3,
      irtB: 0.3,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-b2-001",
      skillCode: "writing.opinion_essay",
      cefrLevel: CefrLevel.B2,
      type: ItemType.ESSAY,
      prompt:
        "Some people argue that working from home brings more benefits for employees, while others believe that working in an office fosters better collaboration. Write an essay (220-260 words) discussing both views and give your own opinion.",
      rubricCriteria: {
        taskAchievement:
          "Thảo luận rõ cả hai quan điểm (lợi ích làm việc từ xa vs làm việc tại văn phòng) và khẳng định lập trường cá nhân.",
        coherenceCohesion:
          "Bố cục 4 đoạn rõ ràng (Mở bài, Thân bài 1, Thân bài 2, Kết luận), dùng từ nối học thuật (Furthermore, On the other hand, Consequently).",
        lexicalResource:
          "Dùng từ vựng phong phú về công việc và năng suất: flexibility, commute, synergy, isolation, productivity.",
        grammarAccuracy:
          "Cấu trúc câu phức, câu điều kiện, mệnh đề quan hệ chuẩn xác, ít lỗi chính tả.",
        targetGrammars: [
          "Mệnh đề nhượng bộ & tương phản (While, Whereas, On the other hand)",
          "Thể bị động khách quan (It is argued that... / can be observed)",
          "Mệnh đề quan hệ xác định và không xác định (which, who)",
        ],
        wordCount: { min: 220, max: 280 },
      },
      irtA: 1.4,
      irtB: 1.2,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-b2-002",
      skillCode: "writing.opinion_essay",
      cefrLevel: CefrLevel.B2,
      type: ItemType.ESSAY,
      prompt:
        "Some people believe that university education should be completely free for all students, while others think that students should pay tuition fees for higher education. Write an essay (180-220 words) discussing both views and give your own opinion.",
      rubricCriteria: {
        taskAchievement:
          "Phân tích cả hai mặt: lợi ích của việc miễn học phí đại học vs lý do cần thu học phí, và nêu rõ quan điểm cá nhân.",
        coherenceCohesion:
          "Bố cục bài luận học thuật chặt chẽ, luận điểm rõ ràng, sử dụng linh hoạt các liên từ (On the one hand, Conversely, In conclusion).",
        lexicalResource:
          "Vốn từ học thuật về giáo dục và kinh tế (tertiary education, financial burden, subsidy, equal opportunity, fiscal resources).",
        grammarAccuracy:
          "Sử dụng đa dạng câu bị động, câu phức, mệnh đề nhượng bộ (Although, Despite), cấu trúc đảo ngữ hoặc giả định.",
        targetGrammars: [
          "Cấu trúc nhượng bộ học thuật (Although, Despite the fact that)",
          "Thể bị động trong văn phong học thuật (Higher education should be subsidized)",
          "Câu điều kiện kết hợp (Mixed conditionals: If tuition were free...)",
        ],
        wordCount: { min: 180, max: 240 },
      },
      irtA: 1.5,
      irtB: 1.1,
      irtC: 0.0,
    },
    {
      externalId: "cefr-write-b2-003",
      skillCode: "writing.opinion_essay",
      cefrLevel: CefrLevel.B2,
      type: ItemType.ESSAY,
      prompt:
        "The widespread use of smartphones and social media has negatively affected personal relationships and face-to-face communication. To what extent do you agree or disagree? Write an essay (180-220 words) supporting your position with relevant reasons and examples.",
      rubricCriteria: {
        taskAchievement:
          "Đưa ra lập trường rõ ràng và phát triển các luận cứ hỗ trợ logic bằng ví dụ cụ thể về tác động của smartphone đến các mối quan hệ.",
        coherenceCohesion:
          "Phân đoạn mạch lạc, chuyển tiếp ý mượt mà giữa các luận điểm (First and foremost, Moreover, In addition, To summarize).",
        lexicalResource:
          "Từ vựng phong phú về công nghệ và giao tiếp xã hội (digital distraction, superficial connections, interpersonal skills, alienation).",
        grammarAccuracy:
          "Kiểm soát tốt thì hiện tại hoàn thành, câu phức nhiều mệnh đề, mệnh đề quan hệ xác định và không xác định.",
        targetGrammars: [
          "Thì hiện tại hoàn thành & hiện tại hoàn thành tiếp diễn (have transformed, have been decreasing)",
          "Mệnh đề quan hệ xác định và không xác định (which, who)",
          "Trạng từ liên kết luận điểm (First and foremost, Furthermore, Consequently)",
        ],
        wordCount: { min: 180, max: 240 },
      },
      irtA: 1.4,
      irtB: 1.3,
      irtC: 0.0,
    },
  ];

  // ==========================================
  // 4. SPEAKING: Standalone Prompts - Level B1 & C1
  // ==========================================
  const speakingItems = [
    {
      externalId: "cefr-speak-b1-001",
      skillCode: "speaking.solution_presentation",
      cefrLevel: CefrLevel.B1,
      type: ItemType.SPEAKING_PROMPT,
      prompt:
        "Situation: Your university is planning to improve student wellness. You have 3 options: building a new outdoor gym, providing free counseling services, or organizing weekly yoga classes. Which option do you think is best? Explain your reasons in 1.5 - 2 minutes.",
      rubricCriteria: {
        timeLimitSeconds: 120,
        preparationTimeSeconds: 60,
        minSpeakingSeconds: 90,
        maxSpeakingSeconds: 120,
        fluencyCoherence:
          "Nói liên tục trong 1.5 - 2 phút, ít ngập ngừng, có ý so sánh ưu nhược điểm của các lựa chọn.",
        pronunciation:
          "Phát âm rõ ràng, trọng âm từ và ngữ điệu câu cơ bản đúng.",
        lexicalResource:
          "Sử dụng từ vựng liên quan đến sức khỏe thể chất và tinh thần: mental health, fitness, stress relief, community.",
        grammarRange:
          "Sử dụng câu điều kiện loại 1/2 và các cấu trúc nêu quan điểm: In my opinion, I prefer... because...",
      },
      irtA: 1.1,
      irtB: 0.1,
      irtC: 0.0,
    },
    {
      externalId: "cefr-speak-c1-001",
      skillCode: "speaking.topic_argument",
      cefrLevel: CefrLevel.C1,
      type: ItemType.SPEAKING_PROMPT,
      prompt:
        'Topic: "Artificial intelligence in education will eventually make human teachers obsolete." Do you agree or disagree with this statement? Deliver a coherent argument (2 - 3 minutes) addressing educational ethics, empathy, and technological capability.',
      rubricCriteria: {
        timeLimitSeconds: 180,
        preparationTimeSeconds: 60,
        minSpeakingSeconds: 120,
        maxSpeakingSeconds: 180,
        fluencyCoherence:
          "Trình bày trôi chảy tự nhiên, lập luận sắc bén có chiều sâu và liên kết chặt chẽ.",
        pronunciation:
          "Ngữ điệu tự nhiên, nhấn nhá cảm xúc và nhịp điệu bản ngữ.",
        lexicalResource:
          "Từ vựng học thuật cao cấp: pedagogical nuance, emotional intelligence, personalized tutoring, ethical oversight.",
        grammarRange:
          "Biến hóa linh hoạt các cấu trúc ngữ pháp phức tạp, đảo ngữ, bị động kép.",
      },
      irtA: 1.5,
      irtB: 1.9,
      irtC: 0.0,
    },
  ];

  // Gom tất cả các câu hỏi vào transaction để thực thi atomic & tối ưu hiệu năng
  const itemOperations: Array<Prisma.PrismaPromise<unknown>> = [];

  for (let i = 0; i < readingItemsB1.length; i++) {
    const item = readingItemsB1[i];
    const itemData = {
      groupId: readingGroupB1.id,
      itemOrder: i + 1,
      bankVersion: CEFR_SEED_VERSION,
      skill: AssessmentSkill.READING,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      prompt: item.prompt,
      options: item.options,
      correctOption: item.correctOption,
      explanation: item.explanation,
      irtA: item.irtA,
      irtB: item.irtB,
      irtC: item.irtC,
    };
    itemOperations.push(
      prisma.assessmentItem.upsert({
        where: { externalId: item.externalId },
        update: itemData,
        create: {
          externalId: item.externalId,
          ...itemData,
        },
      }),
    );
  }

  for (let i = 0; i < listeningItemsB2.length; i++) {
    const item = listeningItemsB2[i];
    const itemData = {
      groupId: listeningGroupB2.id,
      itemOrder: i + 1,
      bankVersion: CEFR_SEED_VERSION,
      skill: AssessmentSkill.LISTENING,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      prompt: item.prompt,
      options: item.options,
      correctOption: item.correctOption,
      explanation: item.explanation,
      irtA: item.irtA,
      irtB: item.irtB,
      irtC: item.irtC,
    };
    itemOperations.push(
      prisma.assessmentItem.upsert({
        where: { externalId: item.externalId },
        update: itemData,
        create: {
          externalId: item.externalId,
          ...itemData,
        },
      }),
    );
  }

  for (const item of writingItems) {
    const itemData = {
      bankVersion: CEFR_SEED_VERSION,
      skill: AssessmentSkill.WRITING,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      prompt: item.prompt,
      rubricCriteria: item.rubricCriteria,
      usageScope: ItemUsageScope.ALL,
      irtA: item.irtA,
      irtB: item.irtB,
      irtC: item.irtC,
    };
    itemOperations.push(
      prisma.assessmentItem.upsert({
        where: { externalId: item.externalId },
        update: itemData,
        create: {
          externalId: item.externalId,
          ...itemData,
        },
      }),
    );
  }

  for (const item of speakingItems) {
    const itemData = {
      bankVersion: CEFR_SEED_VERSION,
      skill: AssessmentSkill.SPEAKING,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      prompt: item.prompt,
      rubricCriteria: item.rubricCriteria,
      usageScope: ItemUsageScope.ALL,
      irtA: item.irtA,
      irtB: item.irtB,
      irtC: item.irtC,
    };
    itemOperations.push(
      prisma.assessmentItem.upsert({
        where: { externalId: item.externalId },
        update: itemData,
        create: {
          externalId: item.externalId,
          ...itemData,
        },
      }),
    );
  }

  await prisma.$transaction(itemOperations);
  const itemsCount = itemOperations.length;

  return { groupsCount, itemsCount };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL to the target database.");
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!/^(lingoroad(_(demo|test))?|postgres)$/.test(databaseName)) {
    throw new Error(
      "Seed CLI only accepts databases named lingoroad, lingoroad_demo, lingoroad_test or postgres.",
    );
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedCefrBank(prisma);
    console.log(
      `Seeded CEFR Bank (${CEFR_SEED_VERSION}): ${result.groupsCount} groups, ${result.itemsCount} items.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "CEFR seed failed.");
    process.exitCode = 1;
  });
}
