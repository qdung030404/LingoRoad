import type {
  NavItem,
  StatItem,
  FeatureItem,
  CatQuestionSimulation,
  ModelComparison,
  FaqItem,
} from '@/types/landing';

export const NAV_ITEMS: NavItem[] = [
  { label: 'Tính năng', href: '#features' },
  { label: 'Phương pháp học', href: '#methodology' },
  { label: 'Trải nghiệm thử', href: '#simulator' },
  { label: 'So sánh ưu việt', href: '#comparison' },
  { label: 'Hỏi đáp', href: '#faq' },
];

export const STATS_DATA: StatItem[] = [
  {
    id: 'cat-speed',
    value: '15 câu',
    label: 'Kiểm tra nhanh',
    description: 'Xác định chuẩn xác trình độ chỉ sau 10-15 phút thay vì làm đề thi dài 2 tiếng',
    badge: 'Nhanh chóng',
  },
  {
    id: 'cefr-span',
    value: 'A1 → C2',
    label: 'Chuẩn quốc tế CEFR',
    description: 'Bao quát trọn vẹn từ người mất gốc đến người muốn giao tiếp nâng cao',
    badge: 'Mọi cấp độ',
  },
  {
    id: 'fsrs-efficiency',
    value: '3x',
    label: 'Nhớ lâu hơn gấp 3 lần',
    description: 'Tự động nhắc ôn đúng thời điểm não bộ chuẩn bị quên, học đâu nhớ đó',
    badge: 'Ghi nhớ sâu',
  },
  {
    id: 'daily-commitment',
    value: '10 - 15p',
    label: 'Thời gian học mỗi ngày',
    description: 'Thiết kế bài học ngắn gọn, cực kỳ phù hợp cho người đi làm và học sinh bận rộn',
    badge: 'Tiết kiệm thời gian',
  },
];

export const FEATURES_DATA: FeatureItem[] = [
  {
    id: 'cat-test',
    iconName: 'target',
    tag: 'Đo trình độ nhanh',
    title: 'Kiểm tra thích ứng thông minh',
    subtitle: 'Biết đúng sức học chỉ sau 15 câu',
    description:
      'Đề thi tự động co giãn theo bạn: Bạn làm đúng thì câu sau khó dần lên, làm sai thì câu sau dễ lại. Chỉ cần 10–15 phút là biết bạn đang ở bậc nào (A1 đến C2) mà không cần làm đề dài mệt mỏi.',
    highlights: [
      'Đo đúng trình độ từ A1 đến C2 chuẩn quốc tế',
      'Không đoán mò, không áp lực như thi cử truyền thống',
      'Chỉ ra chính xác điểm mạnh và phần kiến thức cần bổ sung',
    ],
  },
  {
    id: 'dag-curriculum',
    iconName: 'gitBranch',
    tag: 'Lộ trình bài bản',
    title: 'Cây kỹ năng mở khóa như chơi game',
    subtitle: 'Học chắc từng bài, không lo hổng kiến thức',
    description:
      'Các bài học được liên kết logic từ nền móng đến nâng cao. Bạn chỉ mở khóa các cấu trúc phức tạp sau khi đã nắm vững căn bản, giúp bạn học đến đâu tự tin giao tiếp đến đó.',
    highlights: [
      'Lộ trình rõ ràng, biết trước từng bước cần học',
      'Tự động gợi ý ôn lại nếu phát hiện kiến thức gốc chưa vững',
      'Học từ dễ đến khó, không bị ngợp hay đuối sức',
    ],
  },
  {
    id: 'fsrs-engine',
    iconName: 'repeat',
    tag: 'Ghi nhớ sâu',
    title: 'Sổ tay từ vựng chống quên',
    subtitle: 'Nhớ lâu nhiều tháng với thời gian ôn tập ít nhất',
    description:
      'Thay vì chép phạt từ vựng kín vở, hệ thống theo dõi mức độ nhớ của từng từ và nhắc bạn ôn lại đúng lúc bạn chuẩn bị quên. Nhờ vậy, học từ nào là thuộc sâu từ đó vào trí nhớ dài hạn.',
    highlights: [
      'Nhắc ôn đúng "thời điểm vàng" trước khi quên',
      'Tiết kiệm 40% thời gian ôn bài vô ích mỗi ngày',
      'Từ khó được nhắc nhiều hơn, từ dễ tự động lùi lịch',
    ],
  },
  {
    id: 'ai-advisor',
    iconName: 'bot',
    tag: 'Gia sư 24/7',
    title: 'Gia sư AI tận tâm chỉ rõ lỗi sai',
    subtitle: 'Có người giải thích tỉ mỉ mỗi khi bạn làm sai',
    description:
      'Không chỉ báo "Sai rồi" kèm đáp án khô khan, gia sư AI sẽ phân tích bằng tiếng Việt vì sao bạn chọn nhầm, dịch nghĩa câu văn và đưa ra ví dụ tương tự để bạn sửa lỗi ngay tại chỗ.',
    highlights: [
      'Giải thích nhẹ nhàng, dễ hiểu như giáo viên kèm 1-1',
      'Nội dung chính xác, giải đáp thắc mắc bất kể ngày đêm',
      'Cung cấp câu ví dụ thực tế giúp bạn nhớ lâu hơn',
    ],
  },
  {
    id: 'speech-eval',
    iconName: 'mic',
    tag: 'Phát âm chuẩn',
    title: 'Luyện nói và sửa phát âm chuẩn bản xứ',
    subtitle: 'Tự tin luyện nói tiếng Anh mỗi ngày không sợ ngại',
    description:
      'AI lắng nghe giọng nói của bạn và soi từng âm tiết: chỉ rõ lỗi nuốt âm, phát âm thiếu phụ âm đuôi hay đặt sai trọng âm. Với bài viết, AI gợi ý cách diễn đạt mượt mà và tự nhiên hơn.',
    highlights: [
      'Chỉ rõ lỗi nuốt âm và sai trọng âm khi nói',
      'Hướng dẫn uốn lưỡi phát âm chuẩn từng từ',
      'Gợi ý cách dùng từ tự nhiên như người bản xứ',
    ],
  },
  {
    id: 'gamification',
    iconName: 'award',
    tag: 'Tạo cảm hứng',
    title: 'Học vui như chơi game & Thi đua mỗi tuần',
    subtitle: 'Biến việc học tiếng Anh thành niềm vui mỗi ngày',
    description:
      'Duy trì ngọn lửa học tập với chuỗi ngày liên tiếp (Streak), nhận huy hiệu thành tích, tích lũy điểm kinh nghiệm và so tài nhẹ nhàng cùng bạn bè trên bảng xếp hạng tuần.',
    highlights: [
      'Bảo vệ chuỗi ngày học nếu bận việc đột xuất',
      'Nhiệm vụ hàng ngày ngắn gọn, dễ dàng hoàn thành',
      'Nhận thưởng huy hiệu và thăng hạng giải đấu tuần',
    ],
  },
];

