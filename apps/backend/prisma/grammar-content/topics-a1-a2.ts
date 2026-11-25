import { GrammarTopicSeed } from './groups-and-edges';

function leaf(
  code: string,
  parentCode: string,
  cefrLevel: 'A1' | 'A2',
  orderIndex: number,
  titleEn: string,
  titleVi: string,
  summaryVi: string,
  formulas: GrammarTopicSeed['formulas'],
  usageNotes: GrammarTopicSeed['usageNotes'],
  examples: GrammarTopicSeed['examples'],
): GrammarTopicSeed {
  return { code, parentCode, cefrLevel, isLeaf: true, orderIndex, titleEn, titleVi, summaryVi, formulas, usageNotes, examples };
}

export const GRAMMAR_TOPICS_A1_A2: readonly GrammarTopicSeed[] = [
  // ==================== A1 (9 topics) ====================
  leaf('grammar.pronouns', 'grammar.foundations', 'A1', 101, 'Pronouns & Verb “to be”', 'Đại từ nhân xưng, Sở hữu & Động từ “to be”',
    'Cách dùng đại từ chủ ngữ, tân ngữ, tính từ sở hữu và chia động từ to be ở hiện tại.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định với to be', structure: 'I + am | He/She/It + is | You/We/They + are + N/Adj' },
      { form: 'NEGATIVE', labelVi: 'Phủ định với to be', structure: 'S + am/is/are + not + N/Adj' },
      { form: 'QUESTION', labelVi: 'Nghi vấn với to be', structure: 'Am/Is/Are + S + N/Adj?' },
    ],
    [
      { useCaseVi: 'Thay thế danh từ chỉ người/vật làm chủ ngữ (I, he, they), tân ngữ (me, him, them) hoặc sở hữu trước danh từ (my, his, their).', commonMistakeVi: 'Nhầm lẫn giữa tính từ sở hữu (its) và dạng viết tắt của it is (it’s).' },
    ],
    [
      { sentenceEn: 'She is my younger sister, and they are her classmates.', translationVi: 'Cô ấy là em gái tôi, còn họ là bạn cùng lớp của cô ấy.', highlight: 'She is ... my ... they are her' },
    ]),
  leaf('grammar.nouns', 'grammar.foundations', 'A1', 102, 'Singular, Plural & Possessive Nouns', 'Danh từ Số ít, Số nhiều & Sở hữu cách',
    'Quy tắc thêm -s/-es, danh từ số nhiều bất quy tắc và sở hữu cách với ’s.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Danh từ số nhiều chuẩn', structure: 'Noun + -s / -es (-ch, -sh, -s, -x, -o) | -y → -ies' },
      { form: 'NOTE', labelVi: 'Sở hữu cách', structure: 'Danh từ số ít + ’s | Danh từ số nhiều tận cùng -s + ’', noteVi: 'Bất quy tắc phổ biến: child → children, person → people, tooth → teeth.' },
    ],
    [
      { useCaseVi: 'Chỉ một hay nhiều sự vật và biểu đạt quyền sở hữu đối với người/sinh vật.', commonMistakeVi: 'Thêm -s vào các danh từ bất quy tắc như childs hoặc peoples.' },
    ],
    [
      { sentenceEn: 'My parents’ house is near the children’s park.', translationVi: 'Nhà của bố mẹ tôi ở gần công viên thiếu nhi.', highlight: 'parents’ ... children’s' },
    ]),
  leaf('grammar.articles', 'grammar.foundations', 'A1', 103, 'Articles (a, an, the)', 'Mạo từ a, an, the & Mạo từ rỗng',
    'Phân biệt mạo từ bất định a/an khi nhắc lần đầu và mạo từ xác định the khi đối tượng đã rõ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Mạo từ bất định', structure: 'a + âm phụ âm | an + âm nguyên âm (u, e, o, a, i)' },
      { form: 'NOTE', labelVi: 'Mạo từ xác định', structure: 'the + danh từ đã xác định hoặc duy nhất (the sun, the internet)', noteVi: 'Xét theo âm phát âm đầu tiên chứ không chỉ chữ cái: a university, an hour.' },
    ],
    [
      { useCaseVi: 'Dùng a/an với danh từ đếm được số ít chưa xác định; không dùng mạo từ trước danh từ số nhiều nói chung.' },
    ],
    [
      { sentenceEn: 'I bought an umbrella because the sky looked dark.', translationVi: 'Tôi đã mua một chiếc ô vì bầu trời trông tối sầm.', highlight: 'an umbrella ... the sky' },
    ]),
  leaf('grammar.tenses.present_simple', 'grammar.tenses', 'A1', 201, 'Present Simple', 'Thì Hiện tại đơn',
    'Diễn tả thói quen lặp lại, lịch trình cố định và sự thật hiển nhiên.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'I/You/We/They + V_bare | He/She/It + V(s/es)' },
      { form: 'NEGATIVE', labelVi: 'Phủ định', structure: 'S + do/does + not + V_bare' },
      { form: 'QUESTION', labelVi: 'Nghi vấn', structure: 'Do/Does + S + V_bare?' },
    ],
    [
      { useCaseVi: 'Diễn tả sinh hoạt hằng ngày, chân lý khoa học và lịch tàu xe.', signalWords: ['always', 'usually', 'often', 'sometimes', 'every day'], commonMistakeVi: 'Quên chia -s/-es với chủ ngữ ngôi thứ 3 số ít hoặc vẫn giữ -s sau doesn’t.' },
    ],
    [
      { sentenceEn: 'Minh usually catches the 7 a.m. bus to work.', translationVi: 'Minh thường bắt chuyến xe buýt lúc 7 giờ sáng để đi làm.', highlight: 'usually catches' },
    ]),
  leaf('grammar.tenses.present_continuous', 'grammar.tenses', 'A1', 202, 'Present Continuous', 'Thì Hiện tại tiếp diễn',
    'Diễn tả hành động đang diễn ra ngay lúc nói hoặc xung quanh thời điểm hiện tại.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + am/is/are + V-ing' },
      { form: 'NEGATIVE', labelVi: 'Phủ định', structure: 'S + am/is/are + not + V-ing' },
      { form: 'QUESTION', labelVi: 'Nghi vấn', structure: 'Am/Is/Are + S + V-ing?' },
    ],
    [
      { useCaseVi: 'Hành động đang xảy ra tại thời điểm nói hoặc tình huống tạm thời.', signalWords: ['now', 'right now', 'at the moment', 'Look!', 'Listen!'], commonMistakeVi: 'Dùng V-ing với các động từ chỉ trạng thái nhận thức như know, like, want, need.' },
    ],
    [
      { sentenceEn: 'Please be quiet; the baby is sleeping right now.', translationVi: 'Làm ơn giữ trật tự; em bé đang ngủ ngay lúc này.', highlight: 'is sleeping right now' },
    ]),
  leaf('grammar.questions.yes_no', 'grammar.questions', 'A1', 301, 'Yes/No Questions', 'Câu hỏi Có/Không (Yes/No Questions)',
    'Đặt câu hỏi xác nhận thông tin với trợ động từ be, do/does hoặc can.',
    [
      { form: 'QUESTION', labelVi: 'Với động từ to be / Modal', structure: 'Am/Is/Are/Can + S + ...?' },
      { form: 'QUESTION', labelVi: 'Với động từ thường', structure: 'Do/Does + S + V_bare?' },
    ],
    [
      { useCaseVi: 'Kiểm tra thông tin đúng/sai và trả lời ngắn gọn Yes, S + aux / No, S + aux + not.' },
    ],
    [
      { sentenceEn: 'Do your colleagues speak English at the office?', translationVi: 'Đồng nghiệp của bạn có nói tiếng Anh ở văn phòng không?', highlight: 'Do ... speak' },
    ]),
  leaf('grammar.questions.wh', 'grammar.questions', 'A1', 302, 'Wh- Questions', 'Câu hỏi có Từ để hỏi (Wh- Questions)',
    'Khai thác thông tin chi tiết về người, vật, thời gian, địa điểm, lý do và cách thức.',
    [
      { form: 'QUESTION', labelVi: 'Cấu trúc tổng quát', structure: 'Wh-word (What/Where/When/Who/Why/How) + aux + S + V?' },
    ],
    [
      { useCaseVi: 'Thu thập thông tin cụ thể thay vì chỉ xác nhận có hoặc không.', signalWords: ['What', 'Where', 'When', 'Why', 'How often', 'How much'] },
    ],
    [
      { sentenceEn: 'Where do you usually study on weekends?', translationVi: 'Bạn thường học ở đâu vào cuối tuần?', highlight: 'Where do you' },
    ]),
  leaf('grammar.quantifiers.countable_uncountable', 'grammar.quantifiers', 'A1', 401, 'Countable & Uncountable Nouns', 'Danh từ Đếm được & Không đếm được (There is/are)',
    'Phân biệt danh từ đếm được với danh từ khối/chất liệu không đếm được và cấu trúc There is/are.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Giới thiệu sự tồn tại', structure: 'There is + N_số ít / N_không đếm được | There are + N_số nhiều' },
    ],
    [
      { useCaseVi: 'Danh từ không đếm được luôn chia động từ số ít (water, information, advice, furniture, bread).', commonMistakeVi: 'Thêm a/an hoặc -s vào advice, information, homework, equipment.' },
    ],
    [
      { sentenceEn: 'There is fresh milk in the fridge and three apples on the table.', translationVi: 'Có sữa tươi trong tủ lạnh và ba quả táo trên bàn.', highlight: 'There is fresh milk ... three apples' },
    ]),
  leaf('grammar.quantifiers.some_any', 'grammar.quantifiers', 'A1', 402, 'Some & Any', 'Lượng từ Some và Any',
    'Cách chọn some và any theo loại câu khẳng định, phủ định, nghi vấn và lời mời.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Câu khẳng định & Lời mời', structure: 'some + N_số nhiều / N_không đếm được' },
      { form: 'NEGATIVE', labelVi: 'Câu phủ định & Câu hỏi', structure: 'any + N_số nhiều / N_không đếm được' },
    ],
    [
      { useCaseVi: 'Dùng some trong câu hỏi khi mang ý mời mọc hoặc đề nghị lịch sự (Would you like some tea?).' },
    ],
    [
      { sentenceEn: 'We don’t have any sugar left, so let’s buy some.', translationVi: 'Chúng ta không còn chút đường nào, nên hãy đi mua một ít nhé.', highlight: 'any sugar ... buy some' },
    ]),

  // ==================== A2 (11 topics) ====================
  leaf('grammar.prepositions', 'grammar.foundations', 'A2', 104, 'Prepositions of Time, Place & Movement', 'Giới từ chỉ Thời gian, Nơi chốn & Phương hướng',
    'Phân biệt chính xác in, on, at và các giới từ chỉ sự di chuyển như into, across, through, towards.',
    [
      { form: 'NOTE', labelVi: 'Thời gian (in / on / at)', structure: 'in + tháng/năm/mùa/buổi | on + ngày/thứ | at + giờ chính xác/night/weekend' },
      { form: 'NOTE', labelVi: 'Nơi chốn & Di chuyển', structure: 'in + không gian kín/thành phố | on + bề mặt/tầng | at + điểm cụ thể | into/across/along' },
    ],
    [
      { useCaseVi: 'Định vị mốc thời gian, vị trí và hướng chuyển động trong giao tiếp thường nhật.', commonMistakeVi: 'Dùng in Monday thay vì on Monday, hoặc arrive to thay vì arrive in/at.' },
    ],
    [
      { sentenceEn: 'Our train leaves at 6:30 a.m. on Friday from Platform 2.', translationVi: 'Chuyến tàu của chúng tôi khởi hành lúc 6:30 sáng thứ Sáu từ Sân ga số 2.', highlight: 'at 6:30 a.m. on Friday' },
    ]),
  leaf('grammar.conjunctions', 'grammar.foundations', 'A2', 105, 'Coordinating & Basic Subordinating Conjunctions', 'Liên từ Kết hợp & Phụ thuộc Cơ bản',
    'Nối câu ghép và câu phức đơn giản bằng and, but, or, so, because, although, when, before, after.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Liên từ kết hợp', structure: 'Clause 1, + and / but / or / so + Clause 2' },
      { form: 'AFFIRMATIVE', labelVi: 'Liên từ phụ thuộc', structure: 'Because / Although / When + Clause 1, Clause 2' },
    ],
    [
      { useCaseVi: 'Mở rộng câu đơn thành câu ghép/phức diễn đạt nguyên nhân, kết quả và nhượng bộ.', commonMistakeVi: 'Dùng đồng thời cả Because ... so ... hoặc Although ... but ... trong cùng một câu tiếng Anh.' },
    ],
    [
      { sentenceEn: 'Although it rained heavily, we arrived at the hall on time.', translationVi: 'Mặc dù trời mưa to, chúng tôi vẫn đến hội trường đúng giờ.', highlight: 'Although it rained' },
    ]),
  leaf('grammar.modals', 'grammar.foundations', 'A2', 106, 'Core Modal Verbs', 'Động từ Khuyết thiếu Cơ bản (can, could, must, have to, should)',
    'Diễn tả khả năng, lời khuyên, sự bắt buộc và lời xin phép/đề nghị lịch sự.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khuyết thiếu chuẩn', structure: 'S + can / could / should / must / may / might + V_bare' },
      { form: 'NOTE', labelVi: 'Bắt buộc khách quan', structure: 'S + have/has to + V_bare | Phủ định: don’t/doesn’t have to (không cần thiết)' },
    ],
    [
      { useCaseVi: 'Phân biệt mustn’t (cấm đoán tuyệt đối) và don’t have to (không bắt buộc phải làm).' },
    ],
    [
      { sentenceEn: 'Passengers must wear seatbelts, but you don’t have to print your ticket.', translationVi: 'Hành khách bắt buộc phải thắt dây an toàn, nhưng bạn không cần in vé giấy.', highlight: 'must wear ... don’t have to print' },
    ]),
  leaf('grammar.tenses.past_simple', 'grammar.tenses', 'A2', 203, 'Past Simple', 'Thì Quá khứ đơn',
    'Kể lại các sự việc đã xảy ra và chấm dứt hoàn toàn tại một mốc thời gian xác định trong quá khứ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V2/ed (was/were với động từ to be)' },
      { form: 'NEGATIVE', labelVi: 'Phủ định', structure: 'S + did not (didn’t) + V_bare' },
      { form: 'QUESTION', labelVi: 'Nghi vấn', structure: 'Did + S + V_bare?' },
    ],
    [
      { useCaseVi: 'Chuỗi hành động nối tiếp trong quá khứ hoặc sự kiện có mốc thời gian rõ ràng.', signalWords: ['yesterday', 'last week', 'two days ago', 'in 2022'] },
    ],
    [
      { sentenceEn: 'We booked the hotel last month and flew to Hue yesterday.', translationVi: 'Chúng tôi đã đặt khách sạn tháng trước và bay tới Huế hôm qua.', highlight: 'booked ... flew' },
    ]),
  leaf('grammar.tenses.past_continuous', 'grammar.tenses', 'A2', 204, 'Past Continuous', 'Thì Quá khứ tiếp diễn',
    'Diễn tả hành động đang diễn ra tại một thời điểm xác định trong quá khứ hoặc làm nền cho hành động khác cắt ngang.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + was/were + V-ing' },
      { form: 'NOTE', labelVi: 'Phối hợp when / while', structure: 'While + S + was/were + V-ing, S + V2/ed' },
    ],
    [
      { useCaseVi: 'Hành động kéo dài đang diễn ra (Past Continuous) thì hành động ngắn xen vào (Past Simple).', signalWords: ['at 8 p.m. yesterday', 'while', 'when', 'at that time'] },
    ],
    [
      { sentenceEn: 'While I was cooking dinner, the power suddenly went out.', translationVi: 'Trong lúc tôi đang nấu bữa tối thì điện đột ngột bị mất.', highlight: 'was cooking ... went out' },
    ]),
  leaf('grammar.tenses.future_forms', 'grammar.tenses', 'A2', 205, 'Future Forms (will, be going to, Present Continuous)', 'Các Cấu trúc Tương lai Cơ bản',
    'Phân biệt sắc thái giữa quyết định tức thời (will), dự định có kế hoạch (be going to) và lịch hẹn chắc chắn (V-ing).',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Quyết định ngay lúc nói / Dự đoán', structure: 'S + will + V_bare' },
      { form: 'AFFIRMATIVE', labelVi: 'Dự định / Dấu hiệu rõ ràng', structure: 'S + am/is/are + going to + V_bare' },
      { form: 'NOTE', labelVi: 'Lịch hẹn đã sắp xếp', structure: 'S + am/is/are + V-ing + mốc thời gian tương lai' },
    ],
    [
      { useCaseVi: 'Chọn đúng cấu trúc tương lai theo mức độ chuẩn bị trước của người nói.', signalWords: ['tomorrow', 'next week', 'soon', 'in two days'] },
    ],
    [
      { sentenceEn: 'Look at those dark clouds! It is going to rain.', translationVi: 'Nhìn những đám mây đen kia kìa! Trời sắp mưa rồi.', highlight: 'is going to rain' },
    ]),
  leaf('grammar.questions.tag', 'grammar.questions', 'A2', 303, 'Question Tags', 'Câu hỏi đuôi (Tag Questions)',
    'Phần hỏi ngắn cuối câu dùng để xác nhận thông tin hoặc tạo sự đồng thuận trong hội thoại.',
    [
      { form: 'QUESTION', labelVi: 'Quy tắc đối dấu', structure: 'S + V (khẳng định), trợ động từ phủ định + đại từ? | S + V (phủ định), trợ động từ khẳng định + đại từ?' },
      { form: 'NOTE', labelVi: 'Trường hợp đặc biệt', structure: 'I am ..., aren’t I? | Let’s ..., shall we? | Mệnh lệnh ..., will you?' },
    ],
    [
      { useCaseVi: 'Lên giọng cuối câu khi thực sự muốn hỏi; xuống giọng khi chỉ mong người nghe đồng ý.' },
    ],
    [
      { sentenceEn: 'You haven’t met the new manager yet, have you?', translationVi: 'Bạn vẫn chưa gặp quản lý mới phải không?', highlight: 'haven’t met ... have you' },
    ]),
  leaf('grammar.quantifiers.much_many_alotof', 'grammar.quantifiers', 'A2', 403, 'Much, Many & A lot of', 'Lượng từ Much, Many và A lot of',
    'Diễn tả số lượng nhiều phù hợp với danh từ đếm được, không đếm được và loại câu.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Câu khẳng định thân mật', structure: 'a lot of / lots of + N_số nhiều / N_không đếm được' },
      { form: 'NEGATIVE', labelVi: 'Câu phủ định & Nghi vấn', structure: 'many + N_số nhiều | much + N_không đếm được' },
    ],
    [
      { useCaseVi: 'Dùng How many...? cho danh từ số nhiều và How much...? cho danh từ không đếm được hoặc hỏi giá tiền.' },
    ],
    [
      { sentenceEn: 'How much luggage are you bringing, and how many bags do you have?', translationVi: 'Bạn mang theo bao nhiêu hành lý và bạn có mấy chiếc túi?', highlight: 'How much luggage ... how many bags' },
    ]),
  leaf('grammar.comparatives_superlatives.as_as', 'grammar.comparatives_superlatives', 'A2', 501, 'Equal Comparison (as ... as), too & enough', 'So sánh bằng (as ... as) & Cấu trúc too / enough',
    'So sánh ngang bằng giữa hai đối tượng và diễn đạt mức độ thừa/đủ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'So sánh bằng', structure: 'S1 + be/V + (not) as/so + Adj/Adv + as + S2' },
      { form: 'NOTE', labelVi: 'Mức độ too & enough', structure: 'too + Adj/Adv + (for O) + to-V | Adj/Adv + enough + to-V | enough + Noun' },
    ],
    [
      { useCaseVi: 'Đánh giá sự tương đồng hoặc giải thích lý do đủ/quá mức để thực hiện hành động.', commonMistakeVi: 'Đặt enough sai vị trí trước tính từ (ví dụ viết enough tall thay vì tall enough).' },
    ],
    [
      { sentenceEn: 'This laptop is just as fast as the desktop, and it is light enough to carry.', translationVi: 'Chiếc laptop này nhanh ngang máy bàn và đủ nhẹ để mang theo.', highlight: 'as fast as ... light enough' },
    ]),
  leaf('grammar.comparatives_superlatives.comparative_adjectives', 'grammar.comparatives_superlatives', 'A2', 502, 'Comparative Adjectives', 'So sánh hơn của Tính từ',
    'So sánh đặc điểm giữa hai người hoặc sự vật với tính từ ngắn, tính từ dài và bất quy tắc.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Tính từ ngắn & dài', structure: 'Adj ngắn + -er + than | more / less + Adj dài + than' },
      { form: 'NOTE', labelVi: 'Bất quy tắc & Nhấn mạnh', structure: 'good → better, bad → worse, far → farther/further | Nhấn mạnh bằng much / far / a bit + comparative' },
    ],
    [
      { useCaseVi: 'Đối chiếu sự khác biệt giữa 2 đối tượng.', commonMistakeVi: 'Dùng kép more better hoặc more cheaper.' },
    ],
    [
      { sentenceEn: 'Taking the metro is much cheaper and more convenient than driving.', translationVi: 'Đi tàu điện ngầm rẻ hơn nhiều và tiện lợi hơn lái xe.', highlight: 'much cheaper and more convenient than' },
    ]),
  leaf('grammar.comparatives_superlatives.superlative_adjectives', 'grammar.comparatives_superlatives', 'A2', 503, 'Superlative Adjectives', 'So sánh nhất của Tính từ',
    'Chỉ ra đối tượng nổi bật nhất trong một nhóm từ ba phần tử trở lên.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Tính từ ngắn & dài', structure: 'the + Adj ngắn + -est | the most / the least + Adj dài (+ in N_địa điểm / of N_nhóm)' },
      { form: 'NOTE', labelVi: 'Bất quy tắc', structure: 'good → the best | bad → the worst | far → the farthest / furthest' },
    ],
    [
      { useCaseVi: 'Xác lập mức cực đại trong một tập hợp hoặc trải nghiệm (thường đi cùng Present Perfect).' },
    ],
    [
      { sentenceEn: 'Autumn is the most pleasant season of the year in Hanoi.', translationVi: 'Mùa thu là mùa dễ chịu nhất trong năm ở Hà Nội.', highlight: 'the most pleasant' },
    ]),
];
