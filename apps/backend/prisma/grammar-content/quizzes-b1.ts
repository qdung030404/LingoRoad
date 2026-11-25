import { RawQuizItem } from './quizzes-a1-a2';

export const GRAMMAR_QUIZZES_B1: Readonly<Record<string, readonly RawQuizItem[]>> = {
  'grammar.tenses.present_perfect': [
    ['My cousin ___ in Da Nang since she graduated from university.', ['lived', 'lives', 'has lived', 'is living'], 2, 'Mốc bắt đầu trong quá khứ "since + mệnh đề Quá khứ đơn" đi với mệnh đề chính chia Hiện tại hoàn thành "has lived".'],
    ['Have you ___ the quarterly report to the director yet?', ['send', 'sent', 'sending', 'sended'], 1, 'Hiện tại hoàn thành nghi vấn với "yet" dùng quá khứ phân từ (V3) của send là "sent".'],
    ['Which sentence is grammatically INCORRECT?', ['I have visited Hue twice.', 'She has just finished her lunch.', 'We have met him two days ago.', 'They haven’t replied so far.'], 2, 'Trạng ngữ chỉ thời điểm quá khứ hoàn tất "two days ago" bắt buộc dùng Quá khứ đơn ("We met him..."), không dùng Hiện tại hoàn thành.'],
  ],
  'grammar.tenses.present_perfect_continuous': [
    ['His eyes are red because he ___ at the computer screen for five hours.', ['stares', 'stared', 'has been staring', 'is staring'], 2, 'Hành động kéo dài liên tục từ quá khứ để lại dấu hiệu rõ ở hiện tại ("eyes are red") dùng Hiện tại hoàn thành tiếp diễn.'],
    ['How long ___ you ___ for the shuttle bus?', ['do / wait', 'did / wait', 'have / been waiting', 'are / waiting'], 2, 'Câu hỏi "How long" cho hành động bắt đầu trong quá khứ và vẫn đang tiếp diễn dùng "have you been waiting".'],
    ['It ___ all morning, and the courtyard is still completely wet.', ['rains', 'has been raining', 'rained yesterday', 'will rain'], 1, '"all morning" nhấn mạnh tính liên tục của cơn mưa kéo dài đến hiện tại: has been raining.'],
  ],
  'grammar.tenses.future_continuous': [
    ['Please don’t call between 2 p.m. and 4 p.m. tomorrow; I ___ a workshop.', ['conduct', 'will be conducting', 'have conducted', 'conducted'], 1, 'Hành động sẽ đang diễn ra trong một khung giờ xác định ở tương lai dùng Tương lai tiếp diễn: will be conducting.'],
    ['This time next Saturday, we ___ along My Khe beach.', ['walk', 'walked', 'will be walking', 'have walked'], 2, '"This time next Saturday" là dấu hiệu điển hình của thì Tương lai tiếp diễn.'],
    ['Will you ___ the projector during the afternoon session?', ['using', 'be using', 'used', 'to use'], 1, 'Câu hỏi lịch sự về kế hoạch sử dụng trong tương lai dùng "Will + S + be + V-ing?".'],
  ],
  'grammar.tenses.used_to_would': [
    ['There ___ a cinema on this corner, but it closed five years ago.', ['used to be', 'would be', 'is used to being', 'uses to be'], 0, 'Với trạng thái tồn tại ("be") trong quá khứ đã chấm dứt, chỉ được dùng "used to be" (không dùng "would be").'],
    ['After living in London for a year, Minh ___ driving on the left.', ['used to', 'got used to', 'would', 'didn’t use'], 1, '"get/be used to + V-ing" mang nghĩa trở nên quen với một việc gì đó.'],
    ['Did your grandfather ___ tell folk stories in the evenings?', ['used to', 'use to', 'using to', 'be used to'], 1, 'Sau trợ động từ "Did", cấu trúc quay về nguyên thể không "-d": "Did + S + use to + V?".'],
  ],
  'grammar.questions.indirect': [
    ['Could you tell me where ___?', ['is the nearest pharmacy', 'the nearest pharmacy is', 'does the pharmacy open', 'was the pharmacy'], 1, 'Trong câu hỏi gián tiếp sau "Could you tell me where...", mệnh đề giữ trật tự câu kể (S + V), không đảo trợ động từ.'],
    ['Do you know ___ the conference registration fee includes lunch?', ['what', 'whether', 'that', 'which'], 1, 'Khi lồng câu hỏi Yes/No vào câu gián tiếp, ta dùng liên từ "if" hoặc "whether".'],
    ['I was wondering how long ___ to process a visa application.', ['does it take', 'it takes', 'takes it', 'did it took'], 1, 'Sau "I was wondering how long...", giữ trật tự chủ ngữ "it" đứng trước động từ "takes".'],
  ],
  'grammar.questions.subject_object': [
    ['"___ designed the new metro station?" — "A Japanese architect did."', ['Who did', 'Who', 'Whom did', 'What did'], 1, '"Who" đóng vai trò làm Chủ ngữ trực tiếp của hành động "designed" nên không mượn trợ động từ "did".'],
    ['Who ___ you invite to the graduation ceremony last weekend?', ['did', 'were', 'have', 'was'], 0, 'Ở đây "you" là chủ ngữ còn "Who" là tân ngữ của động từ "invite", nên phải mượn trợ động từ "did".'],
    ['What ___ the sudden power outage across the district?', ['did cause', 'caused', 'was caused', 'causing'], 1, 'Câu hỏi chủ ngữ "What" hỏi tác nhân gây ra sự cố mất điện nên chia động từ trực tiếp: "What caused...?".'],
  ],
  'grammar.quantifiers.few_little': [
    ['Fortunately, we still have ___ eggs left, so we can bake a cake.', ['few', 'a few', 'little', 'a little'], 1, '"eggs" là danh từ đếm được số nhiều và ngữ cảnh tích cực (đủ để làm bánh) nên dùng "a few".'],
    ['The project made ___ progress because of the funding shortage.', ['few', 'a few', 'very little', 'many'], 2, '"progress" là danh từ không đếm được và mang sắc thái thiếu hụt tiêu cực nên dùng "(very) little".'],
    ['Only ___ students knew the answer to the bonus question.', ['a little', 'little', 'a few', 'much'], 2, 'Cụm cố định "Only a few + danh từ số nhiều" chỉ một số lượng rất nhỏ người/vật đếm được.'],
  ],
  'grammar.quantifiers.all_most_some': [
    ['___ of the two proposals met the safety requirements, so we rejected them.', ['None', 'Neither', 'Both', 'Either'], 1, 'Khi phủ định cả 2 đối tượng ("the two proposals"), ta dùng "Neither of".'],
    ['___ smartphones today come with high-resolution cameras.', ['Most of', 'Most', 'Almost', 'Every of'], 1, 'Trước danh từ số nhiều nói chung không có mạo từ "the/these/my", dùng "Most + N" (không có "of").'],
    ['Neither the manager nor the assistants ___ aware of the schedule change.', ['was', 'were', 'is', 'has been'], 1, 'Với "Neither A nor B", động từ chia theo chủ ngữ gần nó nhất ("the assistants" số nhiều → "were").'],
  ],
  'grammar.comparatives_superlatives.comparative_adverbs': [
    ['Could you speak a bit ___ so everyone in the back row can hear?', ['clearer', 'more clearly', 'most clearly', 'clear'], 1, 'Bổ nghĩa cho động từ thường "speak" cần dùng trạng từ so sánh hơn: "more clearly".'],
    ['She finished the coding test ___ than anyone else in her group.', ['more fast', 'faster', 'more fastly', 'fastest'], 1, '"fast" vừa là tính từ vừa là trạng từ ngắn; dạng so sánh hơn là "faster" (không có từ "fastly").'],
    ['Our team collaborated ___ this quarter than in the previous one.', ['effective', 'more effectively', 'most effectively', 'effectiver'], 1, 'Trạng từ dài "effectively" bổ nghĩa cho động từ "collaborated" có so sánh hơn là "more effectively".'],
  ],
  'grammar.comparatives_superlatives.superlative_adverbs': [
    ['Among all the interns, Hoang adapts to new tools ___.', ['more quickly', 'the most quickly', 'quickest than', 'quicker'], 1, 'So sánh nhất của trạng từ đuôi "-ly" ("quickly") trong một tập hợp dùng "(the) most quickly".'],
    ['Who performed ___ in the national robotics competition?', ['good', 'better', 'the best', 'most well'], 2, 'So sánh nhất bất quy tắc của trạng từ "well" là "(the) best".'],
    ['Bus route 14 runs ___ during weekday rush hours.', ['more frequent', 'the most frequently', 'frequentest', 'as frequently'], 1, 'Bổ nghĩa cho động từ "runs" ở mức độ cao nhất dùng trạng từ so sánh nhất "the most frequently".'],
  ],
  'grammar.verb_forms.gerunds': [
    ['___ enough sleep is essential for memory consolidation.', ['Get', 'Getting', 'To getting', 'Got'], 1, 'Danh động từ "Getting" đóng vai trò chủ ngữ của câu và đi với động từ số ít "is".'],
    ['Thank you for ___ me prepare the workshop materials.', ['help', 'to help', 'helping', 'helped'], 2, 'Động từ đứng ngay sau giới từ ("for") bắt buộc chia ở dạng V-ing: "helping".'],
    ['Do you mind ___ the window? It’s getting chilly.', ['close', 'to close', 'closing', 'closed'], 2, 'Sau động từ "mind" luôn dùng danh động từ V-ing: "mind closing".'],
  ],
  'grammar.verb_forms.infinitives': [
    ['They decided ___ the outdoor concert until next Saturday.', ['postponing', 'to postpone', 'postpone', 'postponed'], 1, 'Sau động từ "decide" dùng động từ nguyên mẫu có to: "decide to postpone".'],
    ['The instructor let the students ___ dictionaries during the practice task.', ['to use', 'using', 'use', 'used'], 2, 'Cấu trúc "let + tân ngữ + V nguyên thể không to": let the students use.'],
    ['We left home at 5 a.m. in order ___ rush-hour traffic.', ['avoiding', 'avoid', 'to avoid', 'for avoid'], 2, 'Cụm chỉ mục đích "in order to + V nguyên thể": in order to avoid.'],
  ],
  'grammar.conditionals.zero': [
    ['If you mix blue and yellow paint, you ___ green.', ['will got', 'get', 'would get', 'got'], 1, 'Câu điều kiện loại 0 diễn tả sự thật hiển nhiên nên cả hai mệnh đề đều chia Hiện tại đơn ("mix ... get").'],
    ['Plants die if they ___ enough water and sunlight.', ['won’t receive', 'don’t receive', 'didn’t receive', 'wouldn’t receive'], 1, 'Quy luật tự nhiên ở điều kiện loại 0 dùng Hiện tại đơn phủ định "don’t receive".'],
    ['When the battery level ___ below 10%, the screen dims automatically.', ['will drop', 'drops', 'dropped', 'would drop'], 1, 'Cơ chế tự động luôn đúng mỗi khi xảy ra dùng Hiện tại đơn ở cả hai vế: "drops".'],
  ],
  'grammar.conditionals.first': [
    ['Unless we ___ seats tonight, the weekend train will be sold out.', ['will reserve', 'reserve', 'reserved', 'would reserve'], 1, '"Unless" (= If ... not) trong câu điều kiện loại 1 đi với thì Hiện tại đơn "reserve" (không dùng will sau Unless).'],
    ['I will call you as soon as my flight ___ in Ho Chi Minh City.', ['will land', 'lands', 'landed', 'is landing to'], 1, 'Mệnh đề thời gian tương lai sau "as soon as" chia thì Hiện tại đơn ("lands").'],
    ['Write down the confirmation code ___ you lose internet access at the gate.', ['unless', 'in case', 'even if not', 'so that will'], 1, '"in case" mang nghĩa "phòng khi" tình huống xảy ra trước để chuẩn bị sẵn.'],
  ],
  'grammar.conditionals.second': [
    ['If I ___ more free time, I would learn to play the cello.', ['have', 'will have', 'had', 'have had'], 2, 'Câu điều kiện loại 2 giả định trái với hiện tại dùng Quá khứ đơn ở vế If ("had") và "would + V" ở vế chính.'],
    ['If I ___ in your position, I would negotiate the deadline carefully.', ['am', 'was been', 'were', 'will be'], 2, 'Trong câu điều kiện loại 2 chuẩn mực, to be chia là "were" cho tất cả các ngôi.'],
    ['What ___ you do if you won a research grant abroad?', ['will', 'do', 'would', 'did'], 2, 'Mệnh đề chính của câu điều kiện loại 2 ("if you won...") dùng trợ động từ "would".'],
  ],
  'grammar.passive_voice': [
    ['This historic bridge ___ over a century ago.', ['built', 'was built', 'has built', 'is building'], 1, 'Chủ ngữ "This historic bridge" chịu tác động và có mốc quá khứ "over a century ago" nên dùng bị động Quá khứ đơn "was built".'],
    ['All safety helmets must ___ inside the construction zone.', ['wear', 'wearing', 'be worn', 'have wear'], 2, 'Bị động với động từ khuyết thiếu: "must + be + V3" (wear → worn).'],
    ['Over 500 trees ___ by local volunteers since last spring.', ['planted', 'were planting', 'have been planted', 'are planting'], 2, 'Có "since last spring" và tác nhân "by local volunteers" nên dùng bị động Hiện tại hoàn thành: have been planted.'],
  ],
  'grammar.relative_clauses': [
    ['The engineer ___ designed this solar panel won an international award.', ['which', 'who', 'whose', 'where'], 1, 'Đại từ quan hệ "who" thay thế cho danh từ chỉ người "The engineer" làm chủ ngữ.'],
    ['That is the café ___ we first discussed our startup idea.', ['which', 'where', 'who', 'when'], 1, '"where" (= at/in which) thay thế cho trạng ngữ chỉ nơi chốn sau "the café".'],
    ['Ha Long Bay, ___ is a UNESCO World Heritage Site, draws visitors worldwide.', ['that', 'which', 'where', 'what'], 1, 'Trong mệnh đề quan hệ không xác định (ngăn cách bởi dấu phẩy), bắt buộc dùng "which", cấm dùng "that".'],
  ],
};