export const SIMULATION_QUESTIONS: CatQuestionSimulation[] = [
  {
    id: 'q1',
    question: 'She _____ to London three times before she finally decided to move there permanently.',
    cefrLevel: 'B1',
    thetaDifficulty: 0.2,
    options: ['had traveled', 'has traveled', 'was traveling', 'traveled'],
    correctAnswerIndex: 0,
    explanation: 'Hành động xảy ra và hoàn tất trước một mốc thời gian trong quá khứ ("before she decided") bắt buộc dùng thì Quá khứ hoàn thành (had + V3/ed).',
  },
  {
    id: 'q2-hard',
    question: 'Had it not been for his prompt intervention, the venture _____ in absolute ruin.',
    cefrLevel: 'B2',
    thetaDifficulty: 1.4,
    options: ['would culminate', 'would have culminated', 'culminated', 'had culminated'],
    correctAnswerIndex: 1,
    explanation: 'Cấu trúc đảo ngữ câu điều kiện loại 3 ("Had it not been for...") diễn tả giả định trái ngược với quá khứ. Mệnh đề chính dùng "would have + V3/ed".',
  },
  {
    id: 'q2-easy',
    question: 'My brother usually _____ coffee in the morning before going to work.',
    cefrLevel: 'A2',
    thetaDifficulty: -0.6,
    options: ['drink', 'drinks', 'is drinking', 'has drunk'],
    correctAnswerIndex: 1,
    explanation: 'Dấu hiệu trạng từ tần suất "usually" và chủ ngữ ngôi thứ 3 số ít ("My brother") yêu cầu động từ thì Hiện tại đơn thêm đuôi "-s".',
  },
];

export const COMPARISONS: ModelComparison[] = [
  {
    feature: '1. Kiểm tra trình độ đầu vào',
    traditional: 'Bắt làm đề thi tĩnh dài 60–90 phút, mệt mỏi, áp lực và dễ khoanh bừa.',
    lingoRoad: 'Chỉ 15 câu trong 10-15 phút: Tự động co giãn theo sức của bạn để tìm ra đúng trình độ thực tế.',
  },
  {
    feature: '2. Lộ trình bài học',
    traditional: 'Ai cũng học một giáo trình giống hệt nhau, bắt buộc học lại cả những gì bạn đã biết.',
    lingoRoad: 'Lộ trình được may đo riêng: Bỏ qua phần bạn đã giỏi, dồn thời gian củng cố phần bạn còn yếu.',
  },
  {
    feature: '3. Cách ghi nhớ từ vựng',
    traditional: 'Học vẹt, chép phạt nhiều lần nhưng cứ sau vài ngày là rơi rụng kiến thức.',
    lingoRoad: 'Hệ thống tự canh lúc bạn chuẩn bị quên để nhắc ôn lại, ôn 1 lần là nhớ sâu vào trí nhớ dài hạn.',
  },
  {
    feature: '4. Phản hồi khi làm sai bài tập',
    traditional: 'Chỉ báo "Sai rồi" kèm đáp án đúng khô khan, học viên tự đoán mò lý do.',
    lingoRoad: 'Gia sư AI phân tích tỉ mỉ vì sao bạn nhầm lẫn, dịch nghĩa chi tiết và cho ví dụ sửa lỗi ngay.',
  },
  {
    feature: '5. Luyện nói và sửa phát âm',
    traditional: 'Chỉ nghe máy đọc mẫu một chiều, không biết mình nói sai chỗ nào, nuốt âm ở đâu.',
    lingoRoad: 'AI lắng nghe bạn nói, soi từng âm tiết, chỉ rõ lỗi sai trọng âm và phụ âm cuối để bạn sửa kịp thời.',
  },
  {
    feature: '6. Cảm hứng và động lực học',
    traditional: 'Học khô khan, nhanh nản chí và thường bỏ dở chỉ sau 1–2 tuần đầu tiên.',
    lingoRoad: 'Học nhẹ nhàng như chơi game: Mở khóa từng ải, tích lũy chuỗi ngày học (Streak) và thi đua mỗi tuần.',
  },
];

