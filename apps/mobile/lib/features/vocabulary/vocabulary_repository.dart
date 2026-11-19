import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';

abstract class VocabularyRepository {
  Future<Json> request(String method, String path, {Json? body});
  Future<Json> uploadImage(String filePath);
}

class ApiVocabularyRepository implements VocabularyRepository {
  ApiVocabularyRepository(this.api);
  final ApiClient api;
  @override
  Future<Json> request(String method, String path, {Json? body}) =>
      api.request(method, path, data: body);

  @override
  Future<Json> uploadImage(String filePath) => api.multipartRequest(
        'POST',
        '/vocabulary/upload-image',
        factory: () async => FormData.fromMap({
          'file': await MultipartFile.fromFile(filePath),
        }),
      );
}

String vocabularyQuery(String path, Map<String, String?> query) {
  final fields = <String, String>{
    for (final entry in query.entries)
      if (entry.value != null && entry.value!.isNotEmpty)
        entry.key: entry.value!,
  };
  return fields.isEmpty ? path : '$path?${Uri(queryParameters: fields).query}';
}
