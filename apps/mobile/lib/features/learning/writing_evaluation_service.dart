import '../../core/api/api_client.dart';
import '../../core/config/app_config.dart';

enum LevelEvaluationStatus {
  exceedsExpectations,
  meetsExpectations,
  needsImprovement,
}

class LevelEvaluation {
  const LevelEvaluation({
    required this.status,
    required this.summaryVi,
    required this.encouragementVi,
  });

  final LevelEvaluationStatus status;
  final String summaryVi;
  final String encouragementVi;

  String get labelVi {
    switch (status) {
      case LevelEvaluationStatus.exceedsExpectations:
        return 'Vượt kỳ vọng';
      case LevelEvaluationStatus.meetsExpectations:
        return 'Đạt chuẩn kỳ vọng';
      case LevelEvaluationStatus.needsImprovement:
        return 'Cần cải thiện thêm';
    }
  }

  factory LevelEvaluation.fromJson(Map<String, dynamic> json) {
    final statusStr = (json['status']?.toString() ?? 'MEETS_EXPECTATIONS').toUpperCase();
    LevelEvaluationStatus parsedStatus;
    if (statusStr.contains('EXCEED')) {
      parsedStatus = LevelEvaluationStatus.exceedsExpectations;
    } else if (statusStr.contains('NEEDS') || statusStr.contains('IMPROVEMENT')) {
      parsedStatus = LevelEvaluationStatus.needsImprovement;
    } else {
      parsedStatus = LevelEvaluationStatus.meetsExpectations;
    }
    return LevelEvaluation(
      status: parsedStatus,
      summaryVi: json['summaryVi']?.toString() ?? json['summary_vi']?.toString() ?? '',
      encouragementVi:
          json['encouragementVi']?.toString() ?? json['encouragement_vi']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'status': status.name,
    'summaryVi': summaryVi,
    'encouragementVi': encouragementVi,
  };
}

enum GrammarStatus {
  mastered,
  attemptedWithErrors,
  notUsed,
}

class GrammarChecklistItem {
  const GrammarChecklistItem({
    required this.grammarPoint,
    required this.status,
    this.evidenceSentence = '',
    required this.feedbackVi,
  });

  final String grammarPoint;
  final GrammarStatus status;
  final String evidenceSentence;
  final String feedbackVi;

  String get statusLabelVi {
    switch (status) {
      case GrammarStatus.mastered:
        return 'Đã áp dụng tốt';
      case GrammarStatus.attemptedWithErrors:
        return 'Có cố gắng nhưng sai lỗi';
      case GrammarStatus.notUsed:
        return 'Chưa sử dụng';
    }
  }

  factory GrammarChecklistItem.fromJson(Map<String, dynamic> json) {
    final statusStr = (json['status']?.toString() ?? 'NOT_USED').toUpperCase();
    GrammarStatus parsedStatus;
    if (statusStr.contains('MASTER')) {
      parsedStatus = GrammarStatus.mastered;
    } else if (statusStr.contains('ATTEMPT') || statusStr.contains('ERROR')) {
      parsedStatus = GrammarStatus.attemptedWithErrors;
    } else {
      parsedStatus = GrammarStatus.notUsed;
    }
    return GrammarChecklistItem(
      grammarPoint:
          json['grammarPoint']?.toString() ?? json['grammar_point']?.toString() ?? '',
      status: parsedStatus,
      evidenceSentence:
          json['evidenceSentence']?.toString() ?? json['evidence_sentence']?.toString() ?? '',
      feedbackVi: json['feedbackVi']?.toString() ?? json['feedback_vi']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'grammarPoint': grammarPoint,
    'status': status.name,
    'evidenceSentence': evidenceSentence,
    'feedbackVi': feedbackVi,
  };
}

class WritingFeedbackItem {
  const WritingFeedbackItem({
    required this.originalSentence,
    required this.issueVi,
    required this.suggestion,
    this.explanationVi = '',
  });

