import { LearningUnitSeed } from './seed-learning-helpers';

export function loadLearningUnits(): LearningUnitSeed[] {
  return [
    {
      code: 'a1-unit-1',
      cefrLevel: 'A1',
      orderIndex: 1,
      title: 'Làm quen và giới thiệu',
      description: 'Chào hỏi, giới thiệu bản thân, nói số thứ tự và giờ',
    },
    {
      code: 'a1-unit-2',
      cefrLevel: 'A1',
      orderIndex: 2,
      title: 'Gia đình và đồ vật',
      description: 'Nói về gia đình, đồ vật và đồ ăn',
    },
    {
      code: 'a1-unit-3',
      cefrLevel: 'A1',
      orderIndex: 3,
      title: 'Thói quen và sở thích',
      description: 'Kể thói quen nghề nghiệp, sở thích và hỏi đáp đơn giản',
    },
    {
      code: 'a1-unit-4',
      cefrLevel: 'A1',
      orderIndex: 4,
      title: 'Nơi chốn và mua sắm',
      description: 'Hỏi đường, nói về nơi chốn và mua sắm',
    },
    {
      code: 'a2-unit-1',
      cefrLevel: 'A2',
      orderIndex: 1,
      title: 'Lịch hẹn và kế hoạch',
      description: 'Đọc thông báo đổi lịch và xác định việc cần làm',
    },
    {
      code: 'b1-unit-1',
      cefrLevel: 'B1',
      orderIndex: 1,
      title: 'Công việc và môi trường số',
      description: 'Đọc hiểu quy định làm việc kết hợp và trao đổi nơi công sở',
    },
    {
      code: 'b2-unit-1',
      cefrLevel: 'B2',
      orderIndex: 1,
      title: 'Đô thị và phát triển bền vững',
      description: 'Phân tích bài viết về không gian xanh và quy hoạch đô thị',
    },
    {
      code: 'b2-unit-2',
      cefrLevel: 'B2',
      orderIndex: 2,
      title: 'Những chuyến khám phá',
      description: 'Nghe trích đoạn sách nói về những chuyến đi và quan sát hiện trường.',
    },
    {
      code: 'c1-unit-1',
      cefrLevel: 'C1',
      orderIndex: 1,
      title: 'Tư duy phản biện và khoa học nhận thức',
      description: 'Đọc văn bản học thuật về sự chú ý và thói quen đọc sâu',
    },
    {
      code: 'c2-unit-1',
      cefrLevel: 'C2',
      orderIndex: 1,
      title: 'Ngôn ngữ học nhận thức và triết học khoa học',
      description: 'Phân tích chuyên sâu về mối tương quan giữa cấu trúc ngôn ngữ, ký ức và nhận thức luận',
    },
  ];
}
