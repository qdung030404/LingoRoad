import { GrammarTopicSeed } from './groups-and-edges';

function leafAdv(
  code: string,
  parentCode: string,
  cefrLevel: 'B2' | 'C1' | 'C2',
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

export const GRAMMAR_TOPICS_B2_C2: readonly GrammarTopicSeed[] = [
  // ==================== B2 (10 topics) ====================
  leafAdv('grammar.tenses.past_perfect', 'grammar.tenses', 'B2', 210, 'Past Perfect', 'Thì Quá khứ hoàn thành',
    'Xác lập trật tự thời gian cho hành động xảy ra trước một hành động hoặc mốc thời gian khác trong quá khứ.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + had + V3/ed' },
      { form: 'NOTE', labelVi: 'Phối hợp thì', structure: 'By the time / Before + S + V2/ed, S + had + V3/ed' },
    ],
    [
      { useCaseVi: 'Tránh lạm dụng khi các sự kiện được kể xuôi theo trình tự thời gian đơn thuần.', signalWords: ['by the time', 'before', 'after', 'already'] },
    ],
    [
      { sentenceEn: 'By the time we reached the station, the express train had already departed.', translationVi: 'Vào lúc chúng tôi tới nhà ga, chuyến tàu tốc hành đã rời bến rồi.', highlight: 'reached ... had already departed' },
    ]),
  leafAdv('grammar.tenses.past_perfect_continuous', 'grammar.tenses', 'B2', 211, 'Past Perfect Continuous', 'Thì Quá khứ hoàn thành tiếp diễn',
    'Nhấn mạnh quá trình kéo dài liên tục của một hành động trước khi một sự kiện quá khứ khác xảy đến.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + had + been + V-ing' },
    ],
    [
      { useCaseVi: 'Giải thích nguyên nhân kéo dài dẫn đến một kết quả nhìn thấy được trong quá khứ.', signalWords: ['for hours before', 'since', 'how long'] },
    ],
    [
      { sentenceEn: 'The streets were flooded because it had been pouring all night.', translationVi: 'Đường phố bị ngập vì trời đã mưa xối xả suốt cả đêm trước đó.', highlight: 'had been pouring' },
    ]),
  leafAdv('grammar.tenses.future_perfect', 'grammar.tenses', 'B2', 212, 'Future Perfect', 'Thì Tương lai hoàn thành',
    'Diễn tả hành động sẽ được hoàn tất trước một thời điểm hoặc một sự kiện khác trong tương lai.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + will + have + V3/ed' },
    ],
    [
      { useCaseVi: 'Thường đi kèm các cụm mốc hạn chót trong tương lai.', signalWords: ['by tomorrow', 'by the end of this year', 'by the time + Present Simple'] },
    ],
    [
      { sentenceEn: 'By December, our engineering team will have migrated every service to the cloud.', translationVi: 'Trước tháng Mười Hai, đội kỹ thuật của chúng tôi sẽ chuyển đổi xong mọi dịch vụ lên đám mây.', highlight: 'By December ... will have migrated' },
    ]),
  leafAdv('grammar.verb_forms.verbs_gerund', 'grammar.verb_forms', 'B2', 603, 'Advanced Verbs & Expressions Followed by Gerund', 'Các Động từ & Cụm cấu trúc đi với V-ing Nâng cao',
    'Làm chủ các động từ học thuật và thành ngữ cố định bắt buộc theo sau bởi danh động từ (kể cả dạng bị động being + V3).',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Chủ động & Bị động', structure: 'admit / deny / consider / postpone / risk / appreciate + V-ing (hoặc being + V3/ed)' },
      { form: 'NOTE', labelVi: 'Cụm cố định với giới từ to', structure: 'be committed to / object to / contribute to / be accustomed to + V-ing' },
    ],
    [
      { useCaseVi: 'Nhận diện chữ "to" là giới từ (theo sau bởi Noun/V-ing) chứ không phải dấu hiệu của nguyên mẫu to-V.' },
    ],
    [
      { sentenceEn: 'Many residents objected to widening the highway near the primary school.', translationVi: 'Nhiều cư dân phản đối việc mở rộng đường cao tốc gần trường tiểu học.', highlight: 'objected to widening' },
    ]),
  leafAdv('grammar.verb_forms.verbs_infinitive', 'grammar.verb_forms', 'B2', 604, 'Complex Infinitive Patterns (Verb + Object + to-V)', 'Cấu trúc Nguyên mẫu Phức hợp & Hoàn thành (to have V3)',
    'Sử dụng cấu trúc động từ kèm tân ngữ + to-V, nguyên mẫu bị động (to be V3) và nguyên mẫu hoàn thành (to have V3).',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Kèm tân ngữ', structure: 'encourage / persuade / enable / urge / forbid + O + (not) to-V' },
      { form: 'NOTE', labelVi: 'Nguyên mẫu hoàn thành & bị động', structure: 'seem / appear / claim + to have V3/ed | expect / want + to be V3/ed' },
    ],
    [
      { useCaseVi: 'Dùng to have V3 khi hành động sau xảy ra trước động từ chính (She seems to have forgotten the key).' },
    ],
    [
      { sentenceEn: 'Subsidized transit passes enabled low-income students to commute affordably.', translationVi: 'Thẻ giao thông trợ giá đã giúp sinh viên thu nhập thấp đi lại với chi phí hợp lý.', highlight: 'enabled ... students to commute' },
    ]),
  leafAdv('grammar.verb_forms.participles', 'grammar.verb_forms', 'B2', 605, 'Participle Clauses', 'Mệnh đề Phân từ & Rút gọn Mệnh đề',
    'Rút gọn mệnh đề quan hệ và mệnh đề trạng ngữ cùng chủ ngữ bằng V-ing, V3/ed và Having + V3/ed.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Chủ động & Bị động', structure: 'V-ing ..., S + V (chủ động) | V3/ed ..., S + V (bị động)' },
      { form: 'NOTE', labelVi: 'Nhấn mạnh hành động trước', structure: 'Having + V3/ed (hoặc Having been + V3/ed), S + V' },
    ],
    [
      { useCaseVi: 'Chủ ngữ của mệnh đề phân từ bắt buộc phải trùng khớp với chủ ngữ mệnh đề chính để tránh lỗi phân từ lơ lửng (dangling participle).' },
    ],
    [
      { sentenceEn: 'Designed with natural ventilation, the library consumes forty percent less energy.', translationVi: 'Được thiết kế với hệ thống thông gió tự nhiên, thư viện tiêu thụ ít năng lượng hơn 40%.', highlight: 'Designed with natural ventilation,' },
    ]),
  leafAdv('grammar.conditionals.third', 'grammar.conditionals', 'B2', 704, 'Third Conditional', 'Câu Điều kiện Loại 3',
    'Giả định trái ngược với sự việc đã xảy ra trong quá khứ để diễn tả sự tiếc nuối hoặc phân tích hệ quả giả định.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc chuẩn', structure: 'If + S + had + V3/ed, S + would / could / might + have + V3/ed' },
    ],
    [
      { useCaseVi: 'Chỉ nói về quá khứ đã khép lại, không còn khả năng thay đổi thực tế.', commonMistakeVi: 'Đặt would have V3 vào ngay trong vế If.' },
    ],
    [
      { sentenceEn: 'If the city had invested in flood barriers earlier, the downtown shops would not have suffered damage.', translationVi: 'Nếu thành phố đầu tư đê chắn lũ sớm hơn, các cửa hàng trung tâm đã không chịu thiệt hại.', highlight: 'had invested ... would not have suffered' },
    ]),
  leafAdv('grammar.reported_speech', 'grammar.clauses_voice', 'B2', 803, 'Advanced Reported Speech & Reporting Verbs', 'Câu Tường thuật Nâng cao & Động từ Dẫn Học thuật',
    'Tường thuật lời nói bằng các động từ dẫn mang sắc thái cụ thể thay vì chỉ dùng say/tell/ask.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Nhóm đi với to-V / O + to-V', structure: 'offer / refuse / threaten + to-V | warn / remind / advise + O + (not) to-V' },
      { form: 'AFFIRMATIVE', labelVi: 'Nhóm đi với giới từ + V-ing', structure: 'apologize for / insist on / accuse O of / congratulate O on / blame O for + V-ing' },
    ],
    [
      { useCaseVi: 'Cô đọng ý định của người nói (khuyên bảo, cảnh báo, thừa nhận, bác bỏ) một cách súc tích.' },
    ],
    [
      { sentenceEn: 'The auditor advised the board to revise the budget and insisted on reviewing every contract.', translationVi: 'Kiểm toán viên khuyên hội đồng điều chỉnh ngân sách và kiên quyết yêu cầu rà soát mọi hợp đồng.', highlight: 'advised ... to revise ... insisted on reviewing' },
    ]),
  leafAdv('grammar.wish_clauses', 'grammar.clauses_voice', 'B2', 804, 'Wish, If only, Would rather & It’s high time', 'Câu Ước (Wish / If only) & Giả định Hiện tại – Quá khứ',
    'Diễn tả mong ước trái thực tế, sự phàn nàn hoặc nhấn mạnh việc lẽ ra đã phải thực hiện.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Ước cho hiện tại & quá khứ', structure: 'S + wish / If only + S + V2/ed (trái hiện tại) | + S + had V3/ed (tiếc nuối quá khứ)' },
      { form: 'NOTE', labelVi: 'Phàn nàn & Khẩn thiết', structure: 'wish + O + would + V_bare | S1 + would rather + S2 + V2/ed | It’s (high/about) time + S + V2/ed' },
    ],
    [
      { useCaseVi: 'Không dùng wish + would cho chính bản thân mình (I wish I would...).' },
    ],
    [
      { sentenceEn: 'It’s high time local authorities restricted single-use plastics in wet markets.', translationVi: 'Đã đến lúc chính quyền địa phương cần hạn chế nhựa dùng một lần tại các chợ truyền thống.', highlight: 'It’s high time ... restricted' },
    ]),
  leafAdv('grammar.causative_verbs', 'grammar.clauses_voice', 'B2', 805, 'Causative Structures & Impersonal Passive', 'Thể Sai khiến (Have/Get something done) & Bị động Khách quan',
    'Diễn đạt việc thuê/nhờ người khác thực hiện dịch vụ và cấu trúc tường thuật khách quan học thuật.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Sai khiến chủ động & bị động', structure: 'have + sb + V_bare / get + sb + to-V | have / get + sth + V3/ed' },
      { form: 'NOTE', labelVi: 'Bị động khách quan', structure: 'It is said/reported/believed that + Clause ↔ S + is/are said/believed + to-V / to have V3/ed' },
    ],
    [
      { useCaseVi: 'Tạo giọng văn khách quan trong báo cáo nghiên cứu và bài luận IELTS/CEFR B2–C1.' },
    ],
    [
      { sentenceEn: 'Early exposure to music is believed to strengthen working memory in children.', translationVi: 'Việc tiếp xúc sớm với âm nhạc được cho là giúp củng cố trí nhớ làm việc ở trẻ em.', highlight: 'is believed to strengthen' },
    ]),

  // ==================== C1 (6 topics) ====================
  leafAdv('grammar.tenses.future_perfect_continuous', 'grammar.tenses', 'C1', 213, 'Future Perfect Continuous', 'Thì Tương lai hoàn thành tiếp diễn',
    'Nhấn mạnh tổng khoảng thời gian liên tục của một hoạt động tính đến một mốc cụ thể trong tương lai.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + will + have + been + V-ing (+ for + khoảng thời gian + by + mốc tương lai)' },
    ],
    [
      { useCaseVi: 'Không dùng với các động từ trạng thái (stative verbs); khi đó lùi về Future Perfect (will have known).' },
    ],
    [
      { sentenceEn: 'By next autumn, Dr. Linh will have been leading the neurology lab for fifteen years.', translationVi: 'Tính đến mùa thu tới, Tiến sĩ Linh sẽ dẫn dắt phòng thí nghiệm thần kinh học tròn 15 năm.', highlight: 'will have been leading ... for fifteen years' },
    ]),
  leafAdv('grammar.verb_forms.verbs_both', 'grammar.verb_forms', 'C1', 606, 'Verbs Taking Both Gerund and Infinitive with Meaning Shift', 'Động từ đi với cả V-ing & to-V Đổi nghĩa Sắc thái',
    'Phân biệt chính xác sự dịch chuyển nghĩa của remember, forget, regret, stop, try, mean, go on, need.',
    [
      { form: 'NOTE', labelVi: 'Quá khứ vs. Tương lai/Bổn phận', structure: 'remember/forget/regret + V-ing (việc đã xảy ra) vs. + to-V (việc cần làm tiếp theo)' },
      { form: 'NOTE', labelVi: 'Mục đích, Thử nghiệm & Bị động ngầm', structure: 'try + to-V (nỗ lực) vs. try + V-ing (thử nghiệm) | mean + to-V (có ý định) vs. mean + V-ing (đồng nghĩa với) | need + V-ing (= need to be V3)' },
    ],
    [
      { useCaseVi: 'Kiểm soát chính xác sắc thái thời gian và chủ đích trong văn viết tinh tế.' },
    ],
    [
      { sentenceEn: 'Switching to renewable energy means investing heavily upfront, though we never regretted doing so.', translationVi: 'Chuyển sang năng lượng tái tạo đồng nghĩa với việc đầu tư lớn ban đầu, dù chúng tôi chưa từng hối tiếc vì đã làm vậy.', highlight: 'means investing ... regretted doing' },
    ]),
  leafAdv('grammar.conditionals.mixed', 'grammar.conditionals', 'C1', 705, 'Mixed Conditionals & Formal Conditional Linkers', 'Câu Điều kiện Hỗn hợp & Liên từ Điều kiện Trang trọng',
    'Kết hợp giả định xuyên thời gian (Quá khứ → Hiện tại hoặc Hiện tại → Quá khứ) và dùng provided that, supposing, but for.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Quá khứ ảnh hưởng Hiện tại', structure: 'If + S + had + V3/ed, S + would/could + V_bare (now)' },
      { form: 'AFFIRMATIVE', labelVi: 'Bản chất Hiện tại ảnh hưởng Quá khứ', structure: 'If + S + V2/ed (were), S + would/could + have + V3/ed' },
      { form: 'NOTE', labelVi: 'Cụm điều kiện học thuật', structure: 'Provided (that) / On condition that + Clause | But for / Without + Noun, S + would (have)...' },
    ],
    [
      { useCaseVi: 'Lập luận nhân quả đa chiều giữa quyết định trong quá khứ và hệ quả hiện hữu.' },
    ],
    [
      { sentenceEn: 'But for the emergency scholarship, she would not be pursuing her doctorate today.', translationVi: 'Nếu không nhờ suất học bổng khẩn cấp đó, hôm nay cô ấy đã không thể đang theo đuổi bằng tiến sĩ.', highlight: 'But for ... would not be pursuing' },
    ]),
  leafAdv('grammar.inversion', 'grammar.discourse_emphasis', 'C1', 901, 'Negative & Conditional Inversion', 'Đảo ngữ với Trạng từ Phủ định & Đảo ngữ Điều kiện',
    'Đưa trạng từ phủ định/giới hạn hoặc trợ động từ câu điều kiện lên đầu câu nhằm tạo sức nặng tu từ và học thuật.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Trạng từ phủ định đầu câu', structure: 'Never / Seldom / Rarely / Little / Under no circumstances / Not only + Aux + S + V' },
      { form: 'NOTE', labelVi: 'Cụm Only & Hardly/No sooner', structure: 'Only after/when/if + Clause + Aux + S + V | No sooner + had + S + V3 + than + S + V2/ed' },
      { form: 'NOTE', labelVi: 'Đảo ngữ câu điều kiện', structure: 'Should + S + V_bare (Loại 1) | Were + S + (to-V)... (Loại 2) | Had + S + V3/ed... (Loại 3)' },
    ],
    [
      { useCaseVi: 'Với cụm Only after / Only when / Not until..., phép đảo ngữ xảy ra ở mệnh đề chính đứng phía sau chứ không đảo ở mệnh đề phụ.' },
    ],
    [
      { sentenceEn: 'Not only did the new algorithm reduce latency, but it also lowered server costs.', translationVi: 'Thuật toán mới không những giảm độ trễ mà còn cắt giảm chi phí máy chủ.', highlight: 'Not only did ... reduce' },
    ]),
  leafAdv('grammar.subjunctive', 'grammar.discourse_emphasis', 'C1', 902, 'Mandative Subjunctive', 'Thức Giả định Trang trọng (Mandative Subjunctive)',
    'Sử dụng động từ nguyên thể không chia (bare infinitive) trong mệnh đề that sau các động từ/tính từ mang tính yêu cầu cấp thiết.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Chủ động & Bị động', structure: 'propose / demand / insist / recommend / It is vital/imperative + that + S + (not) + V_bare (hoặc be + V3/ed)' },
    ],
    [
      { useCaseVi: 'Giữ nguyên V_bare ngay cả khi chủ ngữ là ngôi thứ 3 số ít hoặc mệnh đề chính ở thì quá khứ.' },
    ],
    [
      { sentenceEn: 'The ethics committee insisted that every participant be informed prior to data collection.', translationVi: 'Hội đồng đạo đức yêu cầu mọi người tham gia phải được thông báo trước khi thu thập dữ liệu.', highlight: 'insisted that ... be informed' },
    ]),
  leafAdv('grammar.cleft_sentences', 'grammar.discourse_emphasis', 'C1', 903, 'Cleft & Pseudo-Cleft Sentences', 'Câu Chẻ Nhấn mạnh (It-cleft & Wh-cleft)',
    'Tách một câu đơn thành hai mệnh đề để hướng sự chú ý tuyệt đối vào tác nhân, đối tượng, thời gian hoặc hành động trọng tâm.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'It-cleft', structure: 'It + is/was + [Thành phần nhấn mạnh] + that/who + Clause' },
      { form: 'AFFIRMATIVE', labelVi: 'Wh-cleft (Pseudo-cleft)', structure: 'What + S + V + is/was + (to) V / Noun / Clause | All (that) + S + V + is/was...' },
    ],
    [
      { useCaseVi: 'Công cụ đắc lực để chuyển trọng tâm lập luận trong bài viết nghị luận và thuyết trình học thuật.' },
    ],
    [
      { sentenceEn: 'What distinguishes expert writers is their deliberate control over sentence rhythm.', translationVi: 'Điều làm nên sự khác biệt của những người viết lão luyện chính là khả năng kiểm soát nhịp điệu câu có chủ đích.', highlight: 'What distinguishes ... is' },
    ]),

  // ==================== C2 (4 topics) ====================
  leafAdv('grammar.ellipsis_substitution', 'grammar.discourse_emphasis', 'C2', 904, 'Advanced Ellipsis & Substitution', 'Tỉnh lược & Thay thế Tinh tế (Ellipsis & Substitution)',
    'Lược bỏ thành phần lặp lại hoặc thay thế cả mệnh đề/cụm động từ bằng so, not, do so, one(s) một cách tự nhiên tuyệt đối.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Thay thế mệnh đề & cụm động từ', structure: 'assume / appear / suppose + so / not | If so / If not | do so / doing so' },
      { form: 'NOTE', labelVi: 'Tỉnh lược sau liên từ & to', structure: 'Although / While / When / If + Adj / V3/ed / Prep phrase | Reduced infinitive: "...if you want to [join]."' },
    ],
    [
      { useCaseVi: 'Tạo độ cô đọng cao cho văn bản học thuật và hội thoại tự nhiên mà không gây mơ hồ về nghĩa.' },
    ],
    [
      { sentenceEn: 'Though initially skeptical, the reviewers endorsed the protocol, and rightly so.', translationVi: 'Dù ban đầu còn hoài nghi, các phản biện viên đã thông qua quy trình đó, và việc họ làm vậy là hoàn toàn xác đáng.', highlight: 'Though initially skeptical ... and rightly so' },
    ]),
  leafAdv('grammar.fronting_emphasis', 'grammar.discourse_emphasis', 'C2', 905, 'Rhetorical Fronting & Thematic Progression', 'Đưa Thành phần Câu lên Đầu & Đảo trật tự Tu từ',
    'Đặt bổ ngữ, phân từ hoặc tính từ nhượng bộ lên đầu câu nhằm liên kết mạch văn liền mạch và tạo điểm nhấn văn chương.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Đảo phân từ / Giới từ chỉ nơi chốn', structure: '[Participle / Prep Phrase] + be/intransitive V + Subject (Gone are the days when...)' },
      { form: 'NOTE', labelVi: 'Nhượng bộ với as / though', structure: 'Adj / Adv / V_bare + as / though + S + V/may, Main Clause (Try as he might...)' },
    ],
    [
      { useCaseVi: 'Kết nối trực tiếp thông tin đã biết từ câu trước sang đầu câu sau để dẫn dắt luồng tư duy người đọc.' },
    ],
    [
      { sentenceEn: 'Compelling though the hypothesis sounded, empirical trials told a far more nuanced story.', translationVi: 'Dù giả thuyết nghe đầy sức thuyết phục, các thử nghiệm thực nghiệm lại cho thấy một câu chuyện phức tạp hơn nhiều.', highlight: 'Compelling though the hypothesis sounded' },
    ]),
  leafAdv('grammar.formulaic_subjunctive', 'grammar.discourse_emphasis', 'C2', 906, 'Formulaic Subjunctive & Idiomatic Syntactic Frames', 'Thức Giả định Cổ điển & Khung Cú pháp Thành ngữ',
    'Vận dụng chuẩn xác các cấu trúc giả định cố định mang tính tu từ cao trong tranh biện và văn viết C2.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Cấu trúc giả định đóng băng', structure: 'Be that as it may | Come what may | Suffice it to say (that)... | Far be it from sb to-V' },
    ],
    [
      { useCaseVi: 'Chuyển ý nhượng bộ sắc sảo hoặc tóm lược luận điểm mà không cần diễn giải dài dòng.' },
    ],
    [
      { sentenceEn: 'Be that as it may, short-term fiscal gains cannot justify irreversible ecological loss.', translationVi: 'Dẫu có là vậy đi nữa, lợi ích tài khóa ngắn hạn cũng không thể biện minh cho tổn thất sinh thái không thể đảo ngược.', highlight: 'Be that as it may' },
    ]),
  leafAdv('grammar.nuanced_modality', 'grammar.discourse_emphasis', 'C2', 907, 'Nuanced Modality, Hedging & Concession', 'Sắc thái Động từ Khuyết thiếu Tinh tế & Rào đón Học thuật',
    'Phân biệt các cụm khuyết thiếu gần hình thức nhưng khác hẳn sắc thái như may well, might as well, would cho đặc tính cố hữu.',
    [
      { form: 'AFFIRMATIVE', labelVi: 'Khả năng cao vs. Miễn cưỡng hợp lý', structure: 'may / might well + V (rất có khả năng đúng) vs. may / might (just) as well + V (chẳng mất gì mà không làm)' },
      { form: 'NOTE', labelVi: 'Nhượng bộ & Đặc tính điển hình', structure: 'S + may/might + V ..., but ... (nhượng bộ) | Accidents will happen (quy luật điển hình)' },
    ],
    [
      { useCaseVi: 'Thể hiện thái độ đánh giá độ chắc chắn (epistemic stance) tinh vi của người viết bản xứ.' },
    ],
    [
      { sentenceEn: 'Automated translation may well handle routine emails, yet subtle diplomacy still demands human judgment.', translationVi: 'Dịch tự động rất có thể xử lý tốt các email thông thường, song ngoại giao tinh tế vẫn đòi hỏi phán đoán của con người.', highlight: 'may well handle ... yet' },
    ]),
];