  final String originalSentence;
  final String issueVi;
  final String suggestion;
  final String explanationVi;

  factory WritingFeedbackItem.fromJson(Map<String, dynamic> json) {
    return WritingFeedbackItem(
      originalSentence: json['originalSentence']?.toString() ??
          json['original_sentence']?.toString() ??
          json['sentence']?.toString() ??
          json['original']?.toString() ??
          '',
      issueVi: json['issueVi']?.toString() ??
          json['issue_vi']?.toString() ??
          json['issue']?.toString() ??
          json['error']?.toString() ??
          '',
      suggestion: json['suggestion']?.toString() ??
          json['correction']?.toString() ??
          json['suggested_sentence']?.toString() ??
          '',
      explanationVi: json['explanationVi']?.toString() ??
          json['explanation_vi']?.toString() ??
          json['explanation']?.toString() ??
          '',
    );
  }

  Map<String, dynamic> toJson() => {
    'originalSentence': originalSentence,
    'issueVi': issueVi,
    'suggestion': suggestion,
    'explanationVi': explanationVi,
  };
}

/// Tương thích ngược cho các màn hình cũ nếu cần
class WritingScores {
  const WritingScores({
    this.content = 4.0,
    this.communicativeAchievement = 4.0,
    this.organisation = 4.0,
    this.language = 4.0,
  });

  final double content;
  final double communicativeAchievement;
  final double organisation;
  final double language;

  factory WritingScores.fromJson(Map<String, dynamic> json) {
    return WritingScores(
      content: (json['content'] as num?)?.toDouble() ?? 4.0,
      communicativeAchievement:
          (json['communicativeAchievement'] as num?)?.toDouble() ?? 4.0,
      organisation: (json['organisation'] as num?)?.toDouble() ?? 4.0,
      language: (json['language'] as num?)?.toDouble() ?? 4.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'content': content,
    'communicativeAchievement': communicativeAchievement,
    'organisation': organisation,
    'language': language,
  };
}

class WritingEvaluationResult {
  const WritingEvaluationResult({
    required this.levelEvaluation,
    this.grammarChecklist = const [],
    this.improvementSteps = const [],
    this.feedback = const [],
    required this.overallCommentVi,
    this.scores = const WritingScores(),
    this.scaledScore10 = 7.5,
    this.estimatedCefr = 'B1',
  });

  final LevelEvaluation levelEvaluation;
  final List<GrammarChecklistItem> grammarChecklist;
  final List<String> improvementSteps;
  final List<WritingFeedbackItem> feedback;
  final String overallCommentVi;

  // Thuộc tính tương thích ngược cho hệ thống lưu trữ cũ
  final WritingScores scores;
  final double scaledScore10;
  final String estimatedCefr;

  double get overallScore {
    switch (levelEvaluation.status) {
      case LevelEvaluationStatus.exceedsExpectations:
        return 9.0;
      case LevelEvaluationStatus.meetsExpectations:
        return 7.5;
      case LevelEvaluationStatus.needsImprovement:
        return 5.0;
    }
  }

