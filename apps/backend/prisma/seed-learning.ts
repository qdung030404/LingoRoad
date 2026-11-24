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
    { code: 'grammar-pronouns-to-be', kind: 'GRAMMAR', title: 'Subject pronouns and “to be”', description: 'Đại từ nhân xưng, câu khẳng định, phủ định và câu hỏi với to be.', estimatedMinutes: 10, sortOrder: 1, contentVersion: 1, unitCode: 'a1-unit-1',
      content: { steps: [{ id: 'grammar-theory', title: 'Đại từ nhân xưng và động từ to be',
        body: 'I → am; He / She / It → is; You / We / They → are.\n\nKhẳng định: Chủ ngữ + am / is / are.\nI am a student. She is a teacher. They are friends.\n\nPhủ định: Chủ ngữ + am / is / are + not.\nWe are not tired. He is not a doctor.\n\nCâu hỏi: Am / Is / Are + chủ ngữ …?\nIs she a teacher? Are you from Hanoi?\n\nTên một người như Lan dùng “is”.' }], questions: [
        question('grammar-1', 'I … a student.', ['am', 'is', 'are', 'be'], 0, 'Chủ ngữ “I” đi với “am”: I am a student.'),
        question('grammar-2', 'Lan … from Hanoi.', ['am', 'is', 'are', 'be'], 1, 'Lan là tên một người, tương đương “she”, nên dùng “is”.'),
        question('grammar-3', 'They … my friends.', ['am', 'is', 'are', 'be'], 2, 'Chủ ngữ số nhiều “They” đi với “are”.'),
        question('grammar-4', '… she a teacher?', ['Am', 'Are', 'Be', 'Is'], 3, 'Đảo “Is” lên trước “she” để tạo câu hỏi: Is she a teacher?'),
        question('grammar-5', 'We … not tired.', ['are', 'is', 'am', 'be'], 0, '“We” đi với “are”; câu phủ định là “We are not tired”.'),
      ] } },
    { code: 'vocabulary-family', kind: 'VOCABULARY', title: 'Family and relationships', description: 'Học 10 từ về gia đình qua phát âm và ví dụ, sau đó luyện tập.', estimatedMinutes: 10, sortOrder: 2, contentVersion: 1, unitCode: 'a1-unit-2',
      content: { steps: words.map(([word, phonetic, meaning, example, body]) => ({ id: `word-${word}`, title: word, word, phonetic, meaning, example, body, audioUrl: `/media/learning/v1/${word}.wav` })), questions: [
        question('vocabulary-1', 'My father and mother are my …', ['parents', 'sisters', 'brothers', 'sons'], 0, '“Parents” nghĩa là bố mẹ, gồm father và mother.'),
        question('vocabulary-2', 'My mother’s mother is my …', ['sister', 'grandmother', 'daughter', 'brother'], 1, 'Mẹ của mẹ là bà ngoại: “grandmother”.'),
        question('vocabulary-3', 'A daughter is a …', ['boy', 'father', 'girl', 'grandfather'], 2, '“Daughter” là con gái, vì vậy đáp án là “girl”.'),
        question('vocabulary-4', 'My parents have two children: me and a boy. The boy is my …', ['mother', 'sister', 'grandmother', 'brother'], 3, 'Cậu bé là người con trai còn lại của bố mẹ, tức anh/em trai: “brother”.'),
        question('vocabulary-5', 'A son is a …', ['boy', 'girl', 'mother', 'grandmother'], 0, '“Son” nghĩa là con trai, nên chọn “boy”.'),
      ] } },
    { code: 'reading-everyday-introductions', kind: 'READING', title: 'Everyday Introductions', description: 'Đọc đoạn tự giới thiệu và xác định thông tin tên, tuổi, quê quán và sở thích.', estimatedMinutes: 5, sortOrder: 3, contentVersion: 2, unitCode: 'a1-unit-1',
      content: { steps: [], passage: transcript, questions: comprehension('reading') } },
    { code: 'listening-greetings-introductions', kind: 'LISTENING', title: 'Greetings and Introductions', description: 'Nghe Anna tự giới thiệu. Được nghe lại và tua không giới hạn.', estimatedMinutes: 5, sortOrder: 4, contentVersion: 1, unitCode: 'a1-unit-1',
      content: { steps: [], audioUrl: '/media/learning/v1/listening.wav', transcript, questions: comprehension('listening') } },
    { code: 'listening-campus-cafe', kind: 'LISTENING', title: 'At the campus café',
      description: 'Nghe hội thoại gọi món, kiểm tra từng câu rồi nghe lại lời thoại để chữa bài.',
      estimatedMinutes: 6, sortOrder: 50, contentVersion: 1, unitCode: 'a1-unit-2', content: loadListeningLesson('campus-cafe') },
    { code: 'listening-valkyrie', kind: 'LISTENING', title: 'Aboard the Valkyrie',
      description: 'Nghe hành trình đến Iceland qua giọng đọc của badey (LibriVox, Mini LibriSpeech, CC BY 4.0).',
      estimatedMinutes: 5, sortOrder: 51, contentVersion: 1, unitCode: 'b2-unit-2', content: loadListeningLesson('valkyrie') },
    { code: 'listening-underground', kind: 'LISTENING', title: 'A Walk Underground',
      description: 'Theo lối xuống hầm mỏ qua giọng đọc của aquielisunari (LibriVox, Mini LibriSpeech, CC BY 4.0).',
      estimatedMinutes: 6, sortOrder: 52, contentVersion: 1, unitCode: 'b2-unit-2', content: loadListeningLesson('underground') },
    {
      code: 'reading-a2-club-meeting', kind: 'READING', title: 'A New Time for the Club Meeting',
      description: 'Đọc email đổi lịch câu lạc bộ và xác định thời gian, địa điểm cùng việc cần làm.',
      estimatedMinutes: 5, sortOrder: 5, contentVersion: 4, unitCode: 'a2-unit-1',
      content: {
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
      estimatedMinutes: 5, sortOrder: 6, contentVersion: 1, unitCode: 'a2-unit-1',
      content: {
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
      estimatedMinutes: 5, sortOrder: 7, contentVersion: 1, unitCode: 'a2-unit-1',
      content: {
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
      estimatedMinutes: 8, sortOrder: 8, contentVersion: 2, unitCode: 'b1-unit-1',
      content: {
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
      estimatedMinutes: 10, sortOrder: 9, contentVersion: 3, unitCode: 'b2-unit-1',
      content: {
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
      estimatedMinutes: 12, sortOrder: 10, contentVersion: 2, unitCode: 'c1-unit-1',
      content: {
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
