import 'dart:math';
import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';

List<Json> speakingItems(dynamic value) => (value as List? ?? [])
    .map((item) => Map<String, dynamic>.from(item as Map))
    .toList();

bool speakingServiceUnavailable(String? code) => const {
  'azure_quota_exceeded',
  'azure_auth_failed',
  'azure_missing_config',
  'auth_failed',
  'missing_config',
  'speaking_disabled',
}.contains(code);

String speakingErrorMessage(String? code) => switch (code) {
  'azure_quota_exceeded' =>
    'Dịch vụ chấm đang hết hạn mức. Vui lòng quay lại sau.',
  'azure_auth_failed' ||
  'auth_failed' ||
  'azure_missing_config' ||
  'missing_config' => 'Dịch vụ chấm chưa sẵn sàng. Vui lòng quay lại sau.',
  'speech_not_recognized' =>
    'Chưa nhận diện được lời nói. Đọc rõ câu mẫu và ghi lại ở nơi yên tĩnh.',
  'audio_silent' => 'Bản thu chưa có tiếng nói. Kiểm tra micro và ghi lại.',
  'speaking_disabled' => 'Luyện nói đang tạm dừng. Bạn vẫn xem được lịch sử.',
  _ =>
    'Bản thu chưa được chấm thành công. Bạn có thể ghi lại hoặc chủ động nộp một lần mới.',
};

String speakingRequestId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

String speakingSentence(Json submission) {
  final snapshot = submission['promptSnapshot'];
  if (snapshot is String) return snapshot;
  if (snapshot is Map) return snapshot['text']?.toString() ?? '';
  return submission['text']?.toString() ?? '';
}

abstract class SpeakingRepository {
  Future<String> translateConversationTurn(String id, String itemId) => throw UnsupportedError('Translation unavailable');
  Future<Json> conversationTopics() async => {'enabled': false, 'items': <Json>[]};
  Future<Json> conversations({String? cursor}) async => {'items': <Json>[]};
  Future<Json> createConversation(String topicId, String requestId) => throw UnsupportedError('Conversation unavailable');
  Future<Json> conversation(String id) => throw UnsupportedError('Conversation unavailable');
  Future<Json> finishConversation(String id) => throw UnsupportedError('Conversation unavailable');
  Uri get conversationSocket => throw UnsupportedError('Conversation unavailable');
  Future<Json> prompts();
  Future<Json> promptsForMode(String mode) => prompts();
  Future<Json> gameProgress() async => {'items': <Json>[]};
  Future<Json> historyForMode({String? cursor, String? mode}) =>
      history(cursor: cursor);
  Future<Json> create(String promptId, String requestId);
  Future<Json> submission(String id);
  Future<Json> upload(String id, String path);
  Future<Json> history({String? cursor});
}

class ApiSpeakingRepository extends SpeakingRepository {
  ApiSpeakingRepository(this.api);
  final ApiClient api;
  @override
  Future<String> translateConversationTurn(String id, String itemId) async {
    final result = await api.request('POST', '/speaking/conversations/$id/turns/${Uri.encodeComponent(itemId)}/translation');
    return result['translationVi'] as String;
  }
  @override
  Future<Json> conversationTopics() => api.request('GET', '/speaking/conversations/topics');
  @override
  Future<Json> conversations({String? cursor}) => api.request('GET', '/speaking/conversations${cursor == null ? '' : '?cursor=$cursor'}');
  @override
  Future<Json> createConversation(String topicId, String requestId) => api.request('POST', '/speaking/conversations', data: {'topicId': topicId, 'clientRequestId': requestId});
  @override
  Future<Json> conversation(String id) => api.request('GET', '/speaking/conversations/$id');
  @override
  Future<Json> finishConversation(String id) => api.request('POST', '/speaking/conversations/$id/finish');
  @override
  Uri get conversationSocket {
    final base = Uri.parse(api.config.apiBaseUrl);
    return base.replace(scheme: base.scheme == 'https' ? 'wss' : 'ws', path: '/speaking/conversations/connect', query: null, fragment: null);
  }
  @override
  Future<Json> prompts() => api.request('GET', '/speaking/prompts');
  @override
  Future<Json> promptsForMode(String mode) => api.request(
    'GET',
    '/speaking/prompts?mode=${Uri.encodeQueryComponent(mode)}',
  );
  @override
  Future<Json> gameProgress() => api.request('GET', '/speaking/game/progress');
  @override
  Future<Json> historyForMode({String? cursor, String? mode}) {
    final query = Uri(
      queryParameters: {'cursor': ?cursor, 'mode': ?mode},
    ).query;
    return api.request(
      'GET',
      '/speaking/history${query.isEmpty ? '' : '?$query'}',
    );
  }

  @override
  Future<Json> create(String promptId, String requestId) => api.request(
    'POST',
    '/speaking/submissions',
    data: {'promptId': promptId, 'clientRequestId': requestId},
  );
  @override
  Future<Json> submission(String id) =>
      api.request('GET', '/speaking/submissions/$id');
  @override
  Future<Json> upload(String id, String path) => api.multipartRequest(
    'PUT',
    '/speaking/submissions/$id/audio',
    factory: () async => FormData.fromMap({
      'file': await MultipartFile.fromFile(
        path,
        filename: 'recording.wav',
        contentType: DioMediaType('audio', 'wav'),
      ),
    }),
  );
  @override
  Future<Json> history({String? cursor}) => api.request(
    'GET',
    '/speaking/history${cursor == null ? '' : '?cursor=${Uri.encodeQueryComponent(cursor)}'}',
  );
}