  factory WritingEvaluationResult.fromJson(Map<String, dynamic> json) {
    final rawLevel = (json['levelEvaluation'] ??
            json['level_evaluation'] ??
            json['levelAdaptiveAssessment'] ??
            json['level_adaptive_assessment']) as Map? ??
        {};
    final rawGrammar = (json['grammarChecklist'] ??
            json['grammar_checklist'] ??
            json['targetGrammarChecklist'] ??
            json['target_grammar_checklist']) as List<dynamic>? ??
        [];
    final rawSteps = (json['improvementSteps'] ??
            json['improvement_steps']) as List<dynamic>? ??
        [];
    final rawFeedback = (json['feedback'] ??
            json['sentenceFeedback'] ??
            json['sentence_feedback'] ??
            json['sentenceLevelFeedback'] ??
            json['sentence_level_feedback']) as List<dynamic>? ??
        [];

    LevelEvaluation levelEval;
    if (rawLevel.isNotEmpty) {
      levelEval = LevelEvaluation.fromJson(Map<String, dynamic>.from(rawLevel));
    } else {
      // Fallback nếu server trả định dạng cũ
      final score = (json['scaledScore10'] as num?)?.toDouble() ?? 7.0;
      final cefr = json['estimatedCefr']?.toString() ?? 'B1';
      final status = score >= 8.5
          ? LevelEvaluationStatus.exceedsExpectations
          : score >= 6.0
              ? LevelEvaluationStatus.meetsExpectations
              : LevelEvaluationStatus.needsImprovement;
      levelEval = LevelEvaluation(
        status: status,
        summaryVi: 'Bài viết đạt chuẩn mức độ $cefr.',
        encouragementVi: 'Tiếp tục rèn luyện để nâng cao kỹ năng diễn đạt tự nhiên!',
      );
    }

    return WritingEvaluationResult(
      levelEvaluation: levelEval,
      grammarChecklist: rawGrammar
          .whereType<Map>()
          .map((m) => GrammarChecklistItem.fromJson(Map<String, dynamic>.from(m)))
          .toList(),
      improvementSteps: rawSteps.map((e) => e.toString()).toList(),
      feedback: rawFeedback
          .whereType<Map>()
          .map((m) => WritingFeedbackItem.fromJson(Map<String, dynamic>.from(m)))
          .toList(),
      overallCommentVi: json['overallCommentVi']?.toString() ??
          json['overall_comment_vi']?.toString() ??
          '',
      scores: json['scores'] is Map<String, dynamic>
          ? WritingScores.fromJson(json['scores'] as Map<String, dynamic>)
          : const WritingScores(),
      scaledScore10: (json['scaledScore10'] as num?)?.toDouble() ?? 7.5,
      estimatedCefr: json['estimatedCefr']?.toString() ?? 'B1',
    );
  }

  Map<String, dynamic> toJson() => {
    'levelEvaluation': levelEvaluation.toJson(),
    'grammarChecklist': grammarChecklist.map((g) => g.toJson()).toList(),
    'improvementSteps': improvementSteps,
    'feedback': feedback.map((f) => f.toJson()).toList(),
    'overallCommentVi': overallCommentVi,
    'scores': scores.toJson(),
    'scaledScore10': scaledScore10,
    'estimatedCefr': estimatedCefr,
  };
}

class WritingPracticeItem {
  const WritingPracticeItem({
    required this.id,
    required this.skillCode,
    required this.cefrLevel,
    required this.prompt,
    this.rubricCriteria,
    this.sampleText,
  });

  final String id;
  final String skillCode;
  final String cefrLevel;
  final String prompt;
  final Map<String, dynamic>? rubricCriteria;
  final String? sampleText;

  int get minWords {
    final wc = rubricCriteria?['wordCount'];
    if (wc is Map) {
      final minVal = (wc['min'] as num?)?.toInt();
      if (minVal != null) return minVal;
    } else if (wc is String) {
      final parts = wc.split('-');
      if (parts.isNotEmpty) {
        final parsed = int.tryParse(parts[0].trim());
        if (parsed != null) return parsed;
      }
    }
    return (rubricCriteria?['minWords'] as num?)?.toInt() ?? 30;
  }

  int get maxWords {
    final wc = rubricCriteria?['wordCount'];
    if (wc is Map) {
      final maxVal = (wc['max'] as num?)?.toInt();
      if (maxVal != null) return maxVal;
    } else if (wc is String) {
      final parts = wc.split('-');
      if (parts.length > 1) {
        final parsed = int.tryParse(parts[1].trim());
        if (parsed != null) return parsed;
      }
    }
    return (rubricCriteria?['maxWords'] as num?)?.toInt() ?? 100;
  }

  List<String> get expectedPoints {
    final pts = rubricCriteria?['expectedPoints'];
    if (pts is List) {
      return pts.map((e) => e.toString()).toList();
    }
    return const [];
  }

