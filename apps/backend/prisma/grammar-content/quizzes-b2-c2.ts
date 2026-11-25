import { RawQuizItem } from './quizzes-a1-a2';

export const GRAMMAR_QUIZZES_B2_C2: Readonly<Record<string, readonly RawQuizItem[]>> = {
  // ==================== B2 (10) ====================
  'grammar.tenses.past_perfect': [
    ['When we arrived at the auditorium, the keynote speech ___.', ['already started', 'has already started', 'had already started', 'was starting since'], 2, 'Hành động bắt đầu trước thời điểm "arrived" trong quá khứ chia thì Quá khứ hoàn thành: had already started.'],
    ['She realized she ___ her passport at the hotel reception.', ['leaves', 'has left', 'had left', 'was leaving'], 2, 'Việc để quên hộ chiếu xảy ra trước lúc nhận ra ("realized") nên dùng "had left".'],
    ['By the time the firefighters reached the warehouse, the alarm ___ everyone.', ['alerted', 'has alerted', 'had alerted', 'alerts'], 2, 'Cấu trúc "By the time + S + V2/ed, S + had + V3/ed".'],
  ],
  'grammar.tenses.past_perfect_continuous': [
    ['They ___ for nearly two hours before the customer support line finally answered.', ['waited', 'have been waiting', 'had been waiting', 'were waiting since'], 2, 'Nhấn mạnh độ dài liên tục ("for nearly two hours") trước một mốc quá khứ ("answered") dùng Quá khứ hoàn thành tiếp diễn.'],
    ['Her hands were covered in flour because she ___ bread all afternoon.', ['baked', 'has baked', 'had been baking', 'is baking'], 2, 'Hành động kéo dài trong quá khứ giải thích cho kết quả ở quá khứ ("were covered") dùng "had been baking".'],
    ['How long ___ the server ___ errors before the engineer restarted it?', ['did / log', 'has / been logging', 'had / been logging', 'was / logged'], 2, 'Câu hỏi khoảng thời gian kéo dài tính tới trước một sự kiện quá khứ dùng "had + S + been + V-ing".'],
  ],
  'grammar.tenses.future_perfect': [
    ['By 2030, solar power ___ a much larger share of national electricity.', ['replaces', 'is replacing', 'will have replaced', 'replaced'], 2, 'Cụm "By + mốc thời gian tương lai" diễn tả hành động hoàn tất trước mốc đó: will have replaced.'],
    ['We ___ all module tests by the time the release freeze begins tonight.', ['complete', 'will have completed', 'have completed', 'completed'], 1, '"by the time + Hiện tại đơn (mang nghĩa tương lai)" đi kèm Tương lai hoàn thành ở mệnh đề chính.'],
    ['How many chapters ___ you ___ by Sunday evening?', ['do / read', 'will / have read', 'are / reading', 'did / read'], 1, 'Hỏi số lượng kết quả hoàn tất trước mốc tương lai "by Sunday evening" dùng "will + S + have + V3".'],
  ],
  'grammar.verb_forms.verbs_gerund': [
    ['The committee postponed ___ a final decision until independent data arrived.', ['to make', 'making', 'make', 'made'], 1, 'Sau động từ "postpone" bắt buộc dùng danh động từ V-ing: postponed making.'],
    ['Most commuters strongly objected to ___ higher parking fees downtown.', ['pay', 'paying', 'be paid', 'paid'], 1, 'Trong cụm "object to", từ "to" là giới từ nên động từ theo sau phải chia V-ing: paying.'],
    ['The suspect denied ___ near the bank on the night of the robbery.', ['to see', 'seeing', 'having been seen', 'be seen'], 2, 'Dạng danh động từ hoàn thành bị động "having been seen" diễn tả việc bị nhìn thấy xảy ra trước lúc phủ nhận.'],
  ],
  'grammar.verb_forms.verbs_infinitive': [
    ['New scholarship policies enabled rural students ___ top universities.', ['attending', 'attend', 'to attend', 'attended'], 2, 'Cấu trúc "enable + tân ngữ + to-V": cho phép/tạo điều kiện cho ai làm gì.'],
    ['The ancient manuscript appears ___ written in the twelfth century.', ['being', 'to be', 'to have been', 'having been'], 2, 'Nguyên mẫu hoàn thành bị động "to have been + V3" diễn tả việc được viết ở quá khứ trước thời điểm nhận định hiện tại ("appears").'],
    ['Security staff warned visitors ___ feed the wild monkeys.', ['don’t', 'to not', 'not to', 'against to'], 2, 'Cấu trúc phủ định chuẩn: "warn + O + not to-V".'],
  ],
  'grammar.verb_forms.participles': [
    ['___ from recycled aluminum, the laptop chassis is both sturdy and lightweight.', ['Making', 'Made', 'Having make', 'To make'], 1, 'Chủ ngữ "the laptop chassis" mang nghĩa bị động (được làm từ nhôm tái chế) nên rút gọn bằng quá khứ phân từ "Made".'],
    ['___ all the safety checks, the pilot requested clearance for takeoff.', ['Completing to', 'Completed', 'Having completed', 'Been completing'], 2, '"Having + V3" nhấn mạnh hành động hoàn tất toàn bộ khâu kiểm tra trước khi xin phép cất cánh (cùng chủ ngữ "the pilot").'],
    ['Anyone ___ for the fellowship must submit two recommendation letters.', ['applies', 'applied', 'applying', 'apply'], 2, 'Rút gọn mệnh đề quan hệ chủ động ("Anyone who applies...") thành hiện tại phân từ "applying".'],
  ],
  'grammar.conditionals.third': [
    ['If we ___ the backup generator last month, the clinic wouldn’t have lost power.', ['installed', 'have installed', 'had installed', 'would install'], 2, 'Câu điều kiện loại 3 giả định trái quá khứ dùng "If + S + had + V3/ed".'],
    ['She ___ the train if the taxi driver hadn’t taken a shortcut.', ['missed', 'would miss', 'would have missed', 'had missed'], 2, 'Mệnh đề chính của câu điều kiện loại 3 dùng "would/could/might + have + V3/ed".'],
    ['If the instructions had been clearer, fewer applicants ___ mistakes.', ['made', 'will make', 'would have made', 'had made'], 2, 'Giả định ngược quá khứ ở cả hai vế: "had been ... would have made".'],
  ],
  'grammar.reported_speech': [
    ['Lan apologized ___ the rehearsal without notifying the stage manager.', ['to miss', 'for missing', 'that she misses', 'on missing'], 1, 'Cấu trúc động từ tường thuật "apologize (to sb) for + V-ing".'],
    ['The lead researcher insisted ___ the experiment under stricter controls.', ['to repeat', 'on repeating', 'for repeating', 'repeating'], 1, 'Động từ dẫn "insist" đi với giới từ "on + V-ing": insisted on repeating.'],
    ['The lawyer advised her client ___ sign the document before reading every clause.', ['don’t', 'not to', 'to not', 'against'], 1, 'Cấu trúc tường thuật lời khuyên phủ định: "advise + O + not to-V".'],
  ],
  'grammar.wish_clauses': [
    ['I wish I ___ more attention during statistics lectures at university.', ['paid', 'pay', 'had paid', 'would pay'], 2, 'Ước tiếc nuối về một việc đã qua trong quá khứ dùng "wish + S + had + V3/ed".'],
    ['It’s high time we ___ our legacy authentication server.', ['upgrade', 'upgraded', 'have upgraded', 'will upgrade'], 1, 'Sau "It’s (high/about) time + S + V2/ed" dùng động từ chia quá khứ giả định ("upgraded") để nhấn mạnh việc cần làm ngay ở hiện tại.'],
    ['I’d rather you ___ confidential project details in public cafés.', ['don’t discuss', 'didn’t discuss', 'won’t discuss', 'not discuss'], 1, '"would rather + S2 + V2/ed" diễn tả mong muốn người khác làm/không làm gì ở hiện tại.'],
  ],
  'grammar.causative_verbs': [
    ['We need to have the air-conditioning ducts ___ before summer arrives.', ['clean', 'cleaning', 'cleaned', 'to clean'], 2, 'Thể sai khiến bị động "have + vật + V3/ed" (thuê người vệ sinh ống điều hòa): have ... cleaned.'],
    ['The mentor got the interns ___ their own architecture diagrams.', ['draft', 'to draft', 'drafted', 'drafting'], 1, 'Sai khiến chủ động với "get": "get + người + to-V" (khác với "have + người + V nguyên thể").'],
    ['The ancient temple is reported ___ damaged during the seventeenth-century storm.', ['being', 'to be', 'to have been', 'that it was'], 2, 'Bị động khách quan "is reported + to have been V3" vì sự việc hư hại xảy ra trong quá khứ trước thời điểm tường thuật.'],
  ],

  // ==================== C1 (6) ====================
  'grammar.tenses.future_perfect_continuous': [
    ['By November, Prof. Hieu ___ climate models at this institute for twenty years.', ['analyzes', 'will analyze', 'will have been analyzing', 'has analyzed'], 2, 'Nhấn mạnh tổng thời gian liên tục ("for twenty years") tính tới một mốc tương lai ("By November") dùng Tương lai hoàn thành tiếp diễn.'],
    ['When the marathon runners reach the stadium, they ___ for over three hours.', ['are running', 'will have been running', 'ran', 'have run'], 1, 'Hoạt động kéo dài liên tục tính đến thời điểm tương lai "When ... reach" dùng "will have been running".'],
    ['Which sentence is grammatically sound for a stative verb?', ['By June, I will have been knowing her for ten years.', 'By June, I will have known her for ten years.', 'By June, I am knowing her for ten years.', 'By June, I knew her for ten years.'], 1, 'Động từ trạng thái "know" không chia tiếp diễn nên ở mốc tương lai ta dùng Tương lai hoàn thành "will have known".'],
  ],
  'grammar.verb_forms.verbs_both': [
    ['I clearly remember ___ the backup drive before leaving, so the files must be safe.', ['to lock', 'locking', 'lock', 'locked'], 1, '"remember + V-ing" nghĩa là nhớ lại một hành động đã thực hiện rồi trong quá khứ.'],
    ['After summarizing the survey data, the speaker went on ___ policy recommendations.', ['outlining', 'to outline', 'outline', 'for outlining'], 1, '"go on + to-V" diễn tả chuyển sang làm một bước/nội dung mới tiếp theo (khác "go on + V-ing" là tiếp tục việc đang làm).'],
    ['The wooden window frames desperately need ___ before the rainy season.', ['to repaint', 'repainting', 'repainted', 'be repainted'], 1, 'Với chủ ngữ chỉ vật, "need + V-ing" mang nghĩa bị động tương đương "need to be repainted".'],
  ],
  'grammar.conditionals.mixed': [
    ['If she ___ fluent in German, she would have applied for the Munich fellowship last month.', ['had been', 'were', 'is', 'would be'], 1, 'Điều kiện hỗn hợp (Bản chất hiện tại → Hệ quả quá khứ): hiện tại cô ấy vẫn không thông thạo tiếng Đức nên vế If dùng loại 2 ("were"), vế chính dùng loại 3.'],
    ['If they hadn’t digitized the archives, researchers ___ access those records today.', ['couldn’t have', 'couldn’t', 'can’t', 'won’t'], 1, 'Điều kiện hỗn hợp (Sự việc quá khứ → Kết quả hiện tại "today"): vế If loại 3 ("hadn’t digitized"), vế chính loại 2 ("couldn’t access").'],
    ['___ the timely intervention of the coastguard, the vessel would have capsized.', ['Unless', 'Provided that', 'But for', 'Supposing'], 2, '"But for + cụm danh từ" (= If it hadn’t been for...) diễn tả "Nếu không nhờ có...".'],
  ],
  'grammar.inversion': [
    ['Seldom ___ such unanimous support across competing research teams.', ['we witness', 'do we witness', 'we have witnessed', 'witnessed we'], 1, 'Trạng từ phủ định/hiếm gặp "Seldom" đứng đầu câu bắt buộc đảo trợ động từ lên trước chủ ngữ: "Seldom do we witness...".'],
    ['___ you require further technical documentation, please contact our engineering desk.', ['Were', 'Had', 'Should', 'Unless'], 2, 'Đảo ngữ câu điều kiện loại 1 (thay cho "If you should require..."): "Should + S + V nguyên thể".'],
    ['Only after the audit was published ___ the scale of the discrepancy.', ['the board realized', 'did the board realize', 'realized the board', 'had realized the board'], 1, 'Với "Only after + mệnh đề phụ" đứng đầu câu, phép đảo ngữ diễn ra ở mệnh đề chính phía sau: "did the board realize".'],
  ],
  'grammar.subjunctive': [
    ['The cybersecurity panel recommended that multi-factor authentication ___ mandatory.', ['is', 'was', 'be', 'being'], 2, 'Thức giả định trang trọng sau "recommend that + S + V nguyên thể không chia": dùng "be".'],
    ['It is imperative that every clinical sample ___ stored below minus twenty degrees.', ['is', 'be', 'was', 'will be'], 1, 'Sau cấu trúc "It is imperative that...", động từ luôn ở dạng nguyên thể bị động "be stored".'],
    ['The treaty stipulates that neither party ___ tariffs unilaterally.', ['raises', 'raise', 'raised', 'raising'], 1, 'Sau "stipulate that...", ngôi thứ 3 số ít "neither party" vẫn giữ nguyên động từ không chia "-s": "raise".'],
  ],
  'grammar.cleft_sentences': [
    ['It was the lack of transparent metrics ___ undermined public trust in the rankings.', ['who', 'where', 'that', 'what'], 2, 'Câu chẻ It-cleft nhấn mạnh danh từ sự vật ("the lack of transparent metrics") dùng liên từ "that": It was ... that...'],
    ['___ the research team needs most now is longitudinal field data.', ['That', 'It', 'What', 'Which'], 2, 'Câu chẻ giả (Wh-cleft): "What + S + V + is/was + thành phần nhấn mạnh".'],
    ['It was not until the sensor logs were recovered ___ investigators identified the fault.', ['when', 'that', 'which', 'then'], 1, 'Cấu trúc câu chẻ cố định với mốc thời gian: "It was not until ... that + S + V2/ed".'],
  ],

  // ==================== C2 (4) ====================
  'grammar.ellipsis_substitution': [
    ['"Will the inflation rate stabilize next quarter?" — "Most economists expect ___."', ['it', 'so', 'that', 'thus'], 1, 'Dùng "so" sau các động từ nhận thức/kỳ vọng (expect, assume, suppose, hope) để thay thế toàn bộ mệnh đề khẳng định trước đó.'],
    ['Though ___ by budget constraints, the symphony delivered an unforgettable season.', ['hampering', 'hampered', 'they hampering', 'to hamper'], 1, 'Tỉnh lược chủ ngữ + to be sau liên từ nhượng bộ ("Though [it was] hampered by...").'],
    ['Participants may withdraw at any stage should they wish ___.', ['so', 'to', 'doing', 'it'], 1, 'Tỉnh lược nguyên mẫu (Reduced infinitive): giữ lại chữ "to" thay cho cả cụm "to withdraw" ("...should they wish to").'],
  ],
  'grammar.fronting_emphasis': [
    ['___ the days when a single textbook could capture an entire scientific discipline.', ['Going are', 'Gone are', 'Are gone', 'Gone have'], 1, 'Đưa phân từ "Gone" lên đầu câu kèm đảo động từ liên kết trước chủ ngữ dài ("Gone are the days when...").'],
    ['___ as the proposal appeared on paper, field engineers spotted three bottlenecks.', ['Ingenious', 'Ingeniously', 'Ingenuity', 'More ingenious'], 0, 'Cấu trúc đảo tính từ nhượng bộ bậc C2: "Adj + as/though + S + V" (= Although the proposal appeared ingenious...).'],
    ['Seated at the far end of the oak table ___ the two chief negotiators.', ['was', 'were', 'had', 'being'], 1, 'Khi đưa cụm phân từ chỉ vị trí lên đầu câu, động từ chia theo chủ ngữ thực đứng phía sau ("the two chief negotiators" → "were").'],
  ],
  'grammar.formulaic_subjunctive': [
    ['___ as it may, we cannot delay the security patch another week.', ['Be that', 'It be', 'That is', 'Were that'], 0, 'Khung giả định cổ điển cố định "Be that as it may" (= Dù có là vậy đi nữa).'],
    ['___ it from me to criticize their methodology, yet the sample size seems tiny.', ['Long be', 'Far be', 'Wide is', 'High be'], 1, 'Cấu trúc thành ngữ giả định "Far be it from me to-V" (= Tôi hoàn toàn không có ý...).'],
    ['___ it to say, the merger reshaped the entire telecommunications sector.', ['Enough', 'Suffice', 'Sufficient', 'Sufficing'], 1, 'Cấu trúc giả định trang trọng "Suffice it to say (that)..." (= Chỉ cần nói ngắn gọn rằng...).'],
  ],
  'grammar.nuanced_modality': [
    ['The archive looks disorganized, yet it ___ hold the missing correspondence.', ['may as well', 'may well', 'would rather', 'shall well'], 1, '"may/might well + V" diễn tả khả năng rất cao điều đó là đúng (khác hẳn "may as well" là chẳng mất gì mà không làm).'],
    ['Since the ferry has been canceled for the night, we ___ book a room nearby.', ['might well to', 'might just as well', 'would well', 'can as well to'], 1, '"might (just) as well + V" diễn tả lựa chọn hợp lý nhất trong hoàn cảnh không còn cách nào tốt hơn.'],
    ['Brilliant ___ she may be, leading a cross-functional team requires patience.', ['even', 'though', 'despite', 'however'], 1, 'Cấu trúc nhượng bộ sắc thái khuyết thiếu bậc C2: "Adj + though/as + S + may be...".'],
  ],
};
