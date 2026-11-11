'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Brain,
  Gamepad2,
  MessageSquareQuote,
  Layers,
  Clock,
  Network,
  Cpu,
  CheckCircle2
} from 'lucide-react';

export const MethodologySection: React.FC = () => {
  const [viewMode, setViewMode] = useState<'learner' | 'academic'>('learner');

  return (
    <section id="methodology" className="scroll-mt-20 bg-slateDark-25/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
            <Sparkles className="h-3.5 w-3.5 text-brand-700" />
            Phương pháp học thông minh
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
            {viewMode === 'learner'
              ? 'Học tiếng Anh dễ dàng hơn nhờ công nghệ thích ứng'
              : 'Nền tảng Khoa học & Thuật toán Trí tuệ Nhân tạo'}
          </h2>
          <p className="mt-4 text-base text-slateDark-700 sm:text-lg">
            {viewMode === 'learner'
              ? 'Không còn học vẹt, không phải làm đề thi dài mệt mỏi. LingoRoad hiểu cách não bộ bạn ghi nhớ và tự động thiết kế việc học vừa vặn với riêng bạn.'
              : 'Mọi tiến trình học tập của học viên đều được mô hình hóa bằng các thuật toán định lượng chuẩn mực: IRT 3PL, FSRS-4.5, Curriculum DAG và LLM+RAG.'}
          </p>

          {/* Mode Switcher Toggle */}
          <div className="mt-8 inline-flex rounded-2xl bg-white p-1.5 border border-slateDark-200 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('learner')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                viewMode === 'learner'
                  ? 'bg-brand-500 !text-white shadow-sm'
                  : 'text-slateDark-600 hover:text-slateDark-900 hover:bg-slateDark-50'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>Dành cho người học (Dễ hiểu &amp; Thực tế)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('academic')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                viewMode === 'academic'
                  ? 'bg-slateDark-900 !text-white shadow-sm'
                  : 'text-slateDark-600 hover:text-slateDark-900 hover:bg-slateDark-50'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Chuyên sâu Đồ án &amp; Thuật toán AI</span>
            </button>
          </div>
        </div>

        {/* View Mode 1: Dành cho người dùng phổ thông (Learner View) */}
        {viewMode === 'learner' && (
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">

            {/* Card 1: CAT Test */}
            <div className="group rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200 group-hover:scale-105 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-bold text-brand-700">
                  Tiết kiệm 80% thời gian thi
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-slateDark-900">
                1. Đo trình độ chuẩn xác chỉ sau 15 câu hỏi
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slateDark-700">
                Thay vì phải còng lưng làm đề thi thử 50-100 câu dài 2 tiếng, hệ thống tự động điều chỉnh theo bạn:
                <strong> Bạn làm đúng, câu sau sẽ khó hơn; làm sai, câu sau sẽ dễ lại</strong>.
                Chỉ sau 10-15 phút là biết ngay bạn đang ở trình độ nào (từ A1 đến C2) mà không cảm thấy nản lòng.
              </p>

              <div className="mt-5 rounded-xl bg-brand-25/50 border border-brand-100 p-4 space-y-2.5 text-xs text-slateDark-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-brand-600 flex-shrink-0" />
                  <span>Không lo đoán mò hay áp lực điểm số</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-brand-600 flex-shrink-0" />
                  <span>Độ khó co giãn vừa vặn với năng lực của riêng bạn</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-brand-600 flex-shrink-0" />
                  <span>Xác định đúng điểm mạnh và phần kiến thức đang hổng</span>
                </div>
              </div>
            </div>

            {/* Card 2: FSRS Spaced Repetition */}
            <div className="group rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:scale-105 transition-transform">
                  <Brain className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                  Nhớ lâu gấp 3 lần
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-slateDark-900">
                2. Nhắc ôn từ vựng đúng thời điểm sắp quên
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slateDark-700">
                Bộ não con người thường quên tới 70% từ mới sau vài ngày nếu không ôn.
                LingoRoad theo dõi độ bền trí nhớ của từng từ và <strong>chỉ nhắc bạn ôn lại ngay lúc bạn chuẩn bị quên</strong>.
                Nhờ vậy, bạn không cần chép phạt hàng trăm lần mà vẫn nhớ từ vựng như in.
              </p>

              <div className="mt-5 rounded-xl bg-emerald-25/50 border border-emerald-100 p-4 space-y-2.5 text-xs text-slateDark-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Giảm 40% số lần phải ôn bài mỗi ngày</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Từ khó sẽ xuất hiện nhiều hơn, từ dễ tự động lùi ngày</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Học 10 từ là nhớ sâu cả 10 từ vào trí nhớ dài hạn</span>
                </div>
              </div>
            </div>

            {/* Card 3: DAG Knowledge Tree */}
            <div className="group rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 group-hover:scale-105 transition-transform">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
                  Học như chơi game
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-slateDark-900">
                3. Học từ gốc đến ngọn, nói không với hổng kiến thức
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slateDark-700">
                Toàn bộ bài học được thiết kế như cây kỹ năng mở khóa từng ải.
                Bạn chỉ chuyển sang các cấu trúc ngữ pháp phức tạp khi đã nắm vững kiến thức căn bản làm nền móng.
                <strong> Không bao giờ rơi vào cảm giác &quot;chưa biết đi đã phải học chạy&quot;</strong>.
              </p>

              <div className="mt-5 rounded-xl bg-blue-25/50 border border-blue-100 p-4 space-y-2.5 text-xs text-slateDark-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span>Biết rõ hôm nay cần học bài nào để tiến bộ</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span>Tự động phát hiện lỗ hổng và đề xuất bài củng cố</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span>Mỗi ngày tích lũy thêm một mảng kiến thức vững chắc</span>
                </div>
              </div>
            </div>

            {/* Card 4: AI Advisor & Speech */}
            <div className="group rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amberGold-50 text-amber-600 border border-amberGold-500/30 group-hover:scale-105 transition-transform">
                  <MessageSquareQuote className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-amberGold-50 border border-amberGold-500/30 px-3 py-1 text-xs font-bold text-amber-800">
                  Gia sư kèm 1-1
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-slateDark-900">
                4. Gia sư AI chỉ rõ lý do vì sao bạn làm sai
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slateDark-700">
                Khi làm sai, các app khác chỉ báo &quot;Đáp án đúng là B&quot; khiến bạn không hiểu vì sao.
                Tại LingoRoad, trợ lý AI đóng vai trò như một giáo viên tận tâm:
                <strong> Chỉ ra vì sao bạn chọn nhầm, dịch nghĩa dễ hiểu và cho bạn một câu tương tự để sửa ngay tại chỗ</strong>.
              </p>

              <div className="mt-5 rounded-xl bg-amberGold-50/60 border border-amberGold-200/60 p-4 space-y-2.5 text-xs text-slateDark-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Giải thích nhẹ nhàng, dễ hiểu, không hàn lâm</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Chấm phát âm và chỉ lỗi sai từng âm tiết khi bạn nói</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Sẵn sàng giải đáp mọi thắc mắc bất kể ngày đêm</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* View Mode 2: Dành cho Chuyên gia & Đồ án (Academic View) */}
        {viewMode === 'academic' && (
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">

            {/* Academic Card 1 */}
            <div className="rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Lý thuyết Khảo thí</span>
                  <h3 className="text-lg font-bold text-slateDark-900">Mô hình IRT 3PL &amp; Thuật toán EAP Bayes</h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slateDark-700 leading-relaxed">
                Mô hình 3-Parameter Logistic (3PL) tính toán xác suất trả lời đúng của học viên có năng lực θ dựa trên 3 tham số câu hỏi:
                Độ phân biệt (a), Độ khó (b), và Hệ số đoán mò (c).
              </p>

              <div className="mt-4 rounded-xl bg-slateDark-50 border border-slateDark-100 p-4 font-mono text-xs text-slateDark-800">
                <div className="font-semibold text-brand-700 mb-1">Công thức xác suất 3PL:</div>
                <div>P(θ) = c + (1 − c) / (1 + e^[−a(θ − b)])</div>
                <div className="mt-2 text-[11px] text-slateDark-500 font-sans">
                  Thuật toán Bayes dừng bài thi khi sai số chuẩn SE(θ) ≤ 0.35, giúp rút ngắn 70% số câu hỏi cần làm.
                </div>
              </div>
            </div>

            {/* Academic Card 2 */}
            <div className="rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Quy luật Trí nhớ</span>
                  <h3 className="text-lg font-bold text-slateDark-900">Thuật toán FSRS-4.5 Spaced Repetition</h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slateDark-700 leading-relaxed">
                Khác với thuật toán SM-2 cổ điển vốn giả định mọi từ vựng suy giảm ký ức như nhau, FSRS-4.5 mô hình hóa 2 thành phần độc lập:
                Độ ổn định trí nhớ S (Stability) và Độ khó D (Difficulty).
              </p>

              <div className="mt-4 rounded-xl bg-slateDark-50 border border-slateDark-100 p-4 font-mono text-xs text-slateDark-800">
                <div className="font-semibold text-emerald-700 mb-1">Đường cong suy giảm ký ức:</div>
                <div>R(t, S) = (1 + Factor × t / S)^−decay</div>
                <div className="mt-2 text-[11px] text-slateDark-500 font-sans">
                  Khoảng cách ôn tập được tính toán để đảm bảo học viên luôn duy trì 90% khả năng gợi nhớ tại thời điểm ôn.
                </div>
              </div>
            </div>

            {/* Academic Card 3 */}
            <div className="rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Cấu trúc Tri thức</span>
                  <h3 className="text-lg font-bold text-slateDark-900">Curriculum DAG &amp; Bayesian Knowledge Tracing</h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slateDark-700 leading-relaxed">
                Mỗi kỹ năng ngữ pháp, từ vựng và đàm thoại được liên kết theo đồ thị có hướng không chu trình (DAG).
                Cơ chế Mastery Gatekeeping bảo đảm học viên đạt độ thành thạo tối thiểu trước khi mở khóa bài học kế tiếp.
              </p>

              <div className="mt-4 rounded-xl bg-slateDark-50 border border-slateDark-100 p-4 font-mono text-xs text-slateDark-800">
                <div className="font-semibold text-blue-700 mb-1">Cập nhật xác suất hiểu bài (BKT):</div>
                <div>p(L_t) = p(L_t-1 | Obs) + (1 − p(L_t-1 | Obs)) × p(T)</div>
                <div className="mt-2 text-[11px] text-slateDark-500 font-sans">
                  Tự động phát hiện chính xác lỗ hổng gốc rễ và dẫn hướng quay lại ôn tập mục tiêu tiên quyết.
                </div>
              </div>
            </div>

            {/* Academic Card 4 */}
            <div className="rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amberGold-50 text-amber-600 border border-amberGold-500/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Trí tuệ Nhân tạo Tạo sinh</span>
                  <h3 className="text-lg font-bold text-slateDark-900">AI Learning Advisor (LLM + RAG)</h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slateDark-700 leading-relaxed">
                Sử dụng mô hình ngôn ngữ lớn kết hợp cơ chế Truy xuất Tăng cường (RAG) đối chiếu trực tiếp với giáo trình LingoRoad.
                Loại bỏ triệt để ảo giác (hallucination) và cung cấp phản hồi sư phạm chuẩn mực 24/7.
              </p>

              <div className="mt-4 rounded-xl bg-slateDark-50 border border-slateDark-100 p-4 font-mono text-xs text-slateDark-800">
                <div className="font-semibold text-amber-700 mb-1">Quy trình xử lý RAG:</div>
                <div>Query → Vector Retrieval → Context Injection → LLM Evaluation</div>
                <div className="mt-2 text-[11px] text-slateDark-500 font-sans">
                  Giải thích cặn kẽ vì sao các phương án khác sai và tạo câu hỏi tương tự để người học củng cố ngay.
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
