import 'dotenv/config';
import { CefrLevel, LearningKind, Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent, LearningQuestion, LISTENING_SKILL_CODES, READING_SKILL_CODES, validateLearningContent } from '../src/modules/learning/learning.types';
import { validateListeningAudio } from '../src/modules/learning/listening-media';
import { loadListeningLesson } from './listening-content/load-listening';

export interface LearningUnitSeed {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}

export interface LearningSeed {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  contentVersion: number;
  unitCode: string;
  content: LearningContent;
}

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

const transcript = 'Hello! My name is Anna. I am twenty years old. I am from Hanoi. I am a student. I like reading books with my friends.';
const question = (
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
  extra?: Pick<LearningQuestion, 'evidence' | 'skillCode' | 'type'>,
): LearningQuestion => ({
  id, prompt, options: options.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
  correctOptionId: String.fromCharCode(65 + correctIndex), explanation, ...extra,
});

export function loadLearningContent(): LearningSeed[] {
  const readingMeta = (prefix: string, evidence: string, skillCode: LearningQuestion['skillCode'] = 'reading.scanning') =>
    prefix === 'reading' ? { evidence, skillCode } : undefined;
  const comprehension = (prefix: string) => [
    question(`${prefix}-1`, 'What is the speaker’s name?', ['Anna', 'Mai', 'Lan', 'Jane'], 0, 'Người nói tự giới thiệu: “My name is Anna.”',
      readingMeta(prefix, 'My name is Anna.')),
    question(`${prefix}-2`, 'Where is Anna from?', ['London', 'Hanoi', 'Paris', 'Tokyo'], 1, 'Anna nói “I am from Hanoi”, nên cô ấy đến từ Hà Nội.',
      readingMeta(prefix, 'I am from Hanoi.')),
    question(`${prefix}-3`, 'What does Anna do?', ['A doctor', 'A teacher', 'A student', 'A nurse'], 2, '“I am a student” có nghĩa là Anna là sinh viên.',
      readingMeta(prefix, 'I am a student.')),
    question(`${prefix}-4`, 'What does Anna like?', ['Running', 'Cooking', 'Dancing', 'Reading'], 3, 'Anna nói cô ấy thích đọc sách cùng bạn bè: “I like reading books with my friends.”',
      readingMeta(prefix, 'I like reading books with my friends.')),
    question(`${prefix}-5`, 'How old is Anna?', ['Twenty', 'Twelve', 'Thirty', 'Eighteen'], 0, '“I am twenty years old” nghĩa là Anna hai mươi tuổi.',
      readingMeta(prefix, 'I am twenty years old.')),
  ];
  const words = [
    ['mother', '/ˈmʌðə(r)/', 'mẹ', 'My mother is a teacher.', 'Mẹ tôi là giáo viên.'],
    ['father', '/ˈfɑːðə(r)/', 'bố', 'My father is a doctor.', 'Bố tôi là bác sĩ.'],
    ['sister', '/ˈsɪstə(r)/', 'chị/em gái', 'My sister is a student.', 'Chị tôi là sinh viên.'],
    ['brother', '/ˈbrʌðə(r)/', 'anh/em trai', 'My brother likes football.', 'Anh tôi thích bóng đá.'],
    ['grandmother', '/ˈɡrænmʌðə(r)/', 'bà', 'My grandmother is kind.', 'Bà tôi rất tốt bụng.'],
    ['grandfather', '/ˈɡrænfɑːðə(r)/', 'ông', 'My grandfather likes reading.', 'Ông tôi thích đọc sách.'],
    ['parents', '/ˈpeərənts/', 'bố mẹ', 'My parents live in Hanoi.', 'Bố mẹ tôi sống ở Hà Nội.'],
    ['family', '/ˈfæməli/', 'gia đình', 'I love my family.', 'Tôi yêu gia đình mình.'],
    ['daughter', '/ˈdɔːtə(r)/', 'con gái', 'Their daughter is five.', 'Con gái của họ năm tuổi.'],
    ['son', '/sʌn/', 'con trai', 'Their son is a student.', 'Con trai của họ là sinh viên.'],
  ];
  return [
    {
      code: 'grammar-pronouns-to-be', kind: 'GRAMMAR', title: 'Subject pronouns and “to be”', description: 'Đại từ nhân xưng, câu khẳng định, phủ định và câu hỏi với to be.', estimatedMinutes: 10, sortOrder: 1, contentVersion: 1, unitCode: 'a1-unit-1',
      content: {
        steps: [{
          id: 'grammar-theory', title: 'Đại từ nhân xưng và động từ to be',
          body: 'I → am; He / She / It → is; You / We / They → are.\n\nKhẳng định: Chủ ngữ + am / is / are.\nI am a student. She is a teacher. They are friends.\n\nPhủ định: Chủ ngữ + am / is / are + not.\nWe are not tired. He is not a doctor.\n\nCâu hỏi: Am / Is / Are + chủ ngữ …?\nIs she a teacher? Are you from Hanoi?\n\nTên một người như Lan dùng “is”.'
        }], questions: [
          question('grammar-1', 'I … a student.', ['am', 'is', 'are', 'be'], 0, 'Chủ ngữ “I” đi với “am”: I am a student.'),
          question('grammar-2', 'Lan … from Hanoi.', ['am', 'is', 'are', 'be'], 1, 'Lan là tên một người, tương đương “she”, nên dùng “is”.'),
          question('grammar-3', 'They … my friends.', ['am', 'is', 'are', 'be'], 2, 'Chủ ngữ số nhiều “They” đi với “are”.'),
          question('grammar-4', '… she a teacher?', ['Am', 'Are', 'Be', 'Is'], 3, 'Đảo “Is” lên trước “she” để tạo câu hỏi: Is she a teacher?'),
          question('grammar-5', 'We … not tired.', ['are', 'is', 'am', 'be'], 0, '“We” đi với “are”; câu phủ định là “We are not tired”.'),
        ]
      }
    },
    {
      code: 'vocabulary-family', kind: 'VOCABULARY', title: 'Family and relationships', description: 'Học 10 từ về gia đình qua phát âm và ví dụ, sau đó luyện tập.', estimatedMinutes: 10, sortOrder: 2, contentVersion: 1, unitCode: 'a1-unit-2',
      content: {
        steps: words.map(([word, phonetic, meaning, example, body]) => ({ id: `word-${word}`, title: word, word, phonetic, meaning, example, body, audioUrl: `/media/learning/v1/${word}.wav` })), questions: [
          question('vocabulary-1', 'My father and mother are my …', ['parents', 'sisters', 'brothers', 'sons'], 0, '“Parents” nghĩa là bố mẹ, gồm father và mother.'),
          question('vocabulary-2', 'My mother’s mother is my …', ['sister', 'grandmother', 'daughter', 'brother'], 1, 'Mẹ của mẹ là bà ngoại: “grandmother”.'),
          question('vocabulary-3', 'A daughter is a …', ['boy', 'father', 'girl', 'grandfather'], 2, '“Daughter” là con gái, vì vậy đáp án là “girl”.'),
          question('vocabulary-4', 'My parents have two children: me and a boy. The boy is my …', ['mother', 'sister', 'grandmother', 'brother'], 3, 'Cậu bé là người con trai còn lại của bố mẹ, tức anh/em trai: “brother”.'),
          question('vocabulary-5', 'A son is a …', ['boy', 'girl', 'mother', 'grandmother'], 0, '“Son” nghĩa là con trai, nên chọn “boy”.'),
        ]
      }
    },
    {
      code: 'reading-everyday-introductions', kind: 'READING', title: 'Everyday Introductions', description: 'Đọc đoạn tự giới thiệu và xác định thông tin tên, tuổi, quê quán và sở thích.', estimatedMinutes: 5, sortOrder: 3, contentVersion: 3, unitCode: 'a1-unit-1',
      content: { steps: [], coverImageUrl: '/media/learning/v1/images/scene-reading-introductions.jpg', passage: transcript, questions: comprehension('reading') }
    },
    {
      code: 'listening-greetings-introductions', kind: 'LISTENING', title: 'Greetings and Introductions', description: 'Nghe Anna tự giới thiệu. Được nghe lại và tua không giới hạn.', estimatedMinutes: 5, sortOrder: 4, contentVersion: 3, unitCode: 'a1-unit-1',
      content: { steps: [], audioUrl: '/media/learning/v1/listening.wav', coverImageUrl: '/media/learning/v1/images/scene-greetings.jpg', transcript, questions: comprehension('listening') }
    },
    {
      code: 'listening-first-class', kind: 'LISTENING', title: 'Checking Tomorrow’s Timetable',
      description: 'Nghe Noah và Lily hỏi về thời khóa biểu ngày mai với câu hỏi chọn tranh trực quan.',
      estimatedMinutes: 5, sortOrder: 49, contentVersion: 2, unitCode: 'a1-unit-1', content: loadListeningLesson('first-class')
    },
    {
      code: 'listening-campus-cafe', kind: 'LISTENING', title: 'At the campus café',
      description: 'Nghe hội thoại gọi món, kiểm tra từng câu rồi nghe lại lời thoại để chữa bài.',
      estimatedMinutes: 6, sortOrder: 50, contentVersion: 3, unitCode: 'a1-unit-2', content: loadListeningLesson('campus-cafe')
    },
    {
      code: 'listening-valkyrie', kind: 'LISTENING', title: 'Aboard the Valkyrie',
      description: 'Nghe hành trình đến Iceland qua giọng đọc của badey (LibriVox, Mini LibriSpeech, CC BY 4.0).',
      estimatedMinutes: 5, sortOrder: 51, contentVersion: 3, unitCode: 'b2-unit-2', content: loadListeningLesson('valkyrie')
    },
    {
      code: 'listening-underground', kind: 'LISTENING', title: 'A Walk Underground',
      description: 'Theo lối xuống hầm mỏ qua giọng đọc của aquielisunari (LibriVox, Mini LibriSpeech, CC BY 4.0).',
      estimatedMinutes: 6, sortOrder: 52, contentVersion: 3, unitCode: 'b2-unit-2', content: loadListeningLesson('underground')
    },
    {
      code: 'reading-a2-club-meeting', kind: 'READING', title: 'A New Time for the Club Meeting',
      description: 'Đọc email đổi lịch câu lạc bộ và xác định thời gian, địa điểm cùng việc cần làm.',
      estimatedMinutes: 5, sortOrder: 5, contentVersion: 5, unitCode: 'a2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-book-club.jpg',
        steps: [],
        passage: [
          'Subject: A new time for our book club meeting',
          'Hi everyone,',
          'The school library is closed on Wednesday afternoon, so we can’t meet there at 4 p.m. as planned. Let’s meet on Thursday at 3:30 p.m. in Room 12 instead. The room is next to the school office.',
          'Please bring the book you’re reading now. You don’t need to finish it before the meeting. We’ll each have two minutes to talk about our book.',
          'If you can’t come on Thursday, please email me by Wednesday evening. I’ll send you a list of the books we talk about.',
          'See you soon,\nMaya',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a2-kv-1', word: 'as planned', phonetic: '/æz plænd/', meaning: 'như đã dự kiến', example: 'Our weekend picnic started on time as planned.', translation: 'Buổi dã ngoại cuối tuần của chúng tôi đã bắt đầu đúng giờ như dự kiến.' },
          { id: 'a2-kv-2', word: 'instead', phonetic: '/ɪnˈsted/', meaning: 'thay vào đó', example: 'We took the morning bus instead of walking in the rain.', translation: 'Chúng tôi đi xe buýt buổi sáng thay vì đi bộ dưới mưa.' },
          { id: 'a2-kv-3', word: 'office', phonetic: '/ˈɒfɪs/', meaning: 'văn phòng', example: 'Her desk sits near a sunny window inside the main office.', translation: 'Bàn làm việc của cô ấy đặt cạnh cửa sổ nắng trong văn phòng chính.' },
          { id: 'a2-kv-4', word: 'finish', phonetic: '/ˈfɪnɪʃ/', meaning: 'hoàn thành, đọc xong', example: 'He hopes to finish his science homework before dinner.', translation: 'Cậu ấy hy vọng làm xong bài tập khoa học trước bữa tối.' },
        ],
        questions: [
          question('club-meeting-purpose', 'Why did Maya write this email?',
            ['To invite students to join a new club', 'To tell members about a change to their meeting', 'To ask the school office for a room', 'To share a list of books'], 1,
            'Maya viết “Let’s meet on Thursday … in Room 12 instead” để báo giờ và nơi họp mới cho các thành viên.',
            { skillCode: 'reading.skimming', evidence: 'Subject: A new time for our book club meeting' }),
          question('club-meeting-when', 'When is the new meeting?',
            ['Wednesday at 3:30 p.m.', 'Wednesday at 4 p.m.', 'Thursday at 4 p.m.', 'Thursday at 3:30 p.m.'], 3,
            'Lịch mới là “Thursday at 3:30 p.m.” Giờ 4 p.m. thứ Tư là lịch cũ.',
            { skillCode: 'reading.scanning', evidence: 'Let’s meet on Thursday at 3:30 p.m. in Room 12 instead.' }),
          question('club-meeting-where', 'Where should members go for the meeting?',
            ['Room 12', 'The school library', 'The school office', 'The library entrance'], 0,
            'Maya hẹn gặp “in Room 12”. Văn phòng trường chỉ là mốc để tìm phòng.',
            { skillCode: 'reading.scanning', evidence: 'in Room 12 instead. The room is next to the school office.' }),
          question('club-meeting-book', 'Leo hasn’t finished his book. What should he do?',
            ['Leave the book at home', 'Finish it before Thursday', 'Bring the book he is reading', 'Choose a different book'], 2,
            '“Please bring the book you’re reading now” yêu cầu mang sách đang đọc. “You don’t need to finish it” cho biết Leo có thể mang sách dù chưa đọc xong.',
            { skillCode: 'reading.scanning', evidence: 'Please bring the book you’re reading now. You don’t need to finish it before the meeting.' }),
          question('club-meeting-reply', 'What should a member do if they can’t come?',
            ['Go to the library on Wednesday', 'Email Maya by Wednesday evening', 'Call the school office on Thursday', 'Send Maya a list of books'], 1,
            'Maya viết “If you can’t come on Thursday, please email me by Wednesday evening.” Chính Maya sẽ gửi danh sách sách sau buổi họp.',
            { skillCode: 'reading.scanning', evidence: 'If you can’t come on Thursday, please email me by Wednesday evening.' }),
        ],
      },
    },
    {
      code: 'reading-a2-weekend-market', kind: 'READING', title: 'Thông báo chợ cuối tuần ở công viên',
      description: 'Đọc thông báo địa điểm, giờ mở cửa và lưu ý khi tham gia phiên chợ địa phương.',
      estimatedMinutes: 5, sortOrder: 6, contentVersion: 2, unitCode: 'a2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-weekend-market.jpg',
        steps: [],
        passage: [
          'Notice: Riverside Weekend Market',
          'Starting this Sunday, our weekly food and craft market is moving outdoors to Oak Park because the old train hall is being painted. The market will be open from 8:00 a.m. to 1:00 p.m. You can reach the park easily by taking Bus 14 to Green Street.',
          'Local farmers will sell fresh fruit, honey, and homemade cheese, and three neighborhood bakers will bring warm bread at 9:00 a.m. Please bring your own cloth bag, as stalls will only offer paper bags for a small fee.',
          'If it rains heavily on Sunday morning, the market will move inside the community hall next door. Anyone who wants to rent a small table must send a message to the market office by Friday noon.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a2m-kv-1', word: 'outdoors', phonetic: '/ˌaʊtˈdɔːz/', meaning: 'ngoài trời', example: 'People enjoy walking in the fresh air outdoors during spring.' },
          { id: 'a2m-kv-2', word: 'homemade', phonetic: '/ˌhəʊmˈmeɪd/', meaning: 'tự làm ở nhà', example: 'My grandmother makes delicious homemade jam every summer.' },
          { id: 'a2m-kv-3', word: 'stall', phonetic: '/stɔːl/', meaning: 'quầy hàng (ở chợ)', example: 'Each vegetable stall opens early in the morning.' },
          { id: 'a2m-kv-4', word: 'rent', phonetic: '/rent/', meaning: 'thuê', example: 'Small shops can rent a wooden table for one morning.' },
        ],
        questions: [
          question('weekend-market-why-move', 'Why is the market moving to Oak Park this Sunday?',
            ['Bus 14 stops only near Oak Park', 'The old train hall is being painted', 'Oak Park is open all night long', 'More farmers asked for larger tables'], 1,
            'Thông báo ghi rõ lý do chuyển ra Oak Park là vì nhà ga cũ đang được sơn sửa: “because the old train hall is being painted.”',
            { skillCode: 'reading.scanning', evidence: 'Starting this Sunday, our weekly food and craft market is moving outdoors to Oak Park because the old train hall is being painted.' }),
          question('weekend-market-hours', 'What time does warm bread arrive at the market?',
            ['At 8:00 a.m.', 'At 9:00 a.m.', 'At 1:00 p.m.', 'At Friday noon'], 1,
            'Chợ mở cửa lúc 8:00 a.m., nhưng ba thợ làm bánh địa phương sẽ mang bánh mì nóng tới lúc 9:00 a.m.',
            { skillCode: 'reading.scanning', evidence: 'three neighborhood bakers will bring warm bread at 9:00 a.m.' }),
          question('weekend-market-bag', 'What are visitors asked to bring with them?',
            ['A paper cup for warm drinks', 'A small umbrella from home', 'Their own cloth bag', 'Bus tickets for Green Street'], 2,
            'Thông báo nhắc khách nên tự mang túi vải (“Please bring your own cloth bag”) vì quầy hàng thu phí nhỏ nếu lấy túi giấy.',
            { skillCode: 'reading.scanning', evidence: 'Please bring your own cloth bag, as stalls will only offer paper bags for a small fee.' }),
          question('weekend-market-rain', 'What will happen if it rains heavily on Sunday morning?',
            ['The market will wait until next weekend', 'Stalls will close earlier at 10:00 a.m.', 'The market will move inside the community hall next door', 'Visitors will receive free paper bags'], 2,
            'Nếu mưa lớn vào sáng Chủ nhật, phiên chợ sẽ chuyển vào hội trường cộng đồng ngay bên cạnh.',
            { skillCode: 'reading.scanning', evidence: 'If it rains heavily on Sunday morning, the market will move inside the community hall next door.' }),
          question('weekend-market-table', 'Who needs to send a message to the market office by Friday noon?',
            ['Bus drivers working on Bus 14', 'Anyone wishing to rent a table at the market', 'Customers wanting warm bread at 9:00 a.m.', 'Painters working inside the train hall'], 1,
            'Bất kỳ ai muốn thuê một bàn bán hàng nhỏ đều phải nhắn cho ban quản lý chợ trước trưa thứ Sáu.',
            { skillCode: 'reading.main_idea', evidence: 'Anyone who wants to rent a small table must send a message to the market office by Friday noon.' }),
        ],
      },
    },
    {
      code: 'reading-a2-library-pickup', kind: 'READING', title: 'Picking Up a Library Book',
      description: 'Đọc thông báo của thư viện để tìm giờ nhận sách và hiểu cần làm gì nếu đến muộn.',
      estimatedMinutes: 5, sortOrder: 7, contentVersion: 2, unitCode: 'a2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-library-desk.jpg',
        steps: [],
        passage: [
          'Notice: Collecting Your Library Books',
          'Did you order a book from Westfield Library? When it is ready, we will send you a text message. Go to the help desk on the ground floor and show your library card. The desk is open until 6 p.m. on weekdays and until 2 p.m. on Saturdays.',
          'We will keep your book for three days after we send the message. After that, we may give it to the next person on the list. If you need more time, call us before the three days are over. Please do not reply to the text message, because the library cannot read replies.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a2lp-kv-1', word: 'collect', meaning: 'đến lấy, đến nhận', example: 'Lena will collect her repaired bike tomorrow.' },
          { id: 'a2lp-kv-2', word: 'weekday', meaning: 'ngày trong tuần (thứ Hai đến thứ Sáu)', example: 'I take the bus to class on weekdays.' },
          { id: 'a2lp-kv-3', word: 'reply', meaning: 'trả lời', example: 'Please reply to my email when you have time.' },
        ],
        questions: [
          question('library-pickup-purpose', 'What is the main purpose of the notice?',
            ['To ask readers to return books early', 'To explain how to pick up an ordered book', 'To invite readers to buy old books', 'To describe a new library building'], 1,
            'Thông báo giải thích người đã đặt sách sẽ nhận tin nhắn và làm thủ tục nhận sách như thế nào.',
            { skillCode: 'reading.main_idea', evidence: 'Did you order a book from Westfield Library? When it is ready, we will send you a text message.' }),
          question('library-pickup-card', 'What should readers show at the help desk?',
            ['Their phone charger', 'A list of books to return', 'A printed form', 'Their library card'], 3,
            'Người đọc cần xuất trình thẻ thư viện tại quầy hỗ trợ.',
            { skillCode: 'reading.scanning', evidence: 'Go to the help desk on the ground floor and show your library card.' }),
          question('library-pickup-saturday', 'When does the help desk close on Saturdays?',
            ['At 2 p.m.', 'At 3 p.m.', 'At 5 p.m.', 'At 6 p.m.'], 0,
            'Quầy đóng cửa lúc 2 giờ chiều thứ Bảy. Mốc 6 giờ chiều áp dụng cho ngày trong tuần.',
            { skillCode: 'reading.scanning', evidence: 'The desk is open until 6 p.m. on weekdays and until 2 p.m. on Saturdays.' }),
          question('library-pickup-contact', 'How should readers ask the library to hold a book longer?',
            ['Visit Westfield on a Sunday', 'Send a reply to the text', 'Call before the three days end', 'Put a note in the book'], 2,
            'Nếu cần thêm thời gian, người đọc phải gọi cho thư viện trước khi hết ba ngày.',
            { skillCode: 'reading.scanning', evidence: 'If you need more time, call us before the three days are over.' }),
          question('library-pickup-late', 'Ivy received a message four days ago and did not call. Why should she check before going to the library?',
            ['Her book might now be for another reader', 'She needs to pay to enter the library', 'Her library card probably stopped working', 'Her book must be at a different library'], 0,
            'Ivy đã quá thời hạn giữ sách và chưa xin thêm thời gian, nên thư viện có thể đã chuyển sách cho người khác trong danh sách.',
            { skillCode: 'reading.inference', evidence: 'We will keep your book for three days after we send the message. After that, we may give it to the next person on the list.' }),
        ],
      },
    },
    {
      code: 'reading-b1-hybrid-workday', kind: 'READING', title: 'Lịch làm việc kết hợp của nhóm thiết kế',
      description: 'Đọc thông báo nội bộ về quy tắc làm việc từ xa và phối hợp tại văn phòng.',
      estimatedMinutes: 8, sortOrder: 8, contentVersion: 3, unitCode: 'b1-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-hybrid-office.jpg',
        steps: [
          {
            id: 'b1-pre-hybrid',
            title: 'Từ khóa trước khi đọc',
            word: 'hybrid arrangement',
            phonetic: '/ˈhaɪbrɪd əˈreɪndʒmənt/',
            meaning: 'hình thức làm việc kết hợp',
            body: 'Kết hợp ngày lên văn phòng cố định để phối hợp trực tiếp với ngày làm việc từ xa linh hoạt.',
            example: 'We are keeping the hybrid arrangement with two small changes.',
          },
          {
            id: 'b1-pre-onsite',
            title: 'Từ khóa trước khi đọc',
            word: 'on-site',
            phonetic: '/ˌɒn ˈsaɪt/',
            meaning: 'trực tiếp tại địa điểm làm việc',
            body: 'Chỉ hoạt động diễn ra tại văn phòng hoặc địa điểm của khách hàng thay vì làm từ xa.',
            example: 'Client teams sometimes request an on-site workshop at the office.',
          },
          {
            id: 'b1-pre-reserve',
            title: 'Từ khóa trước khi đọc',
            word: 'reserve',
            phonetic: '/rɪˈzɜːv/',
            meaning: 'đặt trước (chỗ ngồi, bàn làm việc)',
            body: 'Đăng ký giữ chỗ trước khi lên văn phòng để đảm bảo có đầy đủ thiết bị làm việc.',
            example: 'Staff can reserve a quiet desk near the window a day ahead.',
          },
        ],
        passage: [
          'Subject: Updated hybrid schedule for the Product Design team',
          'Hello team,',
          'After reviewing our three-month trial, we are keeping the hybrid arrangement with two small changes starting next Monday. Every member will still work in the office on Tuesdays and Thursdays so that sprint reviews and whiteboard critiques happen in person. Monday, Wednesday, and Friday remain flexible remote days, unless a client specifically requests an on-site workshop.',
          'To help everyone stay reachable without feeling overwhelmed by messages, we are introducing a shared core window from 10:00 a.m. to 3:00 p.m. During these hours, please respond to Slack threads within twenty minutes and keep your calendar up to date. Outside the core window, you are free to shift your deep-focus hours earlier or later to match your routine.',
          'One reminder about shared desks: please reserve a seat in the booking app before 6:00 p.m. the evening before you come in. If you forget, the front desk can assign a temporary spot on the fourth floor, though dual monitors are not guaranteed there.',
          'Best,\nHana',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'b1-kv-1', word: 'hybrid arrangement', phonetic: '/ˈhaɪbrɪd əˈreɪndʒmənt/', meaning: 'hình thức làm việc kết hợp', example: 'The company tested a flexible weekly schedule with shared office days.' },
          { id: 'b1-kv-2', word: 'reachable', phonetic: '/ˈriːtʃəbl/', meaning: 'dễ liên lạc được', example: 'Colleagues stayed reachable while working from different neighborhoods.' },
          { id: 'b1-kv-3', word: 'reserve', phonetic: '/rɪˈzɜːv/', meaning: 'đặt trước', example: 'Visitors should reserve a meeting seat at least one evening ahead.' },
          { id: 'b1-kv-4', word: 'temporary', phonetic: '/ˈtemprəri/', meaning: 'tạm thời', example: 'New team members use a temporary pass during their first week.' },
        ],
        questions: [
          question('hybrid-main-purpose', 'What is the main purpose of Hana’s announcement?',
            ['To introduce a completely remote policy for designers', 'To confirm the hybrid model with two adjustments for the team', 'To move all client workshops to Friday afternoons', 'To replace Slack with calendar invitations'], 1,
            'Hana cho biết nhóm vẫn giữ mô hình kết hợp sau giai đoạn thử nghiệm kèm hai điều chỉnh nhỏ áp dụng từ thứ Hai tới.',
            { skillCode: 'reading.main_idea', evidence: 'After reviewing our three-month trial, we are keeping the hybrid arrangement with two small changes starting next Monday.' }),
          question('hybrid-office-days', 'When must all design team members come to the office under the regular schedule?',
            ['Mondays and Fridays', 'Tuesdays and Thursdays', 'Wednesdays and Fridays', 'Every weekday morning'], 1,
            'Thông báo nêu rõ mọi thành viên vẫn làm việc tại văn phòng vào thứ Ba và thứ Năm để họp sprint review và góp ý trực tiếp.',
            { skillCode: 'reading.scanning', evidence: 'Every member will still work in the office on Tuesdays and Thursdays so that sprint reviews and whiteboard critiques happen in person.' }),
          question('hybrid-core-window', 'What is expected of team members between 10:00 a.m. and 3:00 p.m.?',
            ['Booking a temporary desk on the fourth floor', 'Turning off Slack notifications for deep work', 'Replying to Slack messages within twenty minutes and updating calendars', 'Attending daily on-site client workshops'], 2,
            'Trong khung giờ cốt lõi từ 10 giờ sáng đến 3 giờ chiều, nhân viên cần phản hồi các chuỗi Slack trong vòng 20 phút và cập nhật lịch.',
            { skillCode: 'reading.scanning', evidence: 'During these hours, please respond to Slack threads within twenty minutes and keep your calendar up to date.' }),
          question('hybrid-context-window', 'What does the phrase “core window” refer to in the second paragraph?',
            ['The hours when everyone agrees to be responsive', 'A new glass meeting room near the front desk', 'The software used to reserve dual monitors', 'A mandatory office lunch break'], 0,
            'Dựa vào ngữ cảnh, “core window” là khoảng thời gian chung (10:00–15:00) để cả nhóm dễ liên lạc với nhau trước khi tự điều chỉnh giờ làm việc tập trung ngoài khung này.',
            { skillCode: 'reading.context_clues', evidence: 'To help everyone stay reachable without feeling overwhelmed by messages, we are introducing a shared core window from 10:00 a.m. to 3:00 p.m.' }),
          question('hybrid-inference-monitors', 'What can be inferred if a designer arrives at the office without reserving a desk the evening before?',
            ['They will be asked to work from home instead.', 'They can still get a seat, though it might lack dual monitors.', 'They must wait until 10:00 a.m. to enter the fourth floor.', 'They will automatically receive a permanent desk next week.'], 1,
            'Quầy lễ tân vẫn có thể sắp xếp chỗ ngồi tạm ở tầng 4 cho người quên đặt trước, nhưng không đảm bảo có màn hình kép như chỗ đặt chuẩn.',
            { skillCode: 'reading.inference', evidence: 'If you forget, the front desk can assign a temporary spot on the fourth floor, though dual monitors are not guaranteed there.' }),
          question('hybrid-gap-booking', 'Before 6:00 p.m., designers should reserve a shared desk using the _____.',
            ['booking app', 'front desk', 'calendar thread', 'whiteboard'], 0,
            'Thông báo dặn đặt chỗ qua ứng dụng đặt bàn trước 6 giờ tối hôm trước: “reserve a seat in the booking app before 6:00 p.m.”',
            { type: 'GAP_FILL', skillCode: 'reading.scanning', evidence: 'please reserve a seat in the booking app before 6:00 p.m. the evening before you come in.' }),
        ],
      },
    },
    {
      code: 'reading-b2-urban-pocket-parks', kind: 'READING', title: 'Công viên bỏ túi giữa lòng đô thị',
      description: 'Đọc bài phân tích về cách các khoảng xanh nhỏ cải thiện vi khí hậu và gắn kết cư dân.',
      estimatedMinutes: 10, sortOrder: 9, contentVersion: 4, unitCode: 'b2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-pocket-park.jpg',
        steps: [
          {
            id: 'b2-pre-municipal',
            title: 'Từ vựng trọng tâm trước khi đọc',
            word: 'municipal',
            phonetic: '/mjuːˈnɪsɪpl/',
            meaning: 'thuộc chính quyền đô thị',
            body: 'Tính từ dùng để chỉ cơ quan quản lý hoặc quy hoạch ở cấp thành phố, đô thị.',
            example: 'Municipal teams often redesign narrow corners between busy roads.',
          },
          {
            id: 'b2-pre-permeable',
            title: 'Từ vựng trọng tâm trước khi đọc',
            word: 'permeable',
            phonetic: '/ˈpɜːmiəbl/',
            meaning: 'thấm nước được',
            body: 'Mô tả bề mặt hoặc vật liệu cho phép nước mưa thấm xuống đất thay vì chảy tràn.',
            example: 'Dense tree canopies and permeable paving lower surface temperatures on surrounding blocks.',
          },
          {
            id: 'b2-pre-footprint',
            title: 'Từ vựng trọng tâm trước khi đọc',
            word: 'footprint',
            phonetic: '/ˈfʊtprɪnt/',
            meaning: 'diện tích chiếm dụng',
            body: 'Khoảng không gian mặt bằng thực tế mà một công trình hoặc khu vực sử dụng.',
            example: 'A small garden takes up less footprint than a traditional city square.',
          },
        ],
        passage: [
          'In densely built cities, securing hectares of open land for a major park is rarely realistic. Yet municipal planners have increasingly turned to “pocket parks”—green spaces often no larger than a single building plot—wedged between apartment blocks and commercial streets. Because they occupy vacant corners or underused parking strips, these compact plots require a fraction of the land and budget needed for traditional recreational grounds.',
          'Their modest footprint belies measurable environmental gains. Dense tree canopies and permeable paving lower surface temperatures on surrounding blocks by two to three degrees Celsius during heatwaves, while rain gardens absorb sudden downpours before stormwater drains overflow. For older residents and young families who cannot easily travel across town to a botanical garden, a shaded bench five minutes from home turns daily greenery from an occasional excursion into an accessible routine.',
          'Still, pocket parks are not immune to neglect. Sites designed solely for visual appeal—such as manicured lawns enclosed by decorative fences—tend to sit empty and accumulate litter. By contrast, pocket parks co-designed with neighborhood associations pair practical ecological benefits with everyday access—offering movable seating, drinking fountains, and clear sightlines from nearby storefronts to foster informal social oversight that keeps the space lively and safe.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'b2-kv-1', word: 'municipal', phonetic: '/mjuːˈnɪsɪpl/', meaning: 'thuộc chính quyền đô thị', example: 'Municipal offices manage public lighting and street trees.' },
          { id: 'b2-kv-2', word: 'permeable', phonetic: '/ˈpɜːmiəbl/', meaning: 'thấm nước được', example: 'Gravel walkways are more permeable than concrete plazas.' },
          { id: 'b2-kv-3', word: 'footprint', phonetic: '/ˈfʊtprɪnt/', meaning: 'diện tích chiếm dụng', example: 'Corner libraries fit well within a compact street footprint.' },
          { id: 'b2-kv-4', word: 'oversight', phonetic: '/ˈəʊvəsaɪt/', meaning: 'sự quan sát, giám sát tự nhiên', example: 'Open windows facing the lane provide informal neighborhood oversight.' },
        ],
        questions: [
          question('pocket-main-idea', 'What is the central point of the passage?',
            ['Large botanical gardens should replace smaller neighborhood parks.', 'Small urban parks offer practical environmental and social benefits when designed with community input.', 'City planners are eliminating street parking in every commercial district.', 'Decorative fences are the best way to protect new city trees.'], 1,
            'Toàn bài phân tích lợi ích vi khí hậu và khả năng tiếp cận hằng ngày của công viên bỏ túi tại đô thị chật hẹp, đồng thời nhấn mạnh vai trò đồng thiết kế của cộng đồng.',
            { skillCode: 'reading.main_idea', evidence: 'By contrast, pocket parks co-designed with neighborhood associations pair practical ecological benefits with everyday access—offering movable seating, drinking fountains, and clear sightlines from nearby storefronts to foster informal social oversight that keeps the space lively and safe.' }),
          question('pocket-environment-detail', 'How do pocket parks help cities cope with heavy rainfall?',
            ['By channeling water directly onto commercial streets', 'By using rain gardens to absorb sudden downpours', 'By replacing apartment roofs with wooden benches', 'By locking drainage gates during heatwaves'], 1,
            'Bài viết nêu rõ các vườn mưa (rain gardens) trong công viên nhỏ giúp thấm lượng mưa lớn đột ngột trước khi hệ thống thoát nước bị quá tải.',
            { skillCode: 'reading.text_structure', evidence: 'while rain gardens absorb sudden downpours before stormwater drains overflow.' }),
          question('pocket-context-belies', 'In the second paragraph, the word “belies” is closest in meaning to which of the following?',
            ['disproves the expectation created by', 'depends completely upon', 'publicly advertises', 'gradually weakens'], 0,
            'Cụm “Their modest footprint belies measurable environmental gains” nhấn mạnh diện tích khiêm tốn dễ khiến người ta đánh giá thấp tác động thực tế, tức đi ngược lại ấn tượng nhỏ bé ban đầu.',
            { skillCode: 'reading.context_clues', evidence: 'Their modest footprint belies measurable environmental gains.' }),
          question('pocket-author-purpose', 'Why does the author mention manicured lawns with decorative fences in the final paragraph?',
            ['To praise low-maintenance landscaping in business districts', 'To illustrate a design choice that discourages everyday community use', 'To explain why botanical gardens cost more than parking strips', 'To recommend keeping pets out of newly planted areas'], 1,
            'Tác giả đưa ra ví dụ bãi cỏ cắt tỉa có hàng rào trang trí để đối lập, cho thấy thiết kế chỉ chú trọng hình thức khiến cư dân ngại sử dụng và nơi đó dễ bị bỏ hoang.',
            { skillCode: 'reading.author_purpose', evidence: 'Sites designed solely for visual appeal—such as manicured lawns enclosed by decorative fences—tend to sit empty and accumulate litter.' }),
          question('pocket-inference-safety', 'What does the author imply makes a pocket park feel safer and livelier?',
            ['Installing taller brick walls around apartment blocks', 'Limiting access to members of neighborhood associations', 'Active community involvement and visibility from nearby shops', 'Restricting opening hours to morning commutes'], 2,
            'Sự tham gia đồng thiết kế cùng tầm nhìn thông thoáng từ các cửa hàng xung quanh tạo ra sự quan sát tự nhiên từ cộng đồng, giúp công viên vừa sống động vừa an toàn.',
            { skillCode: 'reading.inference', evidence: 'foster informal social oversight that keeps the space lively and safe.' }),
          question('pocket-tfng-maintenance', 'Pocket parks cost more per square meter to maintain than major botanical gardens.',
            ['True', 'False', 'Not Given'], 2,
            'Bài viết chỉ đề cập công viên bỏ túi cần ít đất và ngân sách tổng thể hơn khu vui chơi truyền thống, không so sánh chi phí bảo trì trên mỗi mét vuông với vườn bách thảo.',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.fact_opinion' }),
        ],
      },
    },
    {
      code: 'reading-c1-deep-reading-attention', kind: 'READING', title: 'Đọc sâu trong kỷ nguyên phân mảnh chú ý',
      description: 'Đọc bài luận học thuật về tác động của thói quen đọc lướt đối với tư duy phản biện.',
      estimatedMinutes: 12, sortOrder: 10, contentVersion: 3, unitCode: 'c1-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-deep-reading.jpg',
        steps: [
          {
            id: 'c1-pre-paraphrase',
            title: 'Từ vựng học thuật trọng tâm',
            word: 'paraphrase',
            phonetic: '/ˈpærəfreɪz/',
            meaning: 'diễn giải lại bằng lời của chính mình',
            body: 'Tóm tắt lại lập luận của tác giả theo cách diễn đạt cá nhân để kiểm tra mức độ hiểu sâu.',
            example: 'Students are encouraged to pause and paraphrase dense sections in the margins.',
          },
          {
            id: 'c1-pre-skepticism',
            title: 'Từ vựng học thuật trọng tâm',
            word: 'skepticism',
            phonetic: '/ˈskeptɪsɪzəm/',
            meaning: 'thái độ hoài nghi phản biện',
            body: 'Khả năng dừng lại kiểm chứng lập luận thay vì chấp nhận vội vàng thông tin trên màn hình.',
            example: 'Readers should approach sweeping headlines with measured skepticism.',
          },
          {
            id: 'c1-pre-metacognitive',
            title: 'Từ vựng học thuật trọng tâm',
            word: 'metacognitive',
            phonetic: '/ˌmetəˈkɒɡnətɪv/',
            meaning: 'thuộc siêu nhận thức (tự điều chỉnh cách học)',
            body: 'Nhận biết và chủ động chọn tốc độ, phương pháp đọc phù hợp với từng loại văn bản.',
            example: 'Stronger metacognitive habits help learners slow down on unfamiliar essays.',
          },
        ],
        passage: [
          'Digital interfaces train readers to optimize for speed. Facing an endless stream of notifications and headlines, we instinctively adopt an “F-shaped” scanning pattern—grasping the opening lines, darting down the left margin for keywords, and abandoning dense paragraphs before an argument finishes unfolding. Far from being a trivial habit, cognitive scientists warn that this constant triage gradually reshapes how the brain approaches complex prose.',
          'Unlike spoken language, deep reading is not an evolutionary inheritance; it is a fragile neural circuit built only through sustained effort. When readers engage slowly with nuanced arguments, the brain recruits regions responsible for analogical reasoning, perspective-taking, and quiet skepticism. Skimming serves a clear purpose when locating a train timetable or verifying a statistic, yet applying the same hurried reflex to essays or research reports leaves readers vulnerable to flattened reasoning and plausible misinformation.',
          'Encouragingly, the remedy does not require abandoning screens altogether. Studies of university cohorts indicate that comprehension rebounds sharply when readers switch deliberately between reading modes: annotating key claims on printed pages or distraction-free readers, pausing after difficult sections to paraphrase an author’s logic, and reserving uninterrupted blocks of twenty minutes for challenging texts. Rather than resisting technology itself, cultivating metacognitive control over pace restores the patience that rigorous thought demands.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'c1-kv-1', word: 'paraphrase', phonetic: '/ˈpærəfreɪz/', meaning: 'diễn giải lại bằng lời của mình', example: 'Readers learn faster when they stop to paraphrase tricky claims.' },
          { id: 'c1-kv-2', word: 'fragile', phonetic: '/ˈfrædʒaɪl/', meaning: 'mong manh, cần rèn luyện giữ gìn', example: 'Sustained focus is a fragile habit during busy workdays.' },
          { id: 'c1-kv-3', word: 'skepticism', phonetic: '/ˈskeptɪsɪzəm/', meaning: 'thái độ hoài nghi phản biện', example: 'Healthy skepticism keeps researchers from trusting unverified claims.' },
          { id: 'c1-kv-4', word: 'metacognitive', phonetic: '/ˌmetəˈkɒɡnətɪv/', meaning: 'thuộc siêu nhận thức', example: 'Teachers build metacognitive awareness by asking learners to monitor their focus.' },
        ],
        questions: [
          question('deep-reading-purpose', 'What is the author’s primary purpose in this essay?',
            ['To advocate banning digital devices in university classrooms', 'To examine how hurried reading habits affect cognition and propose deliberate countermeasures', 'To prove that spoken language is more complex than written prose', 'To teach readers how to scan headlines faster during emergencies'], 1,
            'Tác giả phân tích hệ quả nhận thức của thói quen đọc lướt từ giao diện số và đề xuất chiến lược điều chỉnh nhịp đọc một cách có chủ đích.',
            { skillCode: 'reading.author_purpose', evidence: 'Rather than resisting technology itself, cultivating metacognitive control over pace restores the patience that rigorous thought demands.' }),
          question('deep-reading-fact-neuro', 'Which claim about deep reading does the author present as an established characteristic rather than a personal preference?',
            ['Deep reading is naturally hardwired in the brain like spoken speech.', 'Deep reading relies on a constructed neural circuit requiring sustained practice.', 'Everyone retains arguments better when reading on smartphones.', 'Printed newspapers always eliminate reader distraction.'], 1,
            'Tác giả nêu rõ đọc sâu không phải bản năng tiến hóa như ngôn ngữ nói mà là một mạch thần kinh mong manh được hình thành qua rèn luyện bền bỉ.',
            { skillCode: 'reading.fact_opinion', evidence: 'Unlike spoken language, deep reading is not an evolutionary inheritance; it is a fragile neural circuit built only through sustained effort.' }),
          question('deep-reading-context-triage', 'In the first paragraph, what does the phrase “constant triage” signify?',
            ['Memorizing every footnote inside a dense research report', 'Continuously sorting information rapidly to decide what deserves brief attention', 'Comparing translations of an academic book across languages', 'Designing calmer notification icons for mobile applications'], 1,
            'Ngữ cảnh dòng thông báo liên tục và kiểu quét chữ F cho thấy “constant triage” là việc phân loại, sàng lọc nhanh xem mẩu tin nào đáng liếc qua rồi bỏ dở đoạn văn dày đặc.',
            { skillCode: 'reading.context_clues', evidence: 'we instinctively adopt an “F-shaped” scanning pattern—grasping the opening lines, darting down the left margin for keywords, and abandoning dense paragraphs before an argument finishes unfolding.' }),
          question('deep-reading-inference-skimming', 'What nuanced stance does the author take toward skimming?',
            ['It should be completely eradicated from modern workplaces.', 'It is useful for targeted lookup tasks, provided readers do not treat it as universal.', 'It strengthens analogical reasoning more effectively than annotation.', 'It only impairs comprehension among older university students.'], 1,
            'Tác giả không phủ nhận hoàn toàn việc đọc lướt; tác giả công nhận nó hữu ích khi tra giờ tàu hay số liệu, chỉ phản đối việc áp dụng phản xạ vội vàng đó cho lập luận phức tạp.',
            { skillCode: 'reading.inference', evidence: 'Skimming serves a clear purpose when locating a train timetable or verifying a statistic, yet applying the same hurried reflex to essays or research reports leaves readers vulnerable to flattened reasoning and plausible misinformation.' }),
          question('deep-reading-critical', 'Which scenario best reflects the “metacognitive control over pace” recommended in the final paragraph?',
            ['Turning up screen brightness while scrolling through twenty news alerts', 'Using a speed-reading timer to halve the time spent on a philosophy chapter', 'Scanning a schedule for departure times, then switching to twenty minutes of uninterrupted annotation for a journal article', 'Listening to an audio summary at triple speed instead of reading the primary source'], 2,
            'Kiểm soát siêu nhận thức về tốc độ đọc thể hiện ở việc chọn đúng chế độ cho từng mục đích: đọc lướt khi tra lịch trình và dành 20 phút tập trung, ghi chú khi đọc văn bản học thuật khó.',
            { skillCode: 'reading.critical_reading', evidence: 'Studies of university cohorts indicate that comprehension rebounds sharply when readers switch deliberately between reading modes: annotating key claims on printed pages or distraction-free readers, pausing after difficult sections to paraphrase an author’s logic, and reserving uninterrupted blocks of twenty minutes for challenging texts.' }),
          question('deep-reading-gap-pattern', 'Endless alerts condition readers to use an “F-shaped” _____ pattern rather than reading deeply.',
            ['scanning', 'listening', 'printing', 'paraphrasing'], 0,
            'Đoạn đầu mô tả người đọc tự động dùng kiểu quét mắt chữ F (“an “F-shaped” scanning pattern”) trước dòng thông báo liên tục.',
            { type: 'GAP_FILL', skillCode: 'reading.context_clues', evidence: 'Facing an endless stream of notifications and headlines, we instinctively adopt an “F-shaped” scanning pattern' }),
          question('deep-reading-tfng-screens', 'The author argues that deep comprehension is impossible unless readers give up digital screens completely.',
            ['True', 'False', 'Not Given'], 1,
            'Tác giả bác bỏ quan điểm này và viết rõ giải pháp không đòi hỏi bỏ màn hình hoàn toàn: “the remedy does not require abandoning screens altogether.”',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.critical_reading', evidence: 'Encouragingly, the remedy does not require abandoning screens altogether.' }),
        ],
      },
    },
    {
      code: 'reading-a1-morning-bakery', kind: 'READING', title: 'Ordering Breakfast at Sunny Bakery',
      description: 'Đọc bảng thực đơn buổi sáng ở tiệm bánh để tìm món ăn, giá tiền và giờ mở cửa.',
      estimatedMinutes: 5, sortOrder: 11, contentVersion: 1, unitCode: 'a1-unit-2',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-bakery.jpg',
        steps: [],
        passage: [
          'Welcome to Sunny Bakery on Maple Street!',
          'We open every morning at 6:30 a.m. and close at 4:00 p.m. From Monday to Friday, you can buy our breakfast combo for five dollars. The combo includes one warm apple pie and a cup of hot milk or black coffee.',
          'On Saturdays, our baker makes fresh strawberry cakes at 8:00 a.m. Students with a school card get a free cookie with any drink. Please pay at the wooden counter near the door.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a1b-kv-1', word: 'bakery', phonetic: '/ˈbeɪkəri/', meaning: 'tiệm bánh', example: 'There is a small bakery near our school gate.', translation: 'Có một tiệm bánh nhỏ gần cổng trường chúng tôi.' },
          { id: 'a1b-kv-2', word: 'fresh', phonetic: '/freʃ/', meaning: 'tươi, mới ra lò', example: 'My mother buys fresh bread every Sunday.', translation: 'Mẹ tôi mua bánh mì mới ra lò vào mỗi Chủ nhật.' },
          { id: 'a1b-kv-3', word: 'counter', phonetic: '/ˈkaʊntə(r)/', meaning: 'quầy thanh toán', example: 'Please wait in line in front of the main counter.', translation: 'Vui lòng xếp hàng phía trước quầy chính.' },
        ],
        questions: [
          question('bakery-open-time', 'What time does Sunny Bakery open every morning?',
            ['At 4:00 p.m.', 'At 6:30 a.m.', 'At 8:00 a.m.', 'At 5:00 a.m.'], 1,
            'Tiệm bánh mở cửa lúc 6:30 sáng mỗi ngày: “We open every morning at 6:30 a.m.”',
            { skillCode: 'reading.scanning', evidence: 'We open every morning at 6:30 a.m. and close at 4:00 p.m.' }),
          question('bakery-combo-price', 'How much is the weekday breakfast combo?',
            ['Three dollars', 'Four dollars', 'Five dollars', 'Eight dollars'], 2,
            'Từ thứ Hai đến thứ Sáu, suất ăn sáng có giá 5 đô la.',
            { skillCode: 'reading.scanning', evidence: 'From Monday to Friday, you can buy our breakfast combo for five dollars.' }),
          question('bakery-combo-food', 'What food comes inside the breakfast combo?',
            ['One warm apple pie', 'A cheese sandwich', 'Two chocolate muffins', 'A bowl of soup'], 0,
            'Suất combo bao gồm một chiếc bánh táo ấm kèm sữa nóng hoặc cà phê đen.',
            { skillCode: 'reading.scanning', evidence: 'The combo includes one warm apple pie and a cup of hot milk or black coffee.' }),
          question('bakery-saturday-special', 'When are the strawberry cakes ready on Saturdays?',
            ['At 6:30 a.m.', 'At 8:00 a.m.', 'At 12:00 p.m.', 'At 4:00 p.m.'], 1,
            'Vào thứ Bảy, thợ làm bánh làm bánh dâu tây lúc 8:00 sáng.',
            { skillCode: 'reading.scanning', evidence: 'On Saturdays, our baker makes fresh strawberry cakes at 8:00 a.m.' }),
          question('bakery-student-gift', 'What can a student receive with a school card and a drink?',
            ['A free cookie', 'A bottle of juice', 'A paper bag', 'A discount ticket'], 0,
            'Học sinh có thẻ trường được tặng một chiếc bánh quy miễn phí khi mua đồ uống.',
            { skillCode: 'reading.scanning', evidence: 'Students with a school card get a free cookie with any drink.' }),
        ],
      },
    },
    {
      code: 'reading-a1-fitness-club', kind: 'READING', title: 'Welcome to Greenleaf Fitness Club',
      description: 'Đọc tờ hướng dẫn dành cho hội viên mới tại câu lạc bộ thể thao.',
      estimatedMinutes: 5, sortOrder: 12, contentVersion: 1, unitCode: 'a1-unit-3',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-fitness-club.jpg',
        steps: [],
        passage: [
          'Welcome to Greenleaf Fitness Club!',
          'Our gym is on the second floor, and the indoor swimming pool is on the first floor. Beginners can join the morning yoga class at 7:00 a.m. on Mondays and Wednesdays with Coach Sara.',
          'Please wear clean sports shoes inside the gym room. You can borrow a white towel at the reception desk for free, but please bring your own water bottle from home.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a1f-kv-1', word: 'beginner', phonetic: '/bɪˈɡɪnə(r)/', meaning: 'người mới bắt đầu', example: 'This swimming lesson is great for any beginner.', translation: 'Buổi học bơi này rất phù hợp cho người mới bắt đầu.' },
          { id: 'a1f-kv-2', word: 'borrow', phonetic: '/ˈbɒrəʊ/', meaning: 'mượn', example: 'Can I borrow your pencil for a minute?', translation: 'Tôi có thể mượn bút chì của bạn một lát không?' },
          { id: 'a1f-kv-3', word: 'towel', phonetic: '/ˈtaʊəl/', meaning: 'khăn bông', example: 'He put a dry towel in his sports bag.', translation: 'Anh ấy bỏ một chiếc khăn khô vào túi thể thao.' },
        ],
        questions: [
          question('fitness-pool-floor', 'Where is the indoor swimming pool located?',
            ['On the first floor', 'On the second floor', 'On the roof', 'Next to the bus stop'], 0,
            'Hồ bơi trong nhà nằm ở tầng một: “the indoor swimming pool is on the first floor.”',
            { skillCode: 'reading.scanning', evidence: 'Our gym is on the second floor, and the indoor swimming pool is on the first floor.' }),
          question('fitness-yoga-teacher', 'Who teaches the morning yoga class?',
            ['Coach David', 'Coach Sara', 'Coach Anna', 'Coach Leo'], 1,
            'Huấn luyện viên Sara dạy lớp yoga buổi sáng vào thứ Hai và thứ Tư.',
            { skillCode: 'reading.scanning', evidence: 'Beginners can join the morning yoga class at 7:00 a.m. on Mondays and Wednesdays with Coach Sara.' }),
          question('fitness-shoes-rule', 'What must members wear inside the gym room?',
            ['Clean sports shoes', 'A blue jacket', 'A swimming cap', 'Heavy boots'], 0,
            'Hội viên được yêu cầu mang giày thể thao sạch khi vào phòng tập.',
            { skillCode: 'reading.scanning', evidence: 'Please wear clean sports shoes inside the gym room.' }),
          question('fitness-bring-item', 'What should members bring from home?',
            ['A yoga mat', 'A folding chair', 'Their own water bottle', 'A locker key'], 2,
            'Hội viên có thể mượn khăn miễn phí tại quầy lễ tân nhưng cần tự mang bình nước cá nhân từ nhà.',
            { skillCode: 'reading.scanning', evidence: 'You can borrow a white towel at the reception desk for free, but please bring your own water bottle from home.' }),
          question('fitness-main-purpose', 'Who is this short guide written for?',
            ['People visiting or joining the fitness club', 'Doctors working at a city hospital', 'Drivers parking near a shopping mall', 'Chefs cooking in a restaurant'], 0,
            'Đoạn văn chào mừng và hướng dẫn vị trí tầng, lịch lớp yoga và quy định cho người tập tại Greenleaf Fitness Club.',
            { skillCode: 'reading.skimming', evidence: 'Welcome to Greenleaf Fitness Club!' }),
        ],
      },
    },
    {
      code: 'reading-a2-train-platform', kind: 'READING', title: 'Platform Change at Central Station',
      description: 'Đọc bảng thông báo đổi sân ga và dịch vụ xe buýt thay thế tại nhà ga trung tâm.',
      estimatedMinutes: 6, sortOrder: 13, contentVersion: 1, unitCode: 'a2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-train-notice.jpg',
        steps: [],
        passage: [
          'Passenger Notice: Express Train 402 to Harbor City',
          'Because of track repairs on Platform 3 this morning, Express Train 402 to Harbor City will now depart from Platform 7 at 9:45 a.m., fifteen minutes later than usual. Passengers can use the elevator near the ticket hall to cross over to Platform 7.',
          'Your original paper or mobile ticket is still valid, so you do not need to exchange it at the window. A staff member in a green vest will stand beside the escalator to help passengers with heavy luggage.',
          'Please note that the café car on Train 402 is closed today. Free bottles of water and light snacks are available at Customer Booth B before you board.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'a2t-kv-1', word: 'depart', phonetic: '/dɪˈpɑːt/', meaning: 'khởi hành', example: 'Morning coaches depart from the north gate every hour.', translation: 'Xe khách buổi sáng khởi hành từ cổng bắc mỗi giờ.' },
          { id: 'a2t-kv-2', word: 'valid', phonetic: '/ˈvælɪd/', meaning: 'còn hiệu lực, hợp lệ', example: 'Your student pass remains valid until the end of June.', translation: 'Thẻ sinh viên của bạn còn hiệu lực đến cuối tháng Sáu.' },
          { id: 'a2t-kv-3', word: 'luggage', phonetic: '/ˈlʌɡɪdʒ/', meaning: 'hành lý', example: 'Travellers kept their small luggage on the rack above.', translation: 'Hành khách để hành lý nhỏ trên giá phía trên.' },
          { id: 'a2t-kv-4', word: 'board', phonetic: '/bɔːd/', meaning: 'lên tàu, lên xe', example: 'Families with children may board the ferry first.', translation: 'Các gia đình có trẻ nhỏ được phép lên phà trước.' },
        ],
        questions: [
          question('train-platform-new', 'Which platform will Express Train 402 leave from today?',
            ['Platform 2', 'Platform 3', 'Platform 7', 'Platform 9'], 2,
            'Do sửa đường ray ở sân ga số 3, tàu tốc hành 402 sẽ khởi hành từ sân ga số 7.',
            { skillCode: 'reading.scanning', evidence: 'Because of track repairs on Platform 3 this morning, Express Train 402 to Harbor City will now depart from Platform 7 at 9:45 a.m.' }),
          question('train-ticket-action', 'What should passengers do with their original ticket?',
            ['Keep it because it works without any change', 'Trade it for a blue pass at the window', 'Pay an extra fee inside the elevator', 'Leave it at the ticket hall entrance'], 0,
            'Thông báo nêu rõ vé giấy hoặc vé điện thoại ban đầu vẫn hợp lệ, không cần đổi vé tại quầy.',
            { skillCode: 'reading.scanning', evidence: 'Your original paper or mobile ticket is still valid, so you do not need to exchange it at the window.' }),
          question('train-helper-vest', 'Who can help passengers carrying heavy bags?',
            ['The train driver on Platform 3', 'A staff member wearing a green vest', 'A cashier inside the café car', 'A security guard outside the station'], 1,
            'Nhân viên mặc áo ghi-lê màu xanh lá đứng cạnh thang cuốn sẽ hỗ trợ hành khách có hành lý nặng.',
            { skillCode: 'reading.scanning', evidence: 'A staff member in a green vest will stand beside the escalator to help passengers with heavy luggage.' }),
          question('train-free-water', 'Why are free water and snacks being offered at Customer Booth B?',
            ['The station is celebrating its anniversary', 'The café car on Train 402 is closed today', 'All restaurants in Harbor City are full', 'Passengers bought first-class seats'], 1,
            'Vì toa căng-tin trên tàu 402 hôm nay đóng cửa nên nhà ga phát nước và đồ ăn nhẹ miễn phí tại Quầy B trước khi lên tàu.',
            { skillCode: 'reading.inference', evidence: 'Please note that the café car on Train 402 is closed today. Free bottles of water and light snacks are available at Customer Booth B before you board.' }),
          question('train-usual-time', 'What time does Express Train 402 normally leave when there is no delay?',
            ['At 9:15 a.m.', 'At 9:30 a.m.', 'At 9:45 a.m.', 'At 10:00 a.m.'], 1,
            'Hôm nay tàu chạy lúc 9:45 sáng, muộn hơn thường lệ 15 phút (“fifteen minutes later than usual”), nghĩa là giờ khởi hành bình thường là 9:30 sáng.',
            { skillCode: 'reading.inference', evidence: 'at 9:45 a.m., fifteen minutes later than usual.' }),
        ],
      },
    },
    {
      code: 'reading-b1-repair-cafe', kind: 'READING', title: 'Cà phê sửa chữa đồ cũ trong khu phố',
      description: 'Đọc bài viết về mô hình cộng đồng cùng nhau sửa đồ gia dụng để giảm rác thải và học kỹ năng mới.',
      estimatedMinutes: 8, sortOrder: 14, contentVersion: 1, unitCode: 'b1-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-repair-cafe.jpg',
        steps: [
          {
            id: 'b1r-pre-discard',
            title: 'Từ khóa trước khi đọc',
            word: 'discard',
            phonetic: '/dɪˈskɑːd/',
            meaning: 'vứt bỏ, thải loại',
            body: 'Bỏ đi một món đồ khi không còn dùng nữa hoặc khi nó bị hỏng.',
            example: 'Many households discard small appliances that only have a loose wire.',
          },
          {
            id: 'b1r-pre-volunteer',
            title: 'Từ khóa trước khi đọc',
            word: 'volunteer',
            phonetic: '/ˌvɒlənˈtɪə(r)/',
            meaning: 'tình nguyện viên',
            body: 'Người tự nguyện đóng góp thời gian và kỹ năng để hỗ trợ cộng đồng.',
            example: 'Retired electricians volunteer their Saturday mornings at the workshop.',
          },
        ],
        passage: [
          'When a toaster stops heating or a desk lamp flickers, many consumers immediately buy a replacement because commercial repair shops charge more than the item is worth. To challenge this throwaway habit, residents in Eastbrook launched a monthly “Repair Café” inside the neighborhood community center.',
          'On the first Saturday of every month, volunteer technicians, seamstresses, and bicycle mechanics set up workbenches stocked with screwdrivers, soldering irons, and sewing machines. Visitors bring broken household items from home, sit beside a specialist, and learn how to diagnose the fault together. Rather than dropping off an object and leaving, owners actively participate in cleaning switches or stitching torn seams.',
          'Over the past year, the Eastbrook group has restored nearly four hundred items that would otherwise have ended up in landfills. While labour and tools are provided free of charge, visitors pay a small cost only if a replacement fuse or spare gear is needed from the parts box.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'b1r-kv-1', word: 'discard', phonetic: '/dɪˈskɑːd/', meaning: 'vứt bỏ', example: 'People often discard old gadgets too quickly.' },
          { id: 'b1r-kv-2', word: 'diagnose', phonetic: '/ˈdaɪəɡnəʊz/', meaning: 'chẩn đoán, tìm ra lỗi hỏng', example: 'A mechanic can diagnose engine noise in a few minutes.' },
          { id: 'b1r-kv-3', word: 'landfill', phonetic: '/ˈlændfɪl/', meaning: 'bãi chôn lấp rác', example: 'Recycling plastic bottles keeps waste out of the city landfill.' },
          { id: 'b1r-kv-4', word: 'spare', phonetic: '/speə(r)/', meaning: 'dự phòng, thay thế', example: 'Always carry a spare inner tube on long cycling trips.' },
        ],
        questions: [
          question('repair-why-replace', 'According to the first paragraph, why do many people buy new appliances instead of using commercial repair shops?',
            ['Repair shops are only open on Sunday evenings', 'Professional repairs often cost more than the appliance itself', 'New appliances use less electricity than repaired ones', 'Stores refuse to sell household lamps online'], 1,
            'Đoạn đầu giải thích nhiều người mua đồ mới ngay vì tiệm sửa dịch vụ thường tính phí cao hơn cả giá trị món đồ.',
            { skillCode: 'reading.scanning', evidence: 'many consumers immediately buy a replacement because commercial repair shops charge more than the item is worth.' }),
          question('repair-owner-role', 'How does the Repair Café differ from a traditional repair service?',
            ['Owners stay and take part in fixing their items alongside volunteers', 'Visitors must leave their broken items for two weeks', 'Only brand-new bicycles are accepted at the workbench', 'Technicians travel to each resident’s apartment'], 0,
            'Thay vì gửi đồ rồi ra về, chủ món đồ ngồi cạnh tình nguyện viên và trực tiếp tham gia tìm lỗi, vệ sinh công tắc hoặc khâu lại đường chỉ.',
            { skillCode: 'reading.main_idea', evidence: 'Rather than dropping off an object and leaving, owners actively participate in cleaning switches or stitching torn seams.' }),
          question('repair-context-throwaway', 'What does the phrase “throwaway habit” in the first paragraph refer to?',
            ['The tendency to discard broken goods instead of fixing them', 'A weekly schedule for collecting garden leaves', 'The practice of donating books to local schools', 'A rule requiring visitors to wear safety gloves'], 0,
            'Trong ngữ cảnh đồ vừa hỏng đã mua mới ngay, “throwaway habit” chỉ thói quen vứt bỏ đồ đạc thay vì sửa chữa.',
            { skillCode: 'reading.context_clues', evidence: 'To challenge this throwaway habit, residents in Eastbrook launched a monthly “Repair Café” inside the neighborhood community center.' }),
          question('repair-cost-rule', 'When do visitors have to pay money at the Eastbrook Repair Café?',
            ['Whenever they enter the community center on Saturday', 'Only when their item needs a new component from the parts box', 'If a repair takes longer than thirty minutes', 'When they borrow a screwdriver or sewing machine'], 1,
            'Công sức và dụng cụ hoàn toàn miễn phí; khách chỉ trả một khoản nhỏ nếu cần cầu chì hoặc linh kiện thay thế từ hộp phụ tùng.',
            { skillCode: 'reading.scanning', evidence: 'While labour and tools are provided free of charge, visitors pay a small cost only if a replacement fuse or spare gear is needed from the parts box.' }),
          question('repair-gap-landfill', 'In twelve months, the initiative saved almost four hundred household objects from _____ sites.',
            ['landfills', 'workbenches', 'commercial', 'switches'], 0,
            'Trong năm qua, nhóm đã cứu gần 400 món đồ khỏi bị chôn lấp ở bãi rác (“ended up in landfills”).',
            { type: 'GAP_FILL', skillCode: 'reading.scanning', evidence: 'Over the past year, the Eastbrook group has restored nearly four hundred items that would otherwise have ended up in landfills.' }),
        ],
      },
    },
    {
      code: 'reading-b1-sleeper-trains', kind: 'READING', title: 'Sự trở lại của những chuyến tàu đêm xuyên thành phố',
      description: 'Đọc bài báo về lý do nhiều hành khách chọn tàu giường nằm ban đêm thay cho các chuyến bay ngắn.',
      estimatedMinutes: 8, sortOrder: 15, contentVersion: 1, unitCode: 'b1-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-night-train.jpg',
        steps: [
          {
            id: 'b1s-pre-boarding',
            title: 'Từ khóa trước khi đọc',
            word: 'compartment',
            phonetic: '/kəmˈpɑːtmənt/',
            meaning: 'khoang tàu',
            body: 'Phòng hoặc khoang riêng có giường nằm trên các đoàn tàu đường dài.',
            example: 'Each sleeping compartment has a reading lamp and a folding table.',
          },
          {
            id: 'b1s-pre-emissions',
            title: 'Từ khóa trước khi đọc',
            word: 'emissions',
            phonetic: '/ɪˈmɪʃnz/',
            meaning: 'khí thải',
            body: 'Lượng khí carbon thải ra môi trường từ các phương tiện giao thông.',
            example: 'Electric rail lines cut travel emissions significantly compared with planes.',
          },
        ],
        passage: [
          'For decades, budget airlines dominated medium-distance travel between major cities, pushing overnight sleeper trains to the margins. Recently, however, rail operators have modernized their night fleets with quieter carriages, private capsules, and reliable Wi-Fi, attracting both business travellers and holidaymakers.',
          'The appeal goes beyond nostalgia. Although a flight itself may last ninety minutes, passengers often spend hours commuting to outskirts airports, queuing at security checkpoints, and waiting at baggage carousels. By contrast, an overnight train departs from a central station in the evening and arrives in the heart of the destination city by breakfast, saving the cost of a hotel night.',
          'Environmental awareness has also accelerated this shift. Transport researchers note that an electric sleeper train generates a small fraction of the carbon emissions produced by a short-haul jet per passenger. Still, rail companies face practical hurdles, including track fees and the difficulty of coordinating timetables across national borders.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'b1s-kv-1', word: 'nostalgia', phonetic: '/nɒˈstældʒə/', meaning: 'sự hoài niệm', example: 'Old photographs often fill travellers with warm nostalgia.' },
          { id: 'b1s-kv-2', word: 'outskirts', phonetic: '/ˈaʊtskɜːts/', meaning: 'vùng ngoại ô', example: 'Large factories are usually built on the outskirts of town.' },
          { id: 'b1s-kv-3', word: 'hurdle', phonetic: '/ˈhɜːdl/', meaning: 'rào cản, trở ngại', example: 'High ticket cost remains a hurdle for some young tourists.' },
        ],
        questions: [
          question('sleeper-main-idea', 'What does the article mainly discuss?',
            ['Why budget airlines are building new terminals in city centers', 'The reasons overnight trains are regaining popularity and the challenges they still face', 'How to apply for a job as an international train conductor', 'A history of steam locomotives in the nineteenth century'], 1,
            'Bài báo giải thích các yếu tố giúp tàu đêm được ưa chuộng trở lại (tiện nghi mới, đi từ trung tâm tới trung tâm, tiết kiệm đêm khách sạn, giảm khí thải) cùng những rào cản vận hành còn tồn tại.',
            { skillCode: 'reading.main_idea', evidence: 'Recently, however, rail operators have modernized their night fleets with quieter carriages, private capsules, and reliable Wi-Fi, attracting both business travellers and holidaymakers.' }),
          question('sleeper-advantage-city', 'What practical advantage do overnight trains offer over short flights?',
            ['They travel three times faster than commercial jets', 'They carry passengers directly between city centers while saving a hotel night', 'They allow passengers to bring unlimited motorbikes onboard', 'They never require passengers to buy a ticket in advance'], 1,
            'Tàu đêm xuất phát từ ga trung tâm vào buổi tối và tới thẳng trung tâm thành phố đích vào giờ ăn sáng, giúp tiết kiệm cả thời gian ra sân bay ngoại ô lẫn chi phí một đêm khách sạn.',
            { skillCode: 'reading.scanning', evidence: 'By contrast, an overnight train departs from a central station in the evening and arrives in the heart of the destination city by breakfast, saving the cost of a hotel night.' }),
          question('sleeper-context-margins', 'What does the author mean by saying sleeper trains were pushed “to the margins” in the first paragraph?',
            ['They became much less common and less important', 'They were painted with bright yellow stripes on the sides', 'They only operated inside mountain tunnels', 'They became the most profitable form of transport'], 0,
            'Khi hàng không giá rẻ thống trị các chặng tầm trung, tàu ngủ đêm bị đẩy ra bên lề (“to the margins”), tức bị thu hẹp và ít được sử dụng hơn.',
            { skillCode: 'reading.context_clues', evidence: 'For decades, budget airlines dominated medium-distance travel between major cities, pushing overnight sleeper trains to the margins.' }),
          question('sleeper-challenge', 'Which obstacle do rail operators still struggle with according to the final paragraph?',
            ['A shortage of coffee machines in central stations', 'Coordinating train schedules across different national borders', 'Passengers refusing to use onboard Wi-Fi', 'Airports banning buses from entering the outskirts'], 1,
            'Đoạn cuối chỉ rõ các công ty đường sắt vẫn gặp khó khăn về phí đường ray và việc phối hợp lịch trình xuyên biên giới các quốc gia.',
            { skillCode: 'reading.scanning', evidence: 'Still, rail companies face practical hurdles, including track fees and the difficulty of coordinating timetables across national borders.' }),
          question('sleeper-tfng-carbon', 'A short-haul jet produces fewer carbon emissions per passenger than an electric sleeper train.',
            ['True', 'False', 'Not Given'], 1,
            'Thông tin trong bài hoàn toàn ngược lại: tàu điện giường nằm chỉ tạo ra một phần nhỏ lượng khí thải carbon so với máy bay chặng ngắn tính trên mỗi hành khách.',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.fact_opinion', evidence: 'Transport researchers note that an electric sleeper train generates a small fraction of the carbon emissions produced by a short-haul jet per passenger.' }),
        ],
      },
    },
    {
      code: 'reading-b2-biophilic-workspaces', kind: 'READING', title: 'Kiến trúc ưa sinh học trong không gian làm việc hiện đại',
      description: 'Đọc bài phân tích về cách ánh sáng tự nhiên, vật liệu gỗ và cây xanh tác động tới hiệu suất nhận thức.',
      estimatedMinutes: 10, sortOrder: 16, contentVersion: 1, unitCode: 'b2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-biophilic-design.jpg',
        steps: [
          {
            id: 'b2b-pre-circadian',
            title: 'Từ vựng trọng tâm trước khi đọc',
            word: 'circadian rhythm',
            phonetic: '/sɜːˈkeɪdiən ˈrɪðəm/',
            meaning: 'nhịp sinh học ngày đêm',
            body: 'Chu kỳ sinh học tự nhiên kéo dài khoảng 24 giờ điều chỉnh giấc ngủ và sự tỉnh táo của cơ thể.',
            example: 'Exposure to morning daylight helps regulate the human circadian rhythm.',
          },
          {
            id: 'b2b-pre-acoustics',
            title: 'Từ vựng trọng tâm trước khi đọc',
            word: 'acoustics',
            phonetic: '/əˈkuːstɪks/',
            meaning: 'đặc tính âm thanh, âm học',
            body: 'Khả năng truyền hoặc hấp thụ âm thanh của một căn phòng hoặc tòa nhà.',
            example: 'Timber panels and moss walls improve room acoustics in busy offices.',
          },
        ],
        passage: [
          'For much of the late twentieth century, corporate office design prioritized spatial efficiency over sensory well-being, sealing employees inside fluorescent-lit cubicles with recycled air. In recent years, however, architects and organizational psychologists have embraced “biophilic design”—an approach that weaves daylight, natural timber, indoor foliage, and organic airflow directly into the built environment.',
          'Controlled workplace studies suggest that these elements do far more than beautify a lobby. Access to shifting natural light stabilizes workers’ circadian rhythms, reducing afternoon fatigue and improving sleep quality at night. Meanwhile, acoustic planters and textured wood surfaces dampen the reverberation of overlapping phone calls, lowering physiological stress markers such as cortisol and resting heart rate during demanding tasks.',
          'Nevertheless, researchers caution against “greenwashing” an unworkable floor plan simply by placing a few potted ferns on crowded desks. Genuine biophilic architecture treats nature as infrastructure rather than ornament: pairing glare-free window views with quiet refuge zones and proper ventilation so employees can alternate seamlessly between collaborative energy and restorative focus.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'b2b-kv-1', word: 'foliage', phonetic: '/ˈfəʊliɪdʒ/', meaning: 'tán lá, cây xanh', example: 'Dense green foliage along the balcony softens the concrete facade.' },
          { id: 'b2b-kv-2', word: 'reverberation', phonetic: '/rɪˌvɜːbəˈreɪʃn/', meaning: 'độ vang âm', example: 'Soft carpets reduce sound reverberation in large lecture halls.' },
          { id: 'b2b-kv-3', word: 'ornament', phonetic: '/ˈɔːnəmənt/', meaning: 'vật trang trí bề ngoài', example: 'Good lighting is a functional necessity rather than mere ornament.' },
        ],
        questions: [
          question('biophilic-main-claim', 'What is the main argument developed across the passage?',
            ['Fluorescent cubicles remain the most effective way to lower construction costs.', 'Integrating natural light, materials, and greenery as core building infrastructure enhances worker health and focus.', 'Employees should care for office plants instead of attending afternoon meetings.', 'Wooden furniture is too fragile for large corporate headquarters.'], 1,
            'Bài viết phân tích cách thiết kế ưa sinh học (ánh sáng tự nhiên, gỗ, cây xanh, thông gió) khi được tích hợp như hạ tầng cốt lõi sẽ cải thiện sức khỏe sinh lý và sự tập trung của nhân viên.',
            { skillCode: 'reading.main_idea', evidence: 'Genuine biophilic architecture treats nature as infrastructure rather than ornament: pairing glare-free window views with quiet refuge zones and proper ventilation so employees can alternate seamlessly between collaborative energy and restorative focus.' }),
          question('biophilic-daylight-effect', 'How does exposure to natural daylight benefit office employees?',
            ['It eliminates the need for computer monitors in the afternoon', 'It stabilizes circadian rhythms, lessening afternoon tiredness and aiding sleep', 'It increases the volume of phone conversations across open floors', 'It replaces mechanical ventilation systems entirely'], 1,
            'Ánh sáng tự nhiên thay đổi theo ngày giúp ổn định nhịp sinh học, giảm mệt mỏi buổi chiều và cải thiện giấc ngủ ban đêm.',
            { skillCode: 'reading.scanning', evidence: 'Access to shifting natural light stabilizes workers’ circadian rhythms, reducing afternoon fatigue and improving sleep quality at night.' }),
          question('biophilic-context-dampen', 'In the second paragraph, the word “dampen” is closest in meaning to:',
            ['muffle and reduce the intensity of', 'amplify across the ceiling', 'record for later analysis', 'soak with cold water'], 0,
            'Trong ngữ cảnh âm thanh cuộc gọi chồng chéo (“dampen the reverberation of overlapping phone calls”), “dampen” có nghĩa là làm dịu đi, giảm độ vang và cường độ âm thanh.',
            { skillCode: 'reading.context_clues', evidence: 'Meanwhile, acoustic planters and textured wood surfaces dampen the reverberation of overlapping phone calls' }),
          question('biophilic-author-critique', 'Why does the author mention placing a few potted ferns on crowded desks in the final paragraph?',
            ['To recommend the cheapest plant species for dark rooms', 'To criticize superficial attempts that treat greenery as mere decoration without fixing layout flaws', 'To prove that ferns absorb more carbon dioxide than timber walls', 'To show that employees prefer smaller desks near elevators'], 1,
            'Tác giả nêu ví dụ đặt vài chậu dương xỉ lên bàn làm việc chật chội để phê phán kiểu “greenwashing” hình thức, coi cây xanh chỉ là đồ trang trí chứ không giải quyết bố cục không gian.',
            { skillCode: 'reading.author_purpose', evidence: 'Nevertheless, researchers caution against “greenwashing” an unworkable floor plan simply by placing a few potted ferns on crowded desks.' }),
          question('biophilic-tfng-cortisol', 'According to the passage, acoustic planters and wooden surfaces can help lower physiological stress indicators like cortisol.',
            ['True', 'False', 'Not Given'], 0,
            'Đoạn 2 khẳng định các bồn cây tiêu âm và bề mặt gỗ giúp giảm độ vang tiếng ồn, từ đó hạ thấp các chỉ số căng thẳng sinh lý như cortisol và nhịp tim lúc nghỉ.',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.fact_opinion', evidence: 'lowering physiological stress markers such as cortisol and resting heart rate during demanding tasks.' }),
        ],
      },
    },
    {
      code: 'reading-c1-algorithmic-curation', kind: 'READING', title: 'Thuật toán gợi ý và sự tò mò nhận thức',
      description: 'Đọc bài luận học thuật B2–C1 về cách hệ thống đề xuất cá nhân hóa định hình phạm vi tiếp nhận tri thức.',
      estimatedMinutes: 12, sortOrder: 17, contentVersion: 1, unitCode: 'c1-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-algorithmic-curation.jpg',
        steps: [
          {
            id: 'c1a-pre-serendipity',
            title: 'Từ vựng học thuật trọng tâm',
            word: 'serendipity',
            phonetic: '/ˌserənˈdɪpəti/',
            meaning: 'sự khám phá tình cờ đầy giá trị',
            body: 'Khả năng bắt gặp những ý tưởng hoặc nguồn tri thức mới mẻ một cách bất ngờ ngoài dự tính ban đầu.',
            example: 'Browsing physical library shelves often sparks intellectual serendipity.',
          },
          {
            id: 'c1a-pre-homogenize',
            title: 'Từ vựng học thuật trọng tâm',
            word: 'homogenize',
            phonetic: '/həˈmɒdʒənaɪz/',
            meaning: 'làm đồng nhất hóa, thu hẹp sự đa dạng',
            body: 'Biến các trải nghiệm hoặc luồng thông tin vốn đa dạng trở nên giống hệt nhau.',
            example: 'Overly narrow recommendation loops can homogenize cultural tastes.',
          },
        ],
        passage: [
          'Recommendation engines are frequently celebrated as antidotes to information overload. By analyzing past clicks, dwell times, and social graphs, algorithmic feeds sift through millions of articles to surface content tailored to an individual’s demonstrated preferences. Yet epistemologists warn that optimizing exclusively for frictionless relevance carries a subtle cognitive cost: the gradual erosion of intellectual serendipity.',
          'When a platform predicts what a reader already agrees with or finds immediately engaging, it constructs a feedback loop that rewards familiarity over productive discomfort. Over time, this predictive narrowing can homogenize a learner’s inquiry, starving them of the anomalous perspectives and interdisciplinary detours that historically catalyzed scientific and creative breakthroughs.',
          'Counteracting this drift requires both architectural and personal interventions. Some digital libraries now embed “diversity injectors”—sliders that deliberately surface credible articles from adjacent fields or contrasting methodological traditions. Equally vital is the reader’s own epistemic discipline: periodically stepping outside automated queues to consult primary bibliographies, unfamiliar journals, and long-form syntheses that no engagement metric would spontaneously rank first.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'c1a-kv-1', word: 'serendipity', phonetic: '/ˌserənˈdɪpəti/', meaning: 'sự khám phá tình cờ giá trị', example: 'Chance conversations at conferences often lead to academic serendipity.' },
          { id: 'c1a-kv-2', word: 'anomalous', phonetic: '/əˈnɒmələs/', meaning: 'khác thường, nằm ngoài khuôn mẫu quen thuộc', example: 'Scientists pay close attention to anomalous experimental results.' },
          { id: 'c1a-kv-3', word: 'epistemic', phonetic: '/ˌepɪˈstemɪk/', meaning: 'thuộc về nhận thức và tri thức', example: 'Open debate strengthens the epistemic quality of research.' },
        ],
        questions: [
          question('algo-central-tension', 'What fundamental tension does the author examine in the first two paragraphs?',
            ['The conflict between free public libraries and paid academic journals', 'How algorithmic filtering reduces overload while inadvertently narrowing intellectual discovery', 'Why computer servers consume more electricity than printed books', 'Whether social graphs are more accurate than search engines'], 1,
            'Tác giả chỉ ra hai mặt của hệ thống gợi ý: vừa giúp lọc bớt quá tải thông tin, vừa âm thầm thu hẹp sự khám phá tình cờ và những góc nhìn liên ngành mới mẻ.',
            { skillCode: 'reading.main_idea', evidence: 'Yet epistemologists warn that optimizing exclusively for frictionless relevance carries a subtle cognitive cost: the gradual erosion of intellectual serendipity.' }),
          question('algo-context-frictionless', 'In the first paragraph, what does the phrase “frictionless relevance” imply?',
            ['Information that matches existing tastes so smoothly that it never challenges the reader', 'Hardware keyboards that operate without mechanical noise', 'Academic papers that have passed peer review without revisions', 'Internet connections that never drop packets during video calls'], 0,
            'Đặt trong sự đối lập với “productive discomfort” ở đoạn sau, “frictionless relevance” chỉ những nội dung chiều theo sở thích sẵn có một cách trơn tru, không tạo ra sự cọ xát tư duy.',
            { skillCode: 'reading.context_clues', evidence: 'When a platform predicts what a reader already agrees with or finds immediately engaging, it constructs a feedback loop that rewards familiarity over productive discomfort.' }),
          question('algo-breakthroughs-role', 'According to the second paragraph, what role do interdisciplinary detours and unfamiliar viewpoints play?',
            ['They slow down software engineers during routine maintenance', 'They have historically sparked major scientific and creative breakthroughs', 'They prevent digital libraries from indexing older books', 'They cause readers to abandon primary bibliographies'], 1,
            'Tác giả nhấn mạnh các góc nhìn khác lạ và những lối rẽ liên ngành trong lịch sử chính là chất xúc tác cho các đột phá khoa học và sáng tạo.',
            { skillCode: 'reading.inference', evidence: 'starving them of the anomalous perspectives and interdisciplinary detours that historically catalyzed scientific and creative breakthroughs.' }),
          question('algo-solution-dual', 'Which combination of remedies does the final paragraph propose?',
            ['Deleting all digital libraries and returning exclusively to handwritten letters', 'Combining platform tools that inject topical diversity with the reader’s deliberate exploration of primary sources', 'Allowing engagement metrics to rank every syllabus in higher education', 'Replacing long-form syntheses with thirty-second video summaries'], 1,
            'Đoạn kết đề xuất kết hợp cả giải pháp thiết kế hệ thống (“diversity injectors”) lẫn kỷ luật nhận thức của chính người đọc khi chủ động tìm đến thư mục nguồn và tạp chí ngoài luồng gợi ý tự động.',
            { skillCode: 'reading.critical_reading', evidence: 'Counteracting this drift requires both architectural and personal interventions.' }),
          question('algo-tfng-metrics', 'The author believes automated engagement metrics naturally prioritize long-form syntheses from unfamiliar fields.',
            ['True', 'False', 'Not Given'], 1,
            'Cuối bài khẳng định người đọc phải chủ động tìm đến các bản tổng hợp chuyên sâu và tạp chí lạ mà không một chỉ số tương tác tự động nào tự khắc xếp lên đầu.',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.critical_reading', evidence: 'long-form syntheses that no engagement metric would spontaneously rank first.' }),
        ],
      },
    },
    {
      code: 'reading-c2-linguistic-memory', kind: 'READING', title: 'Khung ngôn ngữ và cấu trúc của ký ức sự kiện',
      description: 'Đọc văn bản học thuật cấp độ C2 về cách hệ thống ngữ pháp và phép ẩn dụ định hình việc mã hóa ký ức.',
      estimatedMinutes: 14, sortOrder: 18, contentVersion: 1, unitCode: 'c2-unit-1',
      content: {
        coverImageUrl: '/media/learning/v1/images/scene-reading-linguistic-memory.jpg',
        steps: [
          {
            id: 'c2l-pre-agentive',
            title: 'Thuật ngữ học thuật C2',
            word: 'agentive framing',
            phonetic: '/eɪˈdʒentɪv ˈfreɪmɪŋ/',
            meaning: 'cách đóng khung nhấn mạnh chủ thể hành động',
            body: 'Cấu trúc ngôn ngữ đặt trọng tâm vào người gây ra hành động (ví dụ: “Anh ấy làm vỡ bình”) thay vì mô tả sự việc như một tai nạn ngẫu nhiên.',
            example: 'Languages differ in how strongly they require agentive framing for accidental events.',
          },
          {
            id: 'c2l-pre-episodic',
            title: 'Thuật ngữ học thuật C2',
            word: 'episodic memory',
            phonetic: '/ˌepɪˈsɒdɪk ˈmeməri/',
            meaning: 'ký ức sự kiện, trí nhớ tình tiết',
            body: 'Hệ thống trí nhớ lưu giữ các trải nghiệm, bối cảnh thời gian và chi tiết cụ thể của một sự việc đã qua.',
            example: 'Eyewitness studies examine how verbal labels reshape episodic memory over time.',
          },
        ],
        passage: [
          'Early formulations of linguistic relativity were often caricatured as a deterministic prison: the notion that one’s mother tongue sets strict boundaries around what the mind can conceive. Contemporary psycholinguistics has largely discarded such absolutism in favor of a subtler “thinking-for-speaking” hypothesis. Because different languages mandate distinct grammatical distinctions—such as evidentiality markers, spatial coordinates, or agentive versus non-agentive framing—speakers must habitually attend to specific facets of an unfolding scene in order to encode it into speech.',
          'Crucially, these attentional habits leave durable traces in episodic memory. In cross-linguistic experiments where witnesses watch silent videos of accidental mishaps—such as a sleeve knocking a glass off a table—speakers of languages that grammatically distinguish intentional actions from inadvertent occurrences recall the event structure differently from speakers of languages that default to transitive, agent-focused clauses. When everyone describes a mishap using an active subject-verb construction, witnesses become significantly more likely to remember who caused the spill, whereas non-agentive framing shifts retention toward the physical trajectory of the object itself.',
          'Language, then, operates less like a set of blinkers than like a spotlight during perceptual encoding. While human beings across cultures share the same foundational cognitive apparatus, the grammatical obligations of discourse quietly arbitrate which details are foregrounded at the moment of experience and which fade into peripheral reconstruction.',
        ].join('\n\n'),
        keyVocabulary: [
          { id: 'c2l-kv-1', word: 'caricature', phonetic: '/ˈkærɪkətʃʊə(r)/', meaning: 'bóp méo, giản lược quá mức', example: 'Critics sometimes caricature complex theories to make them easier to dismiss.' },
          { id: 'c2l-kv-2', word: 'inadvertent', phonetic: '/ˌɪnədˈvɜːtnt/', meaning: 'vô tình, không chủ ý', example: 'An inadvertent gesture caused the vase to tip over.' },
          { id: 'c2l-kv-3', word: 'arbitrate', phonetic: '/ˈɑːbɪtreɪt/', meaning: 'chi phối, phân định', example: 'Editorial norms arbitrate which details appear in the final report.' },
        ],
        questions: [
          question('c2-memory-thesis', 'How does contemporary psycholinguistics refine the classic theory of linguistic relativity?',
            ['It proves that people cannot perceive colors or objects that lack a single-word noun in their native language.', 'It replaces strict determinism with the view that grammatical requirements guide what speakers attend to and encode into memory.', 'It argues that grammar has zero influence on how eyewitnesses remember accidental events.', 'It claims that silent videos erase cultural differences in spatial reasoning.'], 1,
            'Ngôn ngữ học tâm lý hiện đại bác bỏ thuyết quyết định luận cực đoan và thay bằng giả thuyết “tư duy để nói”: các nghĩa vụ ngữ pháp hướng sự chú ý của người nói vào những khía cạnh nhất định khi mã hóa trải nghiệm vào trí nhớ.',
            { skillCode: 'reading.main_idea', evidence: 'Contemporary psycholinguistics has largely discarded such absolutism in favor of a subtler “thinking-for-speaking” hypothesis.' }),
          question('c2-memory-experiment', 'What did cross-linguistic experiments reveal about witnesses watching accidental mishaps?',
            ['Speakers of languages that use transitive, agent-focused clauses for accidents are more likely to remember who caused the spill.', 'Witnesses only remember accidents accurately when they hear a loud sound during the video.', 'Non-agentive framing causes observers to forget both the person and the object involved.', 'All languages use identical active clauses to describe a glass falling off a table.'], 0,
            'Thí nghiệm cho thấy khi ngôn ngữ mặc định dùng mệnh đề ngoại động nhấn mạnh chủ thể, người chứng kiến nhớ rõ ai làm đổ hơn; ngược lại, cách đóng khung phi chủ thể hướng trí nhớ vào quỹ đạo vật lý của đồ vật.',
            { skillCode: 'reading.inference', evidence: 'When everyone describes a mishap using an active subject-verb construction, witnesses become significantly more likely to remember who caused the spill, whereas non-agentive framing shifts retention toward the physical trajectory of the object itself.' }),
          question('c2-memory-metaphor', 'Why does the author compare language to “a spotlight” rather than “a set of blinkers” in the final paragraph?',
            ['To emphasize that language illuminates certain details during encoding without blinding humans’ shared cognitive capacity', 'To suggest that spoken discourse is only effective in brightly lit laboratory rooms', 'To argue that peripheral vision is more reliable than verbal testimony', 'To show that translators must memorize theatrical scripts'], 0,
            'Hình ảnh “đèn rọi” (spotlight) đối lập với “miếng che mắt” (blinkers) nhằm khẳng định mọi nền văn hóa đều có chung bộ máy nhận thức nền tảng, nhưng ngữ pháp chiếu sáng một số chi tiết ngay lúc trải nghiệm trong khi các chi tiết khác lùi vào vùng ngoại vi.',
            { skillCode: 'reading.author_purpose', evidence: 'Language, then, operates less like a set of blinkers than like a spotlight during perceptual encoding.' }),
          question('c2-memory-context-absolutism', 'In the first paragraph, the word “absolutism” refers to:',
            ['the rigid claim that one’s native language completely imprisons what the mind can think', 'a grammatical rule requiring verbs to appear at the end of a clause', 'the scientific method of using silent video recordings in laboratories', 'a dictionary that lists every spatial coordinate in alphabetical order'], 0,
            'Từ “such absolutism” quy chiếu trực tiếp về quan niệm cực đoan ở câu trước: coi tiếng mẹ đẻ như một nhà tù tiền định giới hạn cứng nhắc những gì tâm trí có thể hình dung.',
            { skillCode: 'reading.context_clues', evidence: 'Early formulations of linguistic relativity were often caricatured as a deterministic prison: the notion that one’s mother tongue sets strict boundaries around what the mind can conceive.' }),
          question('c2-memory-tfng-apparatus', 'The author maintains that people from different linguistic backgrounds possess fundamentally different biological cognitive machinery.',
            ['True', 'False', 'Not Given'], 1,
            'Đoạn kết khẳng định điều ngược lại: con người ở mọi nền văn hóa đều chia sẻ chung một bộ máy nhận thức nền tảng (“While human beings across cultures share the same foundational cognitive apparatus”).',
            { type: 'TRUE_FALSE_NOT_GIVEN', skillCode: 'reading.critical_reading', evidence: 'While human beings across cultures share the same foundational cognitive apparatus, the grammatical obligations of discourse quietly arbitrate which details are foregrounded at the moment of experience and which fade into peripheral reconstruction.' }),
        ],
      },
    },
  ];
}

