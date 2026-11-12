# Request for Comments (RFC) - Interactive AI Scaffolding Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc tích hợp giữa Backend NestJS và Dịch vụ AI/ML (`apps/ml`) để phục vụ các yêu cầu gợi ý học tập tức thì (Scaffolding), hướng dẫn viết lại và chuyển giao từ vựng sang hệ thống Spaced Repetition (FSRS).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Scaffolding (`docs/spec/features/26-skill-practice-engine/02-interactive-ai-scaffolding/prd.md`).
- Tích hợp với `apps/ml/lingoroad_ml/llm/` (đã có `rag.py`, `awe.py`, `advisor.py`).
- Kết nối tới `docs/spec/features/14-fsrs-review-engine` và `15-vocabulary-saved-words`.

---

# 2. Problem (Bài toán Kỹ thuật)

- Các mô-đun LLM thông thường chỉ nhận toàn bộ bài viết đã hoàn thiện để chấm điểm (Batch Evaluation).
- Cần một pipeline xử lý streaming hoặc phản hồi nhanh cho các đoạn văn nháp ngắn (Drafts) hoặc yêu cầu hỗ trợ ý tưởng (Prompt-based ideation) với độ trễ thấp (< 2 giây).
- Đảm bảo token và chi phí API hợp lý bằng cách kiểm soát số lần yêu cầu trợ giúp (Scaffolding Quota) cho mỗi lượt luyện tập.

---

# 3. Architecture & Data Flow (Phase 1 Implemented & Phase 2 Planned)

### 3.1. Phase 1 Implemented: Speaking Topic Preparation Scaffolding & CEFR Writing Feedback
- **Speaking Conversation Preparation (`apps/backend/src/modules/speaking/conversation-preparation.ts`)**:
  - Hàm `conversationPreparation(code)` trả về gói hướng dẫn có cấu trúc ổn định (`version: 1`, `goal`, 12 `vocabulary` items, 8 `phrases`, 3 `helpPhrases`, 3 `tips`) kèm danh sách `linkedPrompts` trên endpoint `GET /speaking/conversations/topics/:id`.
  - Hỗ trợ dịch từng lượt lời thoại của AI sang tiếng Việt theo yêu cầu qua `POST /speaking/conversations/:id/turns/:itemId/translate` (`VoiceConversationsService.translate`).
- **CEFR Writing Sentence-Level Rewrite & Grammar Checklist (`EvaluateCefrWritingUseCase`)**:
  - Endpoint `POST /api/v1/assessment/writing/evaluate` kết nối tới FastAPI ML Service để trả về `grammarChecklist` và danh sách `feedback` sửa lỗi từng câu (`originalSentence`, `issueVi`, `suggestion`, `explanationVi`).

### 3.2. Phase 2 Planned: On-Demand LLM Brainstorming (`/api/v1/practice/ai/brainstorm`)
```
Mobile/Web Client
      │
      ├─► 1. POST /api/v1/practice/ai/brainstorm ──► NestJS PracticeController
      │                                                       │
      │                                                       ▼ (gRPC / HTTP REST)
      │                                              FastAPI ML Service (apps/ml)
      │                                                       │
      │                                                       ▼ (Prompt Scaffolding)
      │                                              LLM (Gemini 3.8 Flash)
      │                                                       │
      │   ◄─ 2. JSON: { ideas, linkingWords, vocab } ◄────────┘
      │
      └─► 3. POST /api/v1/vocabulary/saved-words ──► VocabularyModule (FSRS Engine)
```

---

# 4. ML Service Prompt Design (`apps/ml/lingoroad_ml/llm/scaffolding.py`)

### 4.1. Brainstorming Prompt Template
```python
SYSTEM_SCAFFOLDING = """You are an encouraging CEFR language coach. 
Given a writing or speaking prompt and a target CEFR level (A1 to C2), provide structured guidance in VIETNAMESE.
Return strict JSON:
{
  "ideas": ["<point 1 in Vietnamese>", "<point 2 in Vietnamese>"],
  "linking_words": ["<word/phrase with Vietnamese usage note>"],
  "recommended_vocabulary": [
    {"word": "<en>", "ipa": "<ipa>", "meaning_vi": "<vi>", "example": "<en sentence>"}
  ]
}
Do not write the whole essay. Only provide guidance."""
```

### 4.2. Sentence Rewrite & Error Analysis Prompt Template
```python
SYSTEM_REWRITE = """You are an English writing tutor. Analyze this draft paragraph for a {cefr_level} learner.
Provide actionable sentence-level feedback in VIETNAMESE.
Return strict JSON:
{
  "issues": [
    {
      "original_sentence": "<text>",
      "problem_vi": "<explanation of grammar or lexical error>",
      "better_sentence": "<natural polished sentence>",
      "cefr_boost_words": [{"word": "<word>", "meaning": "<meaning>"}]
    }
  ],
  "encouragement_vi": "<short motivational feedback>"
}"""
```

---

# 5. Rate Limiting & Quota Management

- Mỗi phiên luyện tập (`PracticeSession`), học viên được sử dụng tối đa:
  - 3 lần "Brainstorming Hints".
  - 5 lần "Check Paragraph & Rewrite".
- Điều này vừa ngăn ngừa tình trạng lạm dụng AI làm hộ bài, vừa bảo vệ giới hạn tài nguyên hệ thống.

