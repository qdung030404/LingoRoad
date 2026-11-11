import 'dart:convert';
import 'dart:math';
import '../../core/api/api_client.dart';

Json vocabularyJson(dynamic value) => Map<String, dynamic>.from(value as Map);
List<Json> vocabularyItems(dynamic value) =>
    (value as List? ?? []).map(vocabularyJson).toList();
Json vocabularyCopy(Json value) =>
    vocabularyJson(jsonDecode(jsonEncode(value)));
String vocabularyCommandId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class VocabularyDeck {
  VocabularyDeck(this.json);
  final Json json;
  String get id => json['id'] as String;
  String get name => json['name'] as String;
  int get version => (json['version'] as num).toInt();
  int get totalWords => (json['totalWords'] as num? ?? 0).toInt();
  int get rememberedWords => (json['rememberedWords'] as num? ?? 0).toInt();
  int get needsReviewWords => (json['needsReviewWords'] as num? ?? 0).toInt();
  String? get activeAttemptId => json['activeAttemptId'] as String?;
}

class VocabularyWord {
  VocabularyWord(this.json);
  final Json json;
  String get id => json['id'] as String;
  String get english => json['english'] as String;
  String get meaning => json['meaning'] as String;
  int get version => (json['version'] as num? ?? 0).toInt();
  int get contentVersion => (json['contentVersion'] as num? ?? 1).toInt();
  String get learningState =>
      json['learningState'] as String? ?? 'NEEDS_REVIEW';
  String field(String name) => json[name] as String? ?? '';
}

class VocabularyReviewItem {
  VocabularyReviewItem(this.json);
  final Json json;
  String get id => json['id'] as String;
  String get state => json['state'] as String;
  VocabularyWord get word => VocabularyWord(vocabularyJson(json['word']));
  String get draft => json['draft'] as String? ?? '';
  bool get checked => json['checkedAt'] != null;
  bool? get isCorrect => json['isCorrect'] as bool?;
  String? get checkedAnswer => json['checkedAnswer'] as String?;
  String? get rating => json['rating'] as String?;
}

class VocabularyReviewAttempt {
  VocabularyReviewAttempt(this.json);
  final Json json;
  String get id => json['id'] as String;
  String get deckId => json['deckId'] as String;
  String get deckName => (json['deckSnapshot'] as Map)['name'] as String;
  int get version => (json['version'] as num).toInt();
  String get phase => json['phase'] as String? ?? 'FRONT';
  String get status => json['status'] as String;
  bool get finished => status != 'IN_PROGRESS';
  List<VocabularyReviewItem> get items =>
      vocabularyItems(json['items']).map(VocabularyReviewItem.new).toList();
  List<String> get queue => (json['queue'] as List).cast<String>();
  VocabularyReviewItem? get current => json['currentItem'] is Map
      ? VocabularyReviewItem(vocabularyJson(json['currentItem']))
      : null;
  Json get counts => vocabularyJson(json['counts']);
  int count(String name) => (counts[name] as num? ?? 0).toInt();
}