export function validateLearningSeeds(seeds = loadLearningContent()): void {
  const skillsPath = [
    join(__dirname, '../../ml/data/skills.json'),
    join(__dirname, '../../../ml/data/skills.json'),
  ].find((candidate) => existsSync(candidate));
  if (!skillsPath) throw new Error('Missing canonical skills.json catalog.');
  const rawSkills = JSON.parse(readFileSync(skillsPath, 'utf8')) as {
    skills?: Array<{ code?: string; category?: string }>;
  };
  const canonicalReadingCodes = new Set(
    (rawSkills.skills ?? [])
      .filter((item) => item.category === 'reading' && typeof item.code === 'string' && item.code.startsWith('reading.'))
      .map((item) => item.code as string),
  );
  if (
    canonicalReadingCodes.size !== READING_SKILL_CODES.length ||
    READING_SKILL_CODES.some((code) => !canonicalReadingCodes.has(code))
  ) {
    throw new Error('READING_SKILL_CODES is out of sync with apps/ml/data/skills.json.');
  }
  const canonicalListeningCodes = new Set((rawSkills.skills ?? [])
    .filter((item) => item.category === 'listening' && typeof item.code === 'string' && item.code.startsWith('listening.'))
    .map((item) => item.code as string));
  if (canonicalListeningCodes.size !== LISTENING_SKILL_CODES.length
    || LISTENING_SKILL_CODES.some((code) => !canonicalListeningCodes.has(code))) {
    throw new Error('LISTENING_SKILL_CODES is out of sync with apps/ml/data/skills.json.');
  }
  const units = loadLearningUnits();
  const unitCodes = new Set(units.map((unit) => unit.code));
  if (unitCodes.size !== units.length) throw new Error('Unit codes must be unique.');
  if (new Set(seeds.map((seed) => seed.code)).size !== seeds.length) throw new Error('Lesson codes must be unique.');
  for (const seed of seeds) {
    validateLearningContent(seed.content, seed.kind);
    validateListeningAudio(seed.content, join(__dirname, '../media/learning'));
    if (!seed.code.trim() || !seed.title.trim() || !seed.description.trim() || seed.contentVersion < 1 || seed.estimatedMinutes < 1 || !seed.unitCode?.trim() || !unitCodes.has(seed.unitCode)) throw new Error('Invalid lesson metadata.');
    if (seed.kind === 'LISTENING' && (!seed.content.audioUrl || !seed.content.transcript)) throw new Error('Listening audio and transcript are required.');
    if (seed.kind === 'READING') {
      if (!seed.unitCode?.trim() || !unitCodes.has(seed.unitCode)) throw new Error('Every reading lesson must declare a valid unitCode.');
      if (!seed.content.passage?.trim()) throw new Error('Reading passage is required.');
      if (seed.content.questions.some((q) => !q.skillCode || !canonicalReadingCodes.has(q.skillCode))) {
        throw new Error('Every reading question must declare a valid reading skillCode from skills.json.');
      }
      validateReadingPrepNoAnswerLeak(seed);
    }
    const urls = [seed.content.audioUrl, ...seed.content.steps.map((step) => step.audioUrl)].filter((url): url is string => !!url);
    for (const url of urls) {
      if (!/^\/media\/learning\/v1\/[a-z0-9]+(?:-[a-z0-9]+)*\.wav$/.test(url)) throw new Error('Invalid curriculum audio path.');
      const file = join(__dirname, '..', url.replace(/^\/media\//, 'media/'));
      if (!existsSync(file) || readFileSync(file).toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Missing or invalid learning audio: ${url}`);
    }
  }
}

export function validateReadingPrepNoAnswerLeak(seed: LearningSeed): void {
  const stepFields = seed.content.steps.flatMap((s) => [s.word, s.body, s.example]).filter((v): v is string => !!v?.trim());
  const vocabFields = (seed.content.keyVocabulary ?? []).flatMap((v) => [v.word, v.meaning, v.example, v.translation]).filter((v): v is string => !!v?.trim());
  const allPrepTexts = [...stepFields, ...vocabFields];
  const prepWords = [
    ...seed.content.steps.map((s) => s.word?.trim().toLowerCase()).filter((w): w is string => !!w),
    ...(seed.content.keyVocabulary ?? []).map((v) => v.word.trim().toLowerCase()),
  ];

  for (const q of seed.content.questions) {
    if (q.skillCode === 'reading.context_clues') {
      const quoted = [...q.prompt.matchAll(/[“"']([A-Za-z][A-Za-z\s-]{1,40})[”"']/g)]
        .map((m) => m[1].trim().toLowerCase());
      for (const target of quoted) {
        const tokens = target.split(/\s+/).filter((t) => t.length >= 3);
        if (prepWords.some((w) => w === target || tokens.includes(w)) || allPrepTexts.some((f) => new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i').test(f))) {
          throw new Error(`Reading preparation reveals context-clues target "${target}" in ${seed.code} (${q.id}).`);
        }
      }
    }
    const qType = q.type ?? 'MULTIPLE_CHOICE';
    if (qType === 'TRUE_FALSE_NOT_GIVEN') continue;
    const answerText = q.options.find((o) => o.id === q.correctOptionId)?.text.trim();
    if (!answerText || answerText.length < 4) continue;
    const pattern = answerMatchPattern(answerText);
    if (allPrepTexts.some((text) => pattern.test(text))) {
      throw new Error(`Reading preparation example reveals ${qType} answer "${answerText}" in ${seed.code} (${q.id}).`);
    }
  }
}

function answerMatchPattern(phrase: string): RegExp {
  const escaped = escapeRegExp(phrase);
  const startBoundary = /^[A-Za-z0-9]/.test(phrase) ? '\\b' : '';
  const endBoundary = /[A-Za-z0-9]$/.test(phrase) ? '\\b' : '';
  return new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function seedLearningContent(prisma: PrismaClient): Promise<number> {
  const units = loadLearningUnits();
  const seeds = loadLearningContent();
  validateLearningSeeds(seeds);
  await prisma.$transaction(async (tx) => {
    const unitIds = new Map<string, string>();
    for (const unit of units) {
      const saved = await tx.learningUnit.upsert({ where: { code: unit.code }, create: unit, update: unit });
      unitIds.set(unit.code, saved.id);
    }
    for (const seed of seeds) {
      const { unitCode, ...rest } = seed;
      const data = {
        ...rest,
        unitId: unitIds.get(unitCode) ?? null,
        published: true,
        content: seed.content as unknown as Prisma.InputJsonValue,
      };
      await tx.learningLesson.upsert({ where: { code: seed.code }, create: data, update: data });
    }
  });
  return seeds.length;
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate')) {
    const seeds = loadLearningContent();
    validateLearningSeeds(seeds);
    const questions = seeds.reduce((count, seed) => count + seed.content.questions.length, 0);
    console.log(`Validated ${seeds.length} lessons and ${questions} questions, including curriculum audio references.`);
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^lingoroad_(demo|test|[a-z0-9_]+_test)$/.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error('Seed CLI requires an isolated lingoroad_demo or lingoroad_*test database.');
  }
  const prisma = new PrismaClient();
  try { console.log(`Seeded ${await seedLearningContent(prisma)} learning lessons (upsert by stable code).`); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Learning seed failed.'); process.exitCode = 1; });
