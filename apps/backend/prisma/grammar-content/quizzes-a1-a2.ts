import { LearningQuestion } from '../../src/modules/learning/learning.types';

export type RawQuizItem = readonly [
  prompt: string,
  options: readonly [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  explanation: string,
];

export function buildQuizQuestions(topicCode: string, items: readonly RawQuizItem[]): LearningQuestion[] {
  const prefix = topicCode.replace(/\./g, '-');
  return items.map(([prompt, options, correctIndex, explanation], idx) => ({
    id: `${prefix}-q${idx + 1}`,
    type: 'MULTIPLE_CHOICE',
    prompt,
    options: options.map((text, optIdx) => ({
      id: String.fromCharCode(65 + optIdx),
      text,
    })),
    correctOptionId: String.fromCharCode(65 + correctIndex),
    explanation,
  }));
}

export const GRAMMAR_QUIZZES_A1_A2: Readonly<Record<string, readonly RawQuizItem[]>> = {
  // ==================== A1 (9) ====================
  'grammar.pronouns': [
    ['Hello! My name is Minh, and I ___ an engineer.', ['am', 'is', 'are', 'be'], 0, 'Chủ ngữ "I" luôn đi với động từ to be là "am".'],
    ['Lan and Mai live in Hue. ___ house is near the river.', ['They', 'Them', 'Their', 'Theirs'], 2, 'Trước danh từ "house" cần dùng tính từ sở hữu "Their".'],
    ['___ your brother at home right now?', ['Am', 'Is', 'Are', 'Be'], 1, 'Chủ ngữ số ít "your brother" (tương đương he) dùng "Is" đảo lên đầu câu hỏi.'],
  ],
  'grammar.nouns': [
    ['There are three ___ playing in the schoolyard.', ['child', 'childs', 'children', 'childrens'], 2, 'Danh từ số nhiều bất quy tắc của "child" là "children".'],
    ['Please put these ___ on the kitchen shelf.', ['boxs', 'boxes', 'boxies', 'box'], 1, 'Danh từ tận cùng bằng "-x" thêm "-es" khi chuyển sang số nhiều: boxes.'],
    ['This is my ___ motorbike; he bought it last year.', ['father’s', 'fathers’', 'fathers', 'father'], 0, 'Sở hữu cách của danh từ số ít "father" viết là "father’s".'],
  ],
  'grammar.articles': [
    ['It takes about ___ hour to travel to the airport.', ['a', 'an', 'the', 'no article'], 1, '"hour" bắt đầu bằng âm câm /h/, phát âm đầu là nguyên âm /aʊə/ nên dùng "an".'],
    ['She bought a notebook and a pen. ___ pen is blue.', ['A', 'An', 'The', 'Some'], 2, 'Dùng mạo từ xác định "The" khi nhắc lại sự vật ("pen") đã được đề cập trước đó.'],
    ['My sister wants to study at ___ university in Tokyo.', ['a', 'an', 'many', 'some'], 0, '"university" phát âm đầu bằng phụ âm /j/ (/ˌjuːnɪˈvɜːsəti/) nên đi với mạo từ "a".'],
  ],
  'grammar.tenses.present_simple': [
    ['Our office ___ at 8:30 every morning.', ['open', 'opens', 'opening', 'is open to'], 1, 'Thói quen/lịch cố định với chủ ngữ ngôi thứ 3 số ít "Our office" chia động từ thêm "-s": opens.'],
    ['Nam ___ coffee in the evening because it keeps him awake.', ['don’t drink', 'doesn’t drinks', 'doesn’t drink', 'isn’t drink'], 2, 'Câu phủ định Hiện tại đơn với "Nam" dùng "doesn’t + V nguyên thể": doesn’t drink.'],
    ['How often ___ your parents visit your grandparents?', ['do', 'does', 'are', 'is'], 0, 'Chủ ngữ số nhiều "your parents" mượn trợ động từ "do" trong câu hỏi Hiện tại đơn.'],
  ],
  'grammar.tenses.present_continuous': [
    ['Listen! Someone ___ the piano upstairs.', ['plays', 'play', 'is playing', 'are playing'], 2, 'Từ cảm thán "Listen!" báo hiệu hành động đang xảy ra; đại từ bất định "Someone" chia số ít "is playing".'],
    ['We ___ television at the moment; we are cooking dinner.', ['aren’t watching', 'don’t watch', 'isn’t watching', 'not watching'], 0, '"at the moment" dùng Hiện tại tiếp diễn phủ định với "We": aren’t watching.'],
    ['Which sentence is grammatically correct?', ['I am knowing the answer now.', 'I know the answer now.', 'I knowing the answer now.', 'I be know the answer now.'], 1, 'Động từ chỉ nhận thức "know" là động từ trạng thái (stative verb), không chia dạng V-ing.'],
  ],
  'grammar.questions.yes_no': [
    ['___ you ready for the English speaking club?', ['Do', 'Are', 'Have', 'Can'], 1, 'Tính từ "ready" cần đi với động từ to be "Are" khi chủ ngữ là "you".'],
    ['"Does Linh work at the hospital?" — "Yes, she ___."', ['work', 'works', 'is', 'does'], 3, 'Câu trả lời ngắn cho câu hỏi "Does + S + V?" lặp lại đúng trợ động từ "does".'],
    ['___ I borrow your dictionary for a minute?', ['Do', 'Am', 'Can', 'Are'], 2, 'Dùng động từ khuyết thiếu "Can" đầu câu để xin phép: Can I borrow...?'],
  ],
  'grammar.questions.wh': [
    ['"___ do you go to work every day?" — "By bus."', ['Where', 'When', 'How', 'Who'], 2, 'Câu trả lời "By bus" chỉ phương tiện/cách thức nên dùng từ để hỏi "How".'],
    ['___ jacket is hanging behind the door?', ['Who', 'Whose', 'Whom', 'Which of'], 1, 'Trước danh từ "jacket" để hỏi thuộc sở hữu của ai, ta dùng "Whose".'],
    ['What time ___ the supermarket close on Sundays?', ['do', 'does', 'is', 'has'], 1, 'Động từ thường "close" với chủ ngữ số ít "the supermarket" cần trợ động từ "does".'],
  ],
  'grammar.quantifiers.countable_uncountable': [
    ['___ two bookstores and a post office on this street.', ['There is', 'There are', 'It has', 'They have'], 1, 'Cụm danh từ đầu tiên sau chỗ trống là số nhiều "two bookstores" nên dùng "There are".'],
    ['Could you give me a piece of ___ about the interview?', ['advices', 'an advice', 'advice', 'many advices'], 2, '"advice" là danh từ không đếm được, không thêm "-s" và không đi trực tiếp với "an".'],
    ['___ fresh water in this bottle?', ['Are there', 'Is there', 'Do there', 'Have there'], 1, '"water" là danh từ không đếm được nên câu hỏi sự tồn tại dùng "Is there".'],
  ],
  'grammar.quantifiers.some_any': [
    ['Would you like ___ hot tea before we start?', ['any', 'some', 'many', 'a'], 1, 'Trong câu hỏi mang ý mời mọc lịch sự ("Would you like...?"), ta dùng "some" thay vì "any".'],
    ['I checked my bag, but there aren’t ___ keys inside.', ['some', 'a', 'any', 'much'], 2, 'Câu phủ định với danh từ đếm được số nhiều "keys" dùng "any".'],
    ['She bought ___ fresh strawberries at the morning market.', ['any', 'some', 'much', 'a'], 1, 'Câu khẳng định với danh từ số nhiều "strawberries" dùng "some".'],
  ],

  // ==================== A2 (11) ====================
  'grammar.prepositions': [
    ['The workshop starts ___ 9:00 a.m. ___ Tuesday.', ['in / on', 'at / on', 'on / at', 'at / in'], 1, 'Dùng "at" trước giờ chính xác (9:00 a.m.) và "on" trước thứ trong tuần (Tuesday).'],
    ['Many families travel to the countryside ___ summer.', ['on', 'at', 'in', 'into'], 2, 'Trước các mùa trong năm ("summer"), ta dùng giới từ "in".'],
    ['The cat jumped ___ the open window into the garden.', ['through', 'at', 'since', 'during'], 0, '"through" diễn tả chuyển động xuyên qua một khung/không gian mở như cửa sổ.'],
  ],
  'grammar.conjunctions': [
    ['He missed the morning bus, ___ he took a taxi to class.', ['because', 'although', 'so', 'or'], 2, 'Vế sau nêu kết quả của vế trước nên dùng liên từ kết hợp "so" (vì vậy).'],
    ['___ the café was crowded, the staff served us very quickly.', ['Because', 'So', 'Although', 'But'], 2, 'Hai mệnh đề mang ý đối lập nhau nên dùng liên từ nhượng bộ "Although" ở đầu câu.'],
    ['Choose the grammatically correct sentence:', ['Because I was tired, so I slept early.', 'Although it was cold, but she went swimming.', 'I stayed home because I had a fever.', 'Because of I had a fever, I stayed home.'], 2, 'Trong tiếng Anh không dùng cặp "Because ... so" hoặc "Although ... but" cùng lúc trong một câu.'],
  ],
  'grammar.modals': [
    ['Tomorrow is Sunday, so we ___ wake up early for school.', ['mustn’t', 'don’t have to', 'shouldn’t to', 'can’t to'], 1, '"don’t have to" nghĩa là không cần thiết/không bắt buộc, khác với "mustn’t" (bị cấm).'],
    ['Visitors ___ smoke inside the hospital building; it is strictly forbidden.', ['don’t have to', 'mustn’t', 'might', 'needn’t'], 1, 'Quy định cấm tuyệt đối ("strictly forbidden") phải dùng "mustn’t".'],
    ['___ you mind sending me the meeting slides this afternoon?', ['Could', 'Should', 'Would', 'Must'], 2, 'Cấu trúc đề nghị lịch sự cố định: "Would you mind + V-ing...?"'],
  ],
  'grammar.tenses.past_simple': [
    ['We ___ a wonderful documentary about ocean life last night.', ['watch', 'watched', 'have watched', 'watching'], 1, 'Trạng ngữ quá khứ xác định "last night" dùng thì Quá khứ đơn: watched.'],
    ['Why ___ you attend the club meeting yesterday?', ['weren’t', 'don’t', 'didn’t', 'haven’t'], 2, 'Câu hỏi Quá khứ đơn với động từ thường "attend" mượn trợ động từ "didn’t" + V nguyên thể.'],
    ['Mozart ___ more than 600 pieces of music during his lifetime.', ['wrote', 'writes', 'has written', 'was writing'], 0, 'Sự việc thuộc về một nhân vật lịch sử đã qua đời dùng Quá khứ đơn: wrote.'],
  ],
  'grammar.tenses.past_continuous': [
    ['At 8 p.m. yesterday, my sister ___ for her final exam.', ['studied', 'was studying', 'has studied', 'studies'], 1, 'Có thời điểm cụ thể trong quá khứ ("At 8 p.m. yesterday") dùng Quá khứ tiếp diễn: was studying.'],
    ['While we ___ home, it suddenly started to pour with rain.', ['walked', 'were walking', 'are walking', 'have walked'], 1, 'Hành động dài đang diễn ra sau "While" dùng Quá khứ tiếp diễn ("were walking"), hành động cắt ngang dùng Quá khứ đơn.'],
    ['I dropped my phone when I ___ off the bus.', ['got', 'was getting', 'get', 'have got'], 1, 'Trong lúc đang bước xuống xe ("was getting off") thì làm rơi điện thoại ("dropped").'],
  ],
  'grammar.tenses.future_forms': [
    ['"The phone is ringing!" — "Don’t worry, I ___ answer it."', ['am going to', 'will', 'answer', 'am answering'], 1, 'Quyết định nảy sinh ngay tại thời điểm nói dùng "will + V".'],
    ['She has already bought the plane tickets. She ___ fly to Da Lat this Friday.', ['will', 'is going to', 'flies', 'shall'], 1, 'Kế hoạch đã có sự chuẩn bị trước ("bought the plane tickets") dùng "be going to + V".'],
    ['Be careful! That stack of plates ___ fall!', ['will', 'is going to', 'falls', 'shall'], 1, 'Dự đoán dựa trên dấu hiệu nhìn thấy rõ ràng ngay trước mắt dùng "is going to".'],
  ],
  'grammar.questions.tag': [
    ['You locked the front door before leaving, ___?', ['don’t you', 'didn’t you', 'did you', 'weren’t you'], 1, 'Động từ chính "locked" ở Quá khứ đơn khẳng định nên phần hỏi đuôi dùng phủ định "didn’t you?".'],
    ['Let’s review the vocabulary flashcards together, ___?', ['will we', 'don’t we', 'shall we', 'aren’t we'], 2, 'Câu rủ rê bắt đầu bằng "Let’s..." luôn có câu hỏi đuôi là "shall we?".'],
    ['She rarely eats fast food, ___?', ['doesn’t she', 'does she', 'is she', 'isn’t she'], 1, 'Trạng từ "rarely" mang nghĩa phủ định nên phần hỏi đuôi phải ở dạng khẳng định "does she?".'],
  ],
  'grammar.quantifiers.much_many_alotof': [
    ['How ___ traffic was there on the bridge this morning?', ['many', 'much', 'few', 'number of'], 1, '"traffic" là danh từ không đếm được nên câu hỏi số lượng dùng "How much".'],
    ['There weren’t ___ empty seats left in the lecture hall.', ['much', 'many', 'a little', 'amount of'], 1, '"seats" là danh từ đếm được số nhiều trong câu phủ định nên dùng "many".'],
    ['Our neighborhood park has ___ tall trees and benches.', ['much', 'a lot of', 'a little', 'any'], 1, 'Trong câu khẳng định, "a lot of" đi được với danh từ đếm được số nhiều "tall trees".'],
  ],
  'grammar.comparatives_superlatives.as_as': [
    ['The new library is not ___ noisy ___ the old student lounge.', ['more / than', 'as / as', 'so / than', 'too / to'], 1, 'Cấu trúc so sánh bằng (hoặc không bằng): (not) as + tính từ + as.'],
    ['The soup was ___ hot for the child to eat right away.', ['enough', 'so', 'too', 'as'], 2, 'Cấu trúc "too + Adj + (for O) + to-V": quá nóng đến mức không thể ăn ngay.'],
    ['Is this backpack large ___ to fit a 15-inch laptop?', ['too', 'enough', 'very', 'as'], 1, '"enough" luôn đứng SAU tính từ: large enough to-V (đủ rộng để...).'],
  ],
  'grammar.comparatives_superlatives.comparative_adjectives': [
    ['Public buses are ___ than private taxis in most cities.', ['cheap', 'cheaper', 'more cheap', 'more cheaper'], 1, '"cheap" là tính từ ngắn một âm tiết nên thêm "-er": cheaper than.'],
    ['Today’s reading passage is much ___ than yesterday’s exercise.', ['difficult', 'difficulter', 'more difficult', 'most difficult'], 2, '"difficult" là tính từ dài nên so sánh hơn dùng "more difficult than" (nhấn mạnh bởi "much").'],
    ['Her pronunciation is getting ___ every week.', ['gooder', 'more good', 'better', 'best'], 2, 'Dạng so sánh hơn bất quy tắc của "good" là "better".'],
  ],
  'grammar.comparatives_superlatives.superlative_adjectives': [
    ['Fansipan is ___ mountain in Vietnam.', ['higher', 'the higher', 'the highest', 'most high'], 2, 'So sánh nhất của tính từ ngắn "high" là "the highest".'],
    ['That was ___ meal I have ever tasted!', ['delicious', 'more delicious', 'the most delicious', 'most deliciously'], 2, 'So sánh nhất của tính từ dài "delicious" đi cùng kinh nghiệm ("I have ever...") dùng "the most delicious".'],
    ['Monday morning usually has ___ traffic of the entire week.', ['bad', 'worse', 'the worst', 'the baddest'], 2, 'Dạng so sánh nhất bất quy tắc của "bad" là "the worst".'],
  ],
};