  List<String> get targetGrammars {
    final tg = rubricCriteria?['targetGrammars'] ?? rubricCriteria?['target_grammars'];
    if (tg is List) {
      return tg.map((e) => e.toString()).toList();
    }
    return const [];
  }

  String get skillTitle {
    if (skillCode.contains('letter') || skillCode.contains('email')) {
      return 'Thư tín / Email';
    }
    if (skillCode.contains('essay')) {
      return 'Bài luận (Opinion Essay)';
    }
    return 'Bài tập Viết';
  }

  String get taskType {
    final code = skillCode.toLowerCase();
    if (code.contains('letter') ||
        code.contains('email') ||
        id.toLowerCase().contains('a2')) {
      return 'TASK_1';
    }
    return 'TASK_2';
  }

  static const defaultItems = [
    WritingPracticeItem(
      id: 'cefr-write-a2-001',
      skillCode: 'writing.transactional_letter',
      cefrLevel: 'A2',
      prompt:
          'You recently stayed at a hotel in Hanoi and left your jacket in the room. Write an email to the receptionist: say who you are, describe your jacket, and ask how to get it back.',
      rubricCriteria: {
        'minWords': 35,
        'maxWords': 70,
        'expectedPoints': ['Identity', 'Jacket description', 'Retrieval method'],
        'targetGrammars': [
          'Thì quá khứ đơn (Past Simple: stayed, forgot)',
          'Câu hỏi đề nghị lịch sự (Can you / Could you)',
          'Liên từ nối cơ bản (and, but, because)',
        ],
      },
      sampleText:
          'Dear Hotel Receptionist, My name is Nam and I stayed in room 302 last weekend. Unfortunately, I forgot my dark blue jacket in the closet. Could you please check with housekeeping and inform me how I can arrange to get it back? Thank you very much for your assistance.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-b2-001',
      skillCode: 'writing.opinion_essay',
      cefrLevel: 'B2',
      prompt:
          'Some people argue that working from home brings more benefits, while others believe working in an office fosters better collaboration. Discuss both views and give your opinion.',
      rubricCriteria: {
        'minWords': 140,
        'maxWords': 220,
        'expectedPoints': [
          'Benefits of WFH',
          'Benefits of Office',
          'Personal stance',
        ],
        'targetGrammars': [
          'Mệnh đề nhượng bộ & tương phản (While, Whereas, On the other hand)',
          'Thể bị động khách quan (It is argued that... / can be observed)',
          'Mệnh đề quan hệ xác định và không xác định (which, who)',
        ],
      },
      sampleText:
          'Nowadays, the debate between working remotely and working in an office has gained widespread attention. On the one hand, remote work offers flexibility and saves commuting time. On the other hand, office environments promote direct communication and team bonding. In my opinion, a hybrid model combining both approaches provides the optimal balance for modern workers.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-a2-002',
      skillCode: 'writing.transactional_letter',
      cefrLevel: 'A2',
      prompt:
          'You cannot go to an English class tomorrow evening. Write an email (50-70 words) to your English teacher, Mr. David: explain why you cannot attend, ask what homework to prepare, and state when you will hand in the assignment.',
      rubricCriteria: {
        'minWords': 40,
        'maxWords': 75,
        'expectedPoints': [
          'Reason for absence',
          'Ask for homework',
          'Submission promise',
        ],
        'targetGrammars': [
          'Thì tương lai đơn & khuyết thiếu (will, cannot)',
          'Câu hỏi lịch sự trang trọng (Could you please...?)',
          'Liên từ chỉ nguyên nhân kết quả (because, so)',
        ],
      },
      sampleText:
          'Dear Mr. David, I am writing to let you know that I cannot attend our English class tomorrow evening because I have a high fever. Could you please let me know what homework I should prepare for the next session? I promise to submit my assignment this Friday. Thank you very much, Minh.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-b1-001',
      skillCode: 'writing.transactional_letter',
      cefrLevel: 'B1',
      prompt:
          'An English-speaking friend named Alex is planning to visit your hometown next month and has asked for your advice. Write an email (80-120 words) to Alex: suggest the best time to visit, recommend at least two interesting places to see, and advise on what local food to try.',
      rubricCriteria: {
        'minWords': 70,
        'maxWords': 130,
        'expectedPoints': [
          'Best time to visit',
          'Two local attractions',
          'Recommended food',
        ],
        'targetGrammars': [
          'Mẫu câu gợi ý & khuyên nhủ (You should, Why don\'t you, I recommend)',
          'Câu điều kiện loại 1 (If you visit..., you will see...)',
          'Trạng từ chỉ thứ tự và bổ sung (First, Besides, In addition)',
        ],
      },
      sampleText:
          'Hi Alex, I am so thrilled to hear that you are visiting Hanoi next month! Autumn is definitely the best time to come because the weather is pleasantly cool and sunny. When you are here, you should definitely visit the Old Quarter and walk around Hoan Kiem Lake. Make sure you do not miss trying Pho and Bun Cha at traditional street stalls. Let me know your travel dates so we can meet up! Warm regards, Nam.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-b1-002',
      skillCode: 'writing.transactional_letter',
      cefrLevel: 'B1',
      prompt:
          'You recently had a birthday dinner with your friends at a local restaurant, but you were very dissatisfied with the service and the food. Write a formal email (100-140 words) to the restaurant manager: state when and why you were there, explain what went wrong, and state what action you expect.',
      rubricCriteria: {
        'minWords': 90,
        'maxWords': 150,
        'expectedPoints': [
          'Event and date',
          'Food and service issues',
          'Requested action',
        ],
        'targetGrammars': [
          'Thì quá khứ tiếp diễn kết hợp quá khứ đơn (While we were having dinner, ... happened)',
          'Cấu trúc yêu cầu lịch sự trang trọng (I would appreciate it if you could...)',
          'Thì hiện tại hoàn thành diễn tả trải nghiệm (We have never experienced...)',
        ],
      },
      sampleText:
          'Dear Restaurant Manager, I am writing to express my disappointment regarding our dinner at your restaurant on November 5th for my birthday celebration. Although we booked a table in advance, we had to wait for forty minutes to be seated. Furthermore, the main courses were served completely cold and the waitstaff appeared very inattentive. As this was a special occasion, our evening was completely spoiled. I request an official explanation and an appropriate refund for our meal. I look forward to your prompt response. Yours sincerely, Minh Nguyen.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-b2-002',
      skillCode: 'writing.opinion_essay',
      cefrLevel: 'B2',
      prompt:
          'Some people believe that university education should be completely free for all students, while others think that students should pay tuition fees for higher education. Discuss both views and give your own opinion (180-220 words).',
      rubricCriteria: {
        'minWords': 160,
        'maxWords': 240,
        'expectedPoints': [
          'Arguments for free tuition',
          'Arguments for paying fees',
          'Balanced personal view',
        ],
        'targetGrammars': [
          'Cấu trúc nhượng bộ học thuật (Although, Despite the fact that)',
          'Thể bị động trong văn phong học thuật (Higher education should be subsidized)',
          'Câu điều kiện kết hợp (Mixed conditionals: If tuition were free...)',
        ],
      },
      sampleText:
          'The issue of whether higher education should be tuition-free has sparked intense public debate. Proponents of free tertiary education assert that removing financial barriers guarantees equal opportunities for talented individuals regardless of their socio-economic background, thereby cultivating a highly skilled workforce. Conversely, opponents argue that funding universal higher education places an enormous burden on national taxpayers and might degrade teaching quality. In my opinion, while completely free education is financially challenging, governments should implement income-contingent loans and merit-based scholarships to ensure affordability without sacrificing educational excellence.',
    ),
    WritingPracticeItem(
      id: 'cefr-write-b2-003',
      skillCode: 'writing.opinion_essay',
      cefrLevel: 'B2',
      prompt:
          'The widespread use of smartphones and social media has negatively affected personal relationships and face-to-face communication. To what extent do you agree or disagree? Write an essay (180-220 words) supporting your position with relevant reasons and examples.',
      rubricCriteria: {
        'minWords': 160,
        'maxWords': 240,
        'expectedPoints': [
          'Clear thesis/stance',
          'Impact on direct communication',
          'Constructive conclusion',
        ],
        'targetGrammars': [
          'Thì hiện tại hoàn thành & tiếp diễn (have transformed, have been decreasing)',
          'Mệnh đề quan hệ xác định và không xác định (which, who)',
          'Trạng từ liên kết luận điểm (First and foremost, Furthermore, Consequently)',
        ],
      },
      sampleText:
          'In recent years, the ubiquity of smartphones and social networking platforms has drastically reshaped the way humans interact. I firmly agree with the notion that these digital devices have largely deteriorated authentic interpersonal relationships and face-to-face communication. In daily gatherings, it has become commonplace to see individuals fixated on mobile screens rather than engaging in meaningful verbal exchanges with their companions. Moreover, online interactions tend to be superficial, lacking emotional depth and non-verbal cues essential for genuine empathy. While modern technology undeniably offers unprecedented connectivity across long distances, excessive dependency on virtual interaction inevitably weakens real-life bonds.',
    ),
  ];

