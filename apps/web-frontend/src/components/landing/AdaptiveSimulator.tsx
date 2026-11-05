'use client';

import React, { useState } from 'react';
import { Sparkles, Brain, CheckCircle, XCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { SIMULATION_QUESTIONS } from '@/data/landing-content';

export const AdaptiveSimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cat' | 'fsrs'>('cat');

  // CAT simulation state
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [thetaScore, setThetaScore] = useState<number>(0.0);
  const [accuracyProgress, setAccuracyProgress] = useState<number>(55);
  const [historyAnswers, setHistoryAnswers] = useState<boolean[]>([]);

  // FSRS simulation state
  const [fsrsRating, setFsrsRating] = useState<'again' | 'hard' | 'good' | 'easy' | null>(null);
  const [stabilityDays, setStabilityDays] = useState<number>(3.2);
  const [difficultyScore, setDifficultyScore] = useState<number>(4.8);

  const currentQuestion = SIMULATION_QUESTIONS[questionIndex];

  const handleSelectOption = (index: number): void => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
  };

  const handleCatSubmit = (): void => {
    if (selectedOption === null || isAnswerSubmitted) return;
    setIsAnswerSubmitted(true);
    const isCorrect = selectedOption === currentQuestion.correctAnswerIndex;
    setHistoryAnswers((prev: boolean[]) => [...prev, isCorrect]);

    if (isCorrect) {
      setThetaScore((prev: number) => Number((prev + 0.65).toFixed(2)));
    } else {
      setThetaScore((prev: number) => Number((prev - 0.55).toFixed(2)));
    }
    setAccuracyProgress((prev: number) => Math.min(95, prev + 20));
  };

  const handleNextCatQuestion = (): void => {
    const isLastCorrect = historyAnswers[historyAnswers.length - 1];
    setSelectedOption(null);
    setIsAnswerSubmitted(false);

    if (questionIndex === 0) {
      // Branch based on correctness: correct -> hard (q2-hard index 1), wrong -> easy (q2-easy index 2)
      setQuestionIndex(isLastCorrect ? 1 : 2);
    } else {
      // Loop or reset
      setQuestionIndex(0);
      setHistoryAnswers([]);
      setThetaScore(0.0);
      setAccuracyProgress(55);
    }
  };

  const handleFsrsReview = (rating: 'again' | 'hard' | 'good' | 'easy'): void => {
    setFsrsRating(rating);
    switch (rating) {
      case 'again':
        setStabilityDays(0.2); // ~5 hours
        setDifficultyScore((prev: number) => Math.min(10, prev + 1.2));
        break;
      case 'hard':
        setStabilityDays(1.5);
        setDifficultyScore((prev: number) => Math.min(10, prev + 0.5));
        break;
      case 'good':
        setStabilityDays(4.8);
        setDifficultyScore((prev: number) => Math.max(1, prev - 0.2));
        break;
      case 'easy':
        setStabilityDays(11.4);
        setDifficultyScore((prev: number) => Math.max(1, prev - 0.8));
        break;
    }
  };

  const getCefrBadge = (theta: number): string => {
    if (theta >= 1.2) return 'C1 - Cao cấp';
    if (theta >= 0.5) return 'B2 - Trung cấp nâng cao';
    if (theta >= 0.0) return 'B1 - Trung cấp';
    if (theta >= -0.8) return 'A2 - Sơ cấp';
    return 'A1 - Người mới bắt đầu';
  };

  const getQuestionDifficultyText = (level: string): string => {
    switch (level) {
      case 'B2':
        return 'Thử thách nâng cao';
      case 'B1':
        return 'Mức độ vừa sức';
      case 'A2':
        return 'Mức độ căn bản';
      default:
        return 'Tiêu chuẩn';
    }
  };

  return (
    <section id="simulator" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 border border-brand-200">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            Trải nghiệm tính năng trực tiếp
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
            Thử nghiệm tính năng thông minh của LingoRoad
          </h2>
          <p className="mt-3 text-base text-slateDark-700">
            Khám phá cách hệ thống tự động điều chỉnh độ khó bài kiểm tra và tính toán thời gian nhắc ôn từ vựng cho bạn.
          </p>

          {/* Toggle Tab */}
          <div className="mt-8 inline-flex rounded-xl bg-slateDark-100 p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('cat')}
              className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                activeTab === 'cat'
                  ? 'bg-white text-slateDark-900 shadow-sm'
                  : 'text-slateDark-600 hover:text-slateDark-900'
              }`}
            >
              1. Thử làm bài kiểm tra thích ứng
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fsrs')}
              className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                activeTab === 'fsrs'
                  ? 'bg-white text-slateDark-900 shadow-sm'
                  : 'text-slateDark-600 hover:text-slateDark-900'
              }`}
            >
              2. Thử tính năng nhắc ôn từ vựng
            </button>
          </div>
        </div>

        {/* Tab 1: CAT Simulator */}
        {activeTab === 'cat' && (
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
            
            {/* Interactive Question Card */}
            <div className="rounded-2xl border border-slateDark-200 bg-slateDark-25/50 p-6 sm:p-8 lg:col-span-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slateDark-200 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand-500 px-2.5 py-0.5 text-xs font-bold !text-white">
                    Độ khó: {currentQuestion.cefrLevel}
                  </span>
                  <span className="text-xs font-semibold text-slateDark-600">
                    {getQuestionDifficultyText(currentQuestion.cefrLevel)}
                  </span>
                </div>
                <div className="text-xs font-medium text-slateDark-500">
                  Câu hỏi {historyAnswers.length + 1}
                </div>
              </div>

              {/* Question Text */}
              <div className="mt-6 text-lg font-semibold text-slateDark-900 sm:text-xl">
                {currentQuestion.question}
              </div>

              {/* Options */}
              <div className="mt-6 space-y-3">
                {currentQuestion.options.map((option: string, idx: number) => {
                  let optionClass =
                    'border-slateDark-200 bg-white hover:border-brand-400 hover:bg-brand-25/20 text-slateDark-800';
                  
                  if (selectedOption === idx) {
                    optionClass = 'border-brand-500 bg-brand-50 text-brand-900 font-semibold ring-2 ring-brand-300';
                  }

                  if (isAnswerSubmitted) {
                    if (idx === currentQuestion.correctAnswerIndex) {
                      optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-300';
                    } else if (selectedOption === idx) {
                      optionClass = 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswerSubmitted}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full text-left rounded-xl border p-4 text-sm sm:text-base transition-all flex items-center justify-between ${optionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slateDark-200 bg-slateDark-50 text-xs font-bold">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </div>
                      {isAnswerSubmitted && idx === currentQuestion.correctAnswerIndex && (
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      )}
                      {isAnswerSubmitted && selectedOption === idx && idx !== currentQuestion.correctAnswerIndex && (
                        <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Action */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slateDark-200 pt-5">
                {!isAnswerSubmitted ? (
                  <button
                    type="button"
                    disabled={selectedOption === null}
                    onClick={handleCatSubmit}
                    className={`btn-primary w-full sm:w-auto rounded-xl px-7 py-3 text-sm font-semibold transition-all ${
                      selectedOption === null ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    Xác nhận câu trả lời
                  </button>
                ) : (
                  <div className="flex w-full flex-col gap-4">
                    <div className="rounded-xl bg-brand-50/80 border border-brand-200 p-4 text-xs sm:text-sm text-slateDark-800">
                      <div className="flex items-center gap-1.5 font-bold text-brand-800 mb-1">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        <span>Gia sư AI giải thích:</span>
                      </div>
                      {currentQuestion.explanation}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleNextCatQuestion}
                        className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold"
                      >
                        <span className="!text-white">
                          {questionIndex === 0 ? 'Chuyển sang câu tiếp theo' : 'Thử lại từ đầu'}
                        </span>
                        <ArrowRight className="h-4 w-4 !text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time Ability Estimation Board */}
            <div className="flex flex-col justify-between rounded-2xl border border-slateDark-200 bg-white p-6 sm:p-7 lg:col-span-4 shadow-sm">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slateDark-900">
                  <Brain className="h-5 w-5 text-brand-600" />
                  Đo lường năng lực trực tiếp
                </h3>
                <p className="mt-1 text-xs text-slateDark-600">
                  Hệ thống tự động chấm và dự đoán trình độ của bạn sau từng câu
                </p>

                {/* Score Big Display */}
                <div className="mt-6 rounded-2xl bg-brand-25/50 border border-brand-200 p-5 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    Trình độ dự đoán
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slateDark-900 sm:text-3xl">
                    {getCefrBadge(thetaScore)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slateDark-600">
                    Độ chính xác tăng dần sau mỗi câu bạn trả lời
                  </div>
                </div>

                {/* Real-time Metrics List */}
                <div className="mt-6 space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold text-slateDark-700">
                      <span>Độ tin cậy của bài thi</span>
                      <span className="font-mono text-brand-700">{accuracyProgress}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slateDark-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${accuracyProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slateDark-500">Kết luận kết quả khi độ tin cậy đạt &gt; 90% (sau 15 câu)</span>
                  </div>

                  <div className="rounded-xl border border-slateDark-100 bg-slateDark-50 p-3.5 space-y-2">
                    <div className="font-bold text-slateDark-800">Cách đề thi thông minh hoạt động:</div>
                    <p className="text-[11px] leading-relaxed text-slateDark-600">
                      • Khi trả lời <strong>Đúng</strong>: Hệ thống tăng độ khó ở câu tiếp theo để khám phá giới hạn cao hơn của bạn.
                    </p>
                    <p className="text-[11px] leading-relaxed text-slateDark-600">
                      • Khi trả lời <strong>Sai</strong>: Hệ thống hạ độ khó để kiểm tra lại nền tảng kiến thức căn bản của bạn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slateDark-100 text-[11px] text-slateDark-500 flex items-center justify-between">
                <span>Khung chuẩn quốc tế:</span>
                <span className="font-semibold text-slateDark-700">CEFR A1 → C2</span>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: FSRS Simulator */}
        {activeTab === 'fsrs' && (
          <div className="mt-12 mx-auto max-w-4xl rounded-2xl border border-slateDark-200 bg-slateDark-25/50 p-6 sm:p-10 shadow-sm">
            <div className="mx-auto max-w-lg rounded-2xl border border-slateDark-200 bg-white p-6 sm:p-8 text-center shadow-md">
              <span className="rounded-md bg-amberGold-50 border border-amberGold-500/30 px-3 py-1 text-xs font-bold text-amber-800">
                Thẻ từ vựng nâng cao (C1)
              </span>
              <h3 className="mt-4 text-3xl font-extrabold text-slateDark-900">
                Serendipity
              </h3>
              <div className="mt-1 font-mono text-sm text-slateDark-500">
                /ˌser.ənˈdɪp.ə.ti/ (danh từ)
              </div>
              <p className="mt-4 text-sm text-slateDark-700 leading-relaxed italic">
                &quot;The occurrence and development of events by chance in a happy or beneficial way.&quot;
              </p>
              <div className="mt-3 text-xs text-brand-700 font-medium">
                (Sự may mắn bất ngờ khi tình cờ tìm thấy điều tốt đẹp)
              </div>
            </div>

            {/* FSRS Rating Buttons */}
            <div className="mt-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-slateDark-600 mb-3">
                Bạn nhớ từ vựng này ở mức độ nào?
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleFsrsReview('again')}
                  className={`rounded-xl border p-3.5 text-center transition-all ${
                    fsrsRating === 'again'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold ring-2 ring-rose-300'
                      : 'border-slateDark-200 bg-white hover:border-rose-300 text-slateDark-800'
                  }`}
                >
                  <div className="text-sm font-bold">1. Quên mất rồi</div>
                  <div className="text-xs text-slateDark-500 mt-1">Ôn lại: ~10 phút nữa</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFsrsReview('hard')}
                  className={`rounded-xl border p-3.5 text-center transition-all ${
                    fsrsRating === 'hard'
                      ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-300'
                      : 'border-slateDark-200 bg-white hover:border-amber-300 text-slateDark-800'
                  }`}
                >
                  <div className="text-sm font-bold">2. Hơi khó nhớ</div>
                  <div className="text-xs text-slateDark-500 mt-1">Ôn lại: sau 1.5 ngày</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFsrsReview('good')}
                  className={`rounded-xl border p-3.5 text-center transition-all ${
                    fsrsRating === 'good'
                      ? 'border-brand-500 bg-brand-50 text-brand-800 font-bold ring-2 ring-brand-300'
                      : 'border-slateDark-200 bg-white hover:border-brand-300 text-slateDark-800'
                  }`}
                >
                  <div className="text-sm font-bold">3. Nhớ tốt</div>
                  <div className="text-xs text-slateDark-500 mt-1">Ôn lại: sau 4.8 ngày</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFsrsReview('easy')}
                  className={`rounded-xl border p-3.5 text-center transition-all ${
                    fsrsRating === 'easy'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-300'
                      : 'border-slateDark-200 bg-white hover:border-emerald-300 text-slateDark-800'
                  }`}
                >
                  <div className="text-sm font-bold">4. Rất dễ nhớ</div>
                  <div className="text-xs text-slateDark-500 mt-1">Ôn lại: sau 11.4 ngày</div>
                </button>
              </div>
            </div>

            {/* Computed Parameters Result */}
            <div className="mt-8 rounded-xl border border-slateDark-200 bg-white p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-slateDark-50 p-3">
                  <div className="text-xs text-slateDark-500">Thời gian duy trì trí nhớ</div>
                  <div className="text-xl font-bold text-brand-600 mt-1">{stabilityDays} ngày</div>
                </div>
                <div className="rounded-lg bg-slateDark-50 p-3">
                  <div className="text-xs text-slateDark-500">Mức độ khó của từ</div>
                  <div className="text-xl font-bold text-slateDark-900 mt-1">{difficultyScore.toFixed(1)} / 10</div>
                </div>
                <div className="rounded-lg bg-slateDark-50 p-3">
                  <div className="text-xs text-slateDark-500">Khả năng nhớ khi được nhắc lại</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">90% tối ưu</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-slateDark-600 text-center">
                LingoRoad tự động canh chuẩn xác ngày bạn bắt đầu quên để nhắc nhở, giúp bạn không cần ngày nào cũng phải học lại những từ đã thuộc lòng.
              </p>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
