import { GrammarTopicSeed } from './groups-and-edges';

function leafB1(
  code: string,
  parentCode: string,
  orderIndex: number,
  titleEn: string,
  titleVi: string,
  summaryVi: string,
  formulas: GrammarTopicSeed['formulas'],
  usageNotes: GrammarTopicSeed['usageNotes'],
  examples: GrammarTopicSeed['examples'],
): GrammarTopicSeed {
  return { code, parentCode, cefrLevel: 'B1', isLeaf: true, orderIndex, titleEn, titleVi, summaryVi, formulas, usageNotes, examples };
}

export const GRAMMAR_TOPICS_B1: readonly GrammarTopicSeed[] = [
  leafB1('grammar.tenses.present_perfect', 'grammar.tenses', 206, 'Present Perfect', 'Thì Hiện tại hoàn thành',
    'Kết nối quá khứ với hiện tại: trải nghiệm sống, kết quả còn lưu lại hoặc hành động kéo dài tới nay.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + have/has + V3/ed' },
      { form: 'NEGATIVE', labelVi: 'Phủ định', structure: 'S + have/has + not + V3/ed' },
      { form: 'QUESTION', labelVi: 'Nghi vấn', structure: 'Have/Has + S + V3/ed?' },
    ],
    [
      { useCaseVi: 'Dùng cho hành động không rõ thời điểm quá khứ hoặc đi với for + khoảng thời gian, since + mốc thời gian.', signalWords: ['just', 'already', 'yet', 'ever', 'never', 'for', 'since', 'recently'], commonMistakeVi: 'Dùng Hiện tại hoàn thành đi kèm trạng ngữ quá khứ xác định như yesterday hoặc in 2019.' },
    ],
    [
      { sentenceEn: 'Our team has completed three major releases since January.', translationVi: 'Nhóm chúng tôi đã hoàn thành ba bản phát hành lớn kể từ tháng Một.', highlight: 'has completed ... since' },
    ]),
  leafB1('grammar.tenses.present_perfect_continuous', 'grammar.tenses', 207, 'Present Perfect Continuous', 'Thì Hiện tại hoàn thành tiếp diễn',
    'Nhấn mạnh tính liên tục và độ dài của hành động bắt đầu trong quá khứ và vẫn đang tiếp diễn hoặc vừa mới dừng.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + have/has + been + V-ing' },
      { form: 'NEGATIVE', labelVi: 'Phủ định', structure: 'S + have/has + not + been + V-ing' },
    ],
    [
      { useCaseVi: 'Nhấn mạnh quá trình kéo dài hơn là số lượng kết quả hoàn tất.', signalWords: ['all morning', 'all day', 'for hours', 'how long'] },
    ],
    [
      { sentenceEn: 'She has been practicing her presentation all afternoon, so her voice is tired.', translationVi: 'Cô ấy đã luyện bài thuyết trình suốt cả buổi chiều nên giọng hơi khàn.', highlight: 'has been practicing' },
    ]),
  leafB1('grammar.tenses.future_continuous', 'grammar.tenses', 208, 'Future Continuous', 'Thì Tương lai tiếp diễn',
    'Diễn tả hành động sẽ đang diễn ra tại một thời điểm cụ thể trong tương lai.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + will + be + V-ing' },
      { form: 'QUESTION', labelVi: 'Hỏi lịch trình lịch sự', structure: 'Will + S + be + V-ing?' },
    ],
    [
      { useCaseVi: 'Mô tả hành động đang diễn tiến tại mốc giờ tương lai hoặc hỏi thăm kế hoạch người khác một cách tế nhị.', signalWords: ['at this time tomorrow', 'at 9 a.m. next Monday'] },
    ],
    [
      { sentenceEn: 'This time tomorrow, we will be flying over the Pacific Ocean.', translationVi: 'Giờ này ngày mai, chúng tôi sẽ đang bay qua Thái Bình Dương.', highlight: 'will be flying' },
    ]),
  leafB1('grammar.tenses.used_to_would', 'grammar.tenses', 209, 'Past Habits (used to, would & be/get used to)', 'Thói quen Quá khứ (used to, would) & Thích nghi (be/get used to)',
    'Phân biệt thói quen/trạng thái đã chấm dứt trong quá khứ với sự quen thuộc ở hiện tại.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Thói quen/Trạng thái quá khứ', structure: 'S + used to + V_bare | Phủ định: didn’t use to + V_bare' },
      { form: 'NOTE', labelVi: 'Hành động lặp lại & Sự thích nghi', structure: 'would + V_bare (chỉ dùng cho hành động, không dùng cho trạng thái) | be/get used to + N/V-ing (quen với)' },
    ],
    [
      { useCaseVi: 'Tránh nhầm cấu trúc used to + V_bare với be used to + V-ing.' },
    ],
    [
      { sentenceEn: 'I used to wake up late, but now I am used to starting work at 7 a.m.', translationVi: 'Trước đây tôi thường dậy muộn, nhưng giờ tôi đã quen bắt đầu làm việc lúc 7 giờ sáng.', highlight: 'used to wake up ... am used to starting' },
    ]),
  leafB1('grammar.questions.indirect', 'grammar.questions', 304, 'Indirect Questions', 'Câu hỏi Gián tiếp Lịch sự',
    'Lồng câu hỏi vào sau cụm dẫn lịch sự mà không đảo trợ động từ.',
    [
      { form: 'QUESTION', labelVi: 'Với Wh-word', structure: 'Could you tell me / Do you know + Wh-word + S + V (trật tự câu kể)?' },
      { form: 'QUESTION', labelVi: 'Với Yes/No', structure: 'Could you tell me / I wonder + if / whether + S + V?' },
    ],
    [
      { useCaseVi: 'Giao tiếp trang trọng nơi công sở, email hoặc hỏi người lạ.', commonMistakeVi: 'Giữ nguyên đảo ngữ như Could you tell me where is the bank? thay vì ...where the bank is?' },
    ],
    [
      { sentenceEn: 'Could you let me know whether the seminar includes a Q&A session?', translationVi: 'Bạn có thể cho tôi biết liệu buổi hội thảo có phần hỏi đáp không?', highlight: 'Could you let me know whether ... includes' },
    ]),
  leafB1('grammar.questions.subject_object', 'grammar.questions', 305, 'Subject vs. Object Questions', 'Câu hỏi Chủ ngữ & Câu hỏi Tân ngữ',
    'Phân biệt khi nào từ để hỏi đóng vai trò chủ ngữ (không mượn trợ động từ) và khi nào làm tân ngữ.',
    [
      { form: 'QUESTION', labelVi: 'Câu hỏi Chủ ngữ', structure: 'Who / What / Which + N + V(chia theo ngôi 3 số ít)?' },
      { form: 'QUESTION', labelVi: 'Câu hỏi Tân ngữ', structure: 'Who / What / Which + N + do/does/did + S + V_bare?' },
    ],
    [
      { useCaseVi: 'Hỏi ai/cái gì gây ra hành động so với ai/cái gì chịu tác động của hành động.' },
    ],
    [
      { sentenceEn: 'Who wrote this report, and who did the manager send it to?', translationVi: 'Ai đã viết bản báo cáo này, và người quản lý đã gửi nó cho ai?', highlight: 'Who wrote ... who did the manager send' },
    ]),
  leafB1('grammar.quantifiers.few_little', 'grammar.quantifiers', 404, 'Few / A few & Little / A little', 'Phân biệt Few / A few và Little / A little',
    'Diễn đạt sắc thái tích cực (một ít, đủ dùng) so với sắc thái tiêu cực (quá ít, hầu như không đủ).',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Sắc thái tích cực (đủ dùng)', structure: 'a few + N_số nhiều | a little + N_không đếm được' },
      { form: 'NEGATIVE', labelVi: 'Sắc thái tiêu cực (rất ít)', structure: '(very) few + N_số nhiều | (very) little + N_không đếm được' },
    ],
    [
      { useCaseVi: 'Thiếu chữ "a" sẽ làm đổi hoàn toàn thái độ câu từ lạc quan sang thiếu hụt.' },
    ],
    [
      { sentenceEn: 'We have a little time left, though very few seats remain available.', translationVi: 'Chúng ta vẫn còn một chút thời gian, dù hầu như không còn mấy ghế trống.', highlight: 'a little time ... very few seats' },
    ]),
  leafB1('grammar.quantifiers.all_most_some', 'grammar.quantifiers', 405, 'All, Most, Both, Either, Neither & None', 'Lượng từ Phân bổ (All, Most, Both, Either, Neither, None)',
    'Định lượng cho toàn thể, phần lớn hoặc hai đối tượng kèm quy tắc giới từ of.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Không có of vs. Có of', structure: 'All / Most + N_chung | All / Most + of + the/my/these + N' },
      { form: 'NOTE', labelVi: 'Hai đối tượng', structure: 'both A and B (V_số nhiều) | either A or B / neither A nor B (V chia theo B)' },
    ],
    [
      { useCaseVi: 'Dùng both/either/neither khi nói về đúng 2 đối tượng; dùng all/any/none cho từ 3 đối tượng trở lên.' },
    ],
    [
      { sentenceEn: 'Most commuters take the subway, and neither of the two bridges was congested.', translationVi: 'Hầu hết người đi làm đi tàu điện ngầm, và không cây cầu nào trong hai cây cầu bị tắc.', highlight: 'Most commuters ... neither of' },
    ]),
  leafB1('grammar.comparatives_superlatives.comparative_adverbs', 'grammar.comparatives_superlatives', 504, 'Comparative Adverbs', 'So sánh hơn của Trạng từ',
    'So sánh cách thức, tốc độ hoặc mức độ thực hiện hành động giữa hai chủ thể.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Trạng từ đuôi -ly & Trạng từ ngắn', structure: 'more / less + Adv(-ly) + than | Adv ngắn (fast, hard, early, late) + -er + than' },
      { form: 'NOTE', labelVi: 'Bất quy tắc', structure: 'well → better | badly → worse | far → further/farther' },
    ],
    [
      { useCaseVi: 'Bổ nghĩa cho động từ thường (speak more fluently, work harder).' },
    ],
    [
      { sentenceEn: 'Learners retain vocabulary more effectively when they review in short intervals.', translationVi: 'Người học ghi nhớ từ vựng hiệu quả hơn khi ôn tập theo các quãng ngắn.', highlight: 'more effectively' },
    ]),
  leafB1('grammar.comparatives_superlatives.superlative_adverbs', 'grammar.comparatives_superlatives', 505, 'Superlative Adverbs', 'So sánh nhất của Trạng từ',
    'Xác định ai thực hiện hành động nổi trội nhất trong một tập thể.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc chuẩn', structure: '(the) + most / least + Adv(-ly) | (the) + Adv ngắn + -est (fastest, hardest)' },
    ],
    [
      { useCaseVi: 'Đánh giá hiệu suất hành động cao nhất trong nhóm (the best, the most accurately).' },
    ],
    [
      { sentenceEn: 'Of all the candidates, Lan answered the technical questions the most clearly.', translationVi: 'Trong tất cả ứng viên, Lan trả lời các câu hỏi chuyên môn rõ ràng nhất.', highlight: 'the most clearly' },
    ]),
  leafB1('grammar.verb_forms.gerunds', 'grammar.verb_forms', 601, 'Gerunds (V-ing as Noun)', 'Danh động từ (Gerunds - V-ing)',
    'Sử dụng V-ing làm chủ ngữ, bổ ngữ, sau giới từ và sau một số động từ phổ biến.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Các vị trí của V-ing', structure: 'V-ing + V_số ít (Chủ ngữ) | Giới từ (in, on, of, about, without, by) + V-ing | enjoy/avoid/mind/suggest + V-ing' },
    ],
    [
      { useCaseVi: 'Mọi động từ đứng ngay sau giới từ đều phải chuyển sang dạng V-ing (kể cả look forward to + V-ing).' },
    ],
    [
      { sentenceEn: 'Reading aloud daily helps improve pronunciation without feeling stressful.', translationVi: 'Đọc thành tiếng mỗi ngày giúp cải thiện phát âm mà không gây căng thẳng.', highlight: 'Reading ... without feeling' },
    ]),
  leafB1('grammar.verb_forms.infinitives', 'grammar.verb_forms', 602, 'Infinitives (to-V & bare Infinitive)', 'Động từ Nguyên mẫu (to-V & V nguyên thể)',
    'Sử dụng to-V để chỉ mục đích, đứng sau tính từ, từ để hỏi và một số động từ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Nguyên mẫu có to', structure: 'decide/plan/promise/hope + to-V | It + be + Adj + (for O) + to-V | in order to / so as to + V' },
      { form: 'NOTE', labelVi: 'Nguyên mẫu không to', structure: 'make / let / help + O + V_bare | had better / would rather + V_bare' },
    ],
    [
      { useCaseVi: 'Dùng to-V diễn đạt mục đích của hành động (tránh dùng for + V_bare).' },
    ],
    [
      { sentenceEn: 'She woke up early in order to catch the first express train.', translationVi: 'Cô ấy thức dậy sớm để bắt chuyến tàu tốc hành đầu tiên.', highlight: 'in order to catch' },
    ]),
  leafB1('grammar.conditionals.zero', 'grammar.conditionals', 701, 'Zero Conditional', 'Câu Điều kiện Loại 0',
    'Diễn tả quy luật tự nhiên, sự thật khoa học hoặc kết quả tất yếu luôn đúng.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc chuẩn', structure: 'If / When + S + V(Present Simple), S + V(Present Simple)' },
    ],
    [
      { useCaseVi: 'Hai vế đều chia thì hiện tại vì hệ quả luôn lặp lại 100% mỗi khi điều kiện xảy ra.' },
    ],
    [
      { sentenceEn: 'If water reaches 100 degrees Celsius at sea level, it boils.', translationVi: 'Nếu nước đạt 100 độ C ở mực nước biển, nó sẽ sôi.', highlight: 'If water reaches ... it boils' },
    ]),
  leafB1('grammar.conditionals.first', 'grammar.conditionals', 702, 'First Conditional & Time Clauses', 'Câu Điều kiện Loại 1 & Mệnh đề Thời gian Tương lai',
    'Diễn tả tình huống có thật, khả thi ở hiện tại hoặc tương lai cùng các liên từ unless, in case, as soon as.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc chuẩn', structure: 'If / Unless / As soon as + S + V(Present Simple), S + will/can/may/imperative + V_bare' },
    ],
    [
      { useCaseVi: 'Tuyệt đối không dùng will ngay bên trong mệnh đề If / Unless / When / As soon as.', signalWords: ['if', 'unless', 'as soon as', 'in case', 'until'] },
    ],
    [
      { sentenceEn: 'Take an umbrella in case it rains before you finish class.', translationVi: 'Hãy mang theo ô phòng khi trời mưa trước lúc bạn tan học.', highlight: 'in case it rains' },
    ]),
  leafB1('grammar.conditionals.second', 'grammar.conditionals', 703, 'Second Conditional', 'Câu Điều kiện Loại 2',
    'Giả định điều kiện không có thật hoặc rất khó xảy ra ở hiện tại/tương lai, hoặc dùng để đưa lời khuyên.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc chuẩn', structure: 'If + S + V2/ed (be → were), S + would / could / might + V_bare' },
    ],
    [
      { useCaseVi: 'Trong văn viết chuẩn, dùng were cho mọi ngôi ở mệnh đề If (If I were you...).' },
    ],
    [
      { sentenceEn: 'If our office had a quiet garden, employees would take more outdoor breaks.', translationVi: 'Nếu văn phòng chúng tôi có một khu vườn yên tĩnh, nhân viên sẽ ra ngoài nghỉ giải lao nhiều hơn.', highlight: 'If ... had ... would take' },
    ]),
  leafB1('grammar.passive_voice', 'grammar.clauses_voice', 801, 'Passive Voice', 'Câu Bị động (Passive Voice)',
    'Nhấn mạnh đối tượng chịu tác động của hành động hoặc khi tác nhân thực hiện không quan trọng/chưa rõ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Công thức tổng quát', structure: 'S + be (chia theo thì) + V3/ed (+ by Agent)' },
      { form: 'NOTE', labelVi: 'Với Modal & Hoàn thành', structure: 'Modal + be + V3/ed | have/has/had + been + V3/ed' },
    ],
    [
      { useCaseVi: 'Rất phổ biến trong mô tả quy trình (process), tin tức và văn bản khoa học. Lược bỏ by people / by someone.' },
    ],
    [
      { sentenceEn: 'All customer passwords are encrypted before they are stored in the database.', translationVi: 'Toàn bộ mật khẩu khách hàng đều được mã hóa trước khi lưu vào cơ sở dữ liệu.', highlight: 'are encrypted ... are stored' },
    ]),
  leafB1('grammar.relative_clauses', 'grammar.clauses_voice', 802, 'Relative Clauses (Defining & Non-defining)', 'Mệnh đề Quan hệ (Xác định & Không xác định)',
    'Bổ sung thông tin định danh hoặc giải thích cho danh từ bằng who, whom, which, that, whose, where, when.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Mệnh đề xác định (không dấu phẩy)', structure: 'Noun + who/which/that/whose/where/when + Clause' },
      { form: 'NOTE', labelVi: 'Mệnh đề không xác định (có dấu phẩy)', structure: 'Proper Noun, who/which/whose/where + Clause, ... (CẤM dùng that sau dấu phẩy)' },
    ],
    [
      { useCaseVi: 'Có thể lược bỏ who/which/that khi chúng làm tân ngữ trong mệnh đề quan hệ xác định.' },
    ],
    [
      { sentenceEn: 'Da Nang, which is famous for its clean beaches, attracts millions of visitors.', translationVi: 'Đà Nẵng, nơi nổi tiếng với những bãi biển sạch, thu hút hàng triệu du khách.', highlight: ', which is famous for its clean beaches,' },
    ]),
];
