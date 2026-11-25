import '../../core/api/api_client.dart';

const List<String> kCefrLevels = <String>['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

List<Map<String, Object?>> _asMapList(Object? raw) {
  if (raw is! List) return const <Map<String, Object?>>[];
  return raw
      .whereType<Map>()
      .map((Map item) => Map<String, Object?>.from(item))
      .toList();
}

List<String> _asStringList(Object? raw) {
  if (raw is! List) return const <String>[];
  return raw.map((Object? e) => (e ?? '').toString()).where((String s) => s.isNotEmpty).toList();
}

class GrammarLevelSummary {
  const GrammarLevelSummary({
    required this.cefrLevel,
    required this.topicCount,
    required this.lessonCount,
    required this.completedCount,
  });

  final String cefrLevel;
  final int topicCount;
  final int lessonCount;
  final int? completedCount;

  factory GrammarLevelSummary.fromJson(Map<String, Object?> json) {
    return GrammarLevelSummary(
      cefrLevel: (json['cefrLevel'] ?? 'A1').toString(),
      topicCount: (json['topicCount'] as num?)?.toInt() ?? 0,
      lessonCount: (json['lessonCount'] as num?)?.toInt() ?? 0,
      completedCount: (json['completedCount'] as num?)?.toInt(),
    );
  }
}

class GrammarTreeNode {
  const GrammarTreeNode({
    required this.id,
    required this.code,
    required this.parentCode,
    required this.cefrLevel,
    required this.isLeaf,
    required this.titleEn,
    required this.titleVi,
    required this.summaryVi,
    required this.orderIndex,
    required this.prerequisiteCodes,
    required this.lessonCount,
    required this.learnerStatus,
    required this.children,
  });

  final String id;
  final String code;
  final String? parentCode;
  final String cefrLevel;
  final bool isLeaf;
  final String titleEn;
  final String titleVi;
  final String summaryVi;
  final int orderIndex;
  final List<String> prerequisiteCodes;
  final int lessonCount;
  final String? learnerStatus;
  final List<GrammarTreeNode> children;

  factory GrammarTreeNode.fromJson(Map<String, Object?> json) {
    return GrammarTreeNode(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      parentCode: json['parentCode']?.toString(),
      cefrLevel: (json['cefrLevel'] ?? 'A1').toString(),
      isLeaf: json['isLeaf'] == true,
      titleEn: (json['titleEn'] ?? '').toString(),
      titleVi: (json['titleVi'] ?? '').toString(),
      summaryVi: (json['summaryVi'] ?? '').toString(),
      orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 0,
      prerequisiteCodes: _asStringList(json['prerequisiteCodes']),
      lessonCount: (json['lessonCount'] as num?)?.toInt() ?? 0,
      learnerStatus: json['learnerStatus']?.toString(),
      children: _asMapList(json['children'])
          .map(GrammarTreeNode.fromJson)
          .toList(),
    );
  }
}

class GrammarFormula {
  const GrammarFormula({
    required this.form,
    required this.labelVi,
    required this.structure,
    this.noteVi,
  });

  final String form;
  final String labelVi;
  final String structure;
  final String? noteVi;

  factory GrammarFormula.fromJson(Map<String, Object?> json) {
    final String? note = json['noteVi']?.toString();
    return GrammarFormula(
      form: (json['form'] ?? 'AFFIRMATIVE').toString(),
      labelVi: (json['labelVi'] ?? '').toString(),
      structure: (json['structure'] ?? '').toString(),
      noteVi: note != null && note.trim().isNotEmpty ? note : null,
    );
  }
}

class GrammarUsageNote {
  const GrammarUsageNote({
    required this.useCaseVi,
    required this.signalWords,
    this.commonMistakeVi,
  });

  final String useCaseVi;
  final List<String> signalWords;
  final String? commonMistakeVi;

  factory GrammarUsageNote.fromJson(Map<String, Object?> json) {
    final String? mistake = json['commonMistakeVi']?.toString();
    return GrammarUsageNote(
      useCaseVi: (json['useCaseVi'] ?? '').toString(),
      signalWords: _asStringList(json['signalWords']),
      commonMistakeVi: mistake != null && mistake.trim().isNotEmpty ? mistake : null,
    );
  }
}

class GrammarExample {
  const GrammarExample({
    required this.sentenceEn,
    required this.translationVi,
    this.highlight,
  });

  final String sentenceEn;
  final String translationVi;
  final String? highlight;

  factory GrammarExample.fromJson(Map<String, Object?> json) {
    final String? hl = json['highlight']?.toString();
    return GrammarExample(
      sentenceEn: (json['sentenceEn'] ?? '').toString(),
      translationVi: (json['translationVi'] ?? '').toString(),
      highlight: hl != null && hl.trim().isNotEmpty ? hl : null,
    );
  }
}

class GrammarRelatedTopic {
  const GrammarRelatedTopic({
    required this.id,
    required this.code,
    required this.cefrLevel,
    required this.titleEn,
    required this.titleVi,
    this.learnerStatus,
  });

  final String id;
  final String code;
  final String cefrLevel;
  final String titleEn;
  final String titleVi;
  final String? learnerStatus;

  factory GrammarRelatedTopic.fromJson(Map<String, Object?> json) {
    return GrammarRelatedTopic(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      cefrLevel: (json['cefrLevel'] ?? 'A1').toString(),
      titleEn: (json['titleEn'] ?? '').toString(),
      titleVi: (json['titleVi'] ?? '').toString(),
      learnerStatus: json['learnerStatus']?.toString(),
    );
  }
}

class GrammarLinkedLesson {
  const GrammarLinkedLesson({
    required this.id,
    required this.code,
    required this.title,
    required this.description,
    required this.estimatedMinutes,
    this.cefrLevel,
    this.state,
  });

  final String id;
  final String code;
  final String title;
  final String description;
  final int estimatedMinutes;
  final String? cefrLevel;
  final String? state;

  factory GrammarLinkedLesson.fromJson(Map<String, Object?> json) {
    return GrammarLinkedLesson(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt() ?? 10,
      cefrLevel: json['cefrLevel']?.toString(),
      state: json['state']?.toString(),
    );
  }
}

class GrammarTopicDetail {
  const GrammarTopicDetail({
    required this.id,
    required this.code,
    required this.cefrLevel,
    required this.titleEn,
    required this.titleVi,
    required this.summaryVi,
    required this.parent,
    required this.formulas,
    required this.usageNotes,
    required this.examples,
    required this.prerequisites,
    required this.dependents,
    required this.lessons,
    this.learnerStatus,
  });

  final String id;
  final String code;
  final String cefrLevel;
  final String titleEn;
  final String titleVi;
  final String summaryVi;
  final GrammarRelatedTopic? parent;
  final List<GrammarFormula> formulas;
  final List<GrammarUsageNote> usageNotes;
  final List<GrammarExample> examples;
  final List<GrammarRelatedTopic> prerequisites;
  final List<GrammarRelatedTopic> dependents;
  final List<GrammarLinkedLesson> lessons;
  final String? learnerStatus;

  factory GrammarTopicDetail.fromJson(Map<String, Object?> json) {
    final Object? rawParent = json['parent'];
    return GrammarTopicDetail(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      cefrLevel: (json['cefrLevel'] ?? 'A1').toString(),
      titleEn: (json['titleEn'] ?? '').toString(),
      titleVi: (json['titleVi'] ?? '').toString(),
      summaryVi: (json['summaryVi'] ?? '').toString(),
      parent: rawParent is Map
          ? GrammarRelatedTopic.fromJson(Map<String, Object?>.from(rawParent))
          : null,
      formulas: _asMapList(json['formulas']).map(GrammarFormula.fromJson).toList(),
      usageNotes: _asMapList(json['usageNotes'])
          .map(GrammarUsageNote.fromJson)
          .toList(),
      examples: _asMapList(json['examples']).map(GrammarExample.fromJson).toList(),
      prerequisites: _asMapList(json['prerequisites'])
          .map(GrammarRelatedTopic.fromJson)
          .toList(),
      dependents: _asMapList(json['dependents'])
          .map(GrammarRelatedTopic.fromJson)
          .toList(),
      lessons: _asMapList(json['lessons'])
          .map(GrammarLinkedLesson.fromJson)
          .toList(),
      learnerStatus: json['learnerStatus']?.toString(),
    );
  }
}

abstract class GrammarRepository {
  Future<List<GrammarLevelSummary>> fetchLevels();
  Future<List<GrammarTreeNode>> fetchTree();
  Future<GrammarTopicDetail> fetchTopicDetail(String code);
}

class ApiGrammarRepository implements GrammarRepository {
  ApiGrammarRepository(this.api, {required this.authenticated});

  final ApiClient api;
  final bool authenticated;

  @override
  Future<List<GrammarLevelSummary>> fetchLevels() async {
    final Json res = await api.request(
      'GET',
      '/grammar/levels',
      auth: authenticated,
    );
    return _asMapList(res['levels']).map(GrammarLevelSummary.fromJson).toList();
  }

  @override
  Future<List<GrammarTreeNode>> fetchTree() async {
    final Json res = await api.request(
      'GET',
      '/grammar/tree?groupBy=hierarchy',
      auth: authenticated,
    );
    return _asMapList(res['tree']).map(GrammarTreeNode.fromJson).toList();
  }

  @override
  Future<GrammarTopicDetail> fetchTopicDetail(String code) async {
    final String encoded = Uri.encodeComponent(code);
    final Json res = await api.request(
      'GET',
      '/grammar/topics/$encoded',
      auth: authenticated,
    );
    return GrammarTopicDetail.fromJson(Map<String, Object?>.from(res));
  }
}