  factory WritingPracticeItem.fromJson(Map<String, dynamic> json) {
    final rubric = json['rubricCriteria'] is Map<String, dynamic>
        ? json['rubricCriteria'] as Map<String, dynamic>
        : null;
    final sampleFromRubric = rubric?['sampleAnswer']?.toString() ??
        rubric?['sampleText']?.toString();
    final defaultMatch =
        defaultItems.where((d) => d.id == json['id']).firstOrNull;
    return WritingPracticeItem(
      id: json['id']?.toString() ?? '',
      skillCode: json['skillCode']?.toString() ?? '',
      cefrLevel: json['cefrLevel']?.toString() ?? 'B1',
      prompt: json['prompt']?.toString() ?? '',
      rubricCriteria: rubric,
      sampleText: sampleFromRubric ?? defaultMatch?.sampleText,
    );
  }
}

class WritingEvaluationService {
  WritingEvaluationService({ApiClient? client})
      : _client = client ?? _defaultClient;

  static final ApiClient _defaultClient = ApiClient(
    config: AppConfig(),
    store: SecureTokenStore(),
  );

  final ApiClient _client;

  /// Lấy danh sách đề bài viết thực tế từ Ngân hàng đề trong Database
  Future<List<WritingPracticeItem>> fetchWritingItems({
    String? cefrLevel,
  }) async {
    final query = cefrLevel != null ? '?cefrLevel=$cefrLevel' : '';
    final response = await _client.request(
      'GET',
      '/api/v1/assessment/writing/items$query',
      auth: true,
    );
    final rawList = response['items'] as List<dynamic>? ?? [];
    return rawList
        .whereType<Map<String, dynamic>>()
        .map(WritingPracticeItem.fromJson)
        .toList();
  }

  /// Gửi bài viết sang backend NestJS để AI đánh giá sư phạm theo trình độ và checklist ngữ pháp
  Future<WritingEvaluationResult> evaluateWriting({
    required String taskType,
    required String taskPrompt,
    required String essay,
    String? targetCefr,
    String? itemId,
    List<String>? targetGrammars,
    String? learnerLevel,
  }) async {
    final data = <String, dynamic>{
      'taskType': taskType,
      'taskPrompt': taskPrompt,
      'essay': essay,
      'targetCefr': ?targetCefr,
      'itemId': ?itemId,
      'targetGrammars': ?targetGrammars,
      'learnerLevel': ?learnerLevel,
    };

    final response = await _client.request(
      'POST',
      '/api/v1/assessment/writing/evaluate',
      data: data,
      auth: true,
      receiveTimeout: const Duration(seconds: 90),
    );

    return WritingEvaluationResult.fromJson(response);
  }
}