export const FAQ_DATA: FaqItem[] = [
  {
    question: 'Tôi là người mất gốc tiếng Anh hoặc mới bắt đầu, có học được LingoRoad không?',
    answer:
      'Hoàn toàn phù hợp! Ngay khi tham gia, hệ thống sẽ cho bạn làm bài kiểm tra nhanh 15 câu hoặc cho phép bạn chọn bắt đầu từ con số 0 (trình độ A1). Các bài học được thiết kế trực quan, có phát âm giọng bản xứ và hình ảnh sinh động, đi từ những từ vựng căn bản nhất trong đời sống nên bạn sẽ không bao giờ cảm thấy bị áp lực hay quá tải.',
  },
  {
    question: 'Tại sao bài kiểm tra đầu vào chỉ cần 15 câu mà đo được đúng trình độ?',
    answer:
      'Đề thi của LingoRoad thông minh hơn đề thi trên giấy: Hệ thống liên tục quan sát câu trả lời của bạn. Nếu bạn trả lời đúng, câu kế tiếp sẽ khó hơn một chút; nếu bạn trả lời sai, câu kế tiếp sẽ dễ lại. Nhờ khả năng co giãn linh hoạt này, hệ thống sẽ nhanh chóng "khoanh vùng" chính xác năng lực thực tế của bạn chỉ sau 15–20 câu mà không cần bạn phải ngồi làm bài thi mệt mỏi suốt 2 tiếng.',
  },
  {
    question: 'Mỗi ngày tôi chỉ có 15 đến 20 phút rảnh thì có theo học kịp không?',
    answer:
      'Rất kịp và cực kỳ hiệu quả! Mỗi bài học trên LingoRoad được chia nhỏ thành các phiên học chỉ từ 5 đến 10 phút. Hơn nữa, hệ thống tự động lọc bỏ những kiến thức bạn đã nắm vững và chỉ nhắc ôn những từ bạn chuẩn bị quên, giúp bạn tiết kiệm tới 40% thời gian học so với cách học dàn trải thông thường.',
  },
  {
    question: 'Làm thế nào để LingoRoad giúp tôi không bị "học trước quên sau"?',
    answer:
      'Não bộ con người tự nhiên sẽ quên 70% thông tin mới sau vài ngày. LingoRoad ứng dụng quy luật trí nhớ để tính toán chuẩn xác thời điểm trí nhớ của bạn bắt đầu suy giảm và gửi thông báo nhắc bạn ôn lại đúng 1 lần. Ôn đúng "thời điểm vàng" này sẽ khóa từ vựng vào trí nhớ dài hạn, giúp bạn nhớ sâu mà không cần tốn công chép phạt.',
  },
  {
    question: 'Trợ lý AI giúp tôi sửa lỗi sai như thế nào trong lúc học?',
    answer:
      'Khi bạn làm sai một câu ngữ pháp hoặc phát âm chưa chuẩn, trợ lý AI không chỉ báo "Sai" rồi bỏ qua. AI sẽ giải thích cặn kẽ bằng tiếng Việt: phân tích vì sao bạn nhầm lẫn, dịch nghĩa câu văn, chỉ ra từ bạn nuốt âm hay sai trọng âm, và đưa ra một câu tương tự để bạn thực hành sửa ngay tại chỗ.',
  },
  {
    question: 'Tôi có thể tải và học LingoRoad trên những thiết bị nào?',
    answer:
      'LingoRoad có ứng dụng di động hoàn chỉnh cho cả điện thoại Android và iOS (iPhone/iPad). Toàn bộ dữ liệu bài học, chuỗi ngày chăm chỉ (Streak), điểm số và sổ tay từ vựng của bạn được đồng bộ xuyên suốt, giúp bạn có thể tranh thủ học mọi lúc mọi nơi.',
  },
];
