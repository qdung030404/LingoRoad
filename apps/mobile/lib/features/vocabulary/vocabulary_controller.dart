import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import 'vocabulary_models.dart';
import 'vocabulary_pending_store.dart';
import 'vocabulary_repository.dart';

class VocabularyController extends ChangeNotifier {
  VocabularyController({
    required this.repository,
    required this.accountId,
    required this.isCurrent,
    VocabularyPendingStore? store,
  }) : store = store ?? VocabularyPendingStore(accountId);
  final VocabularyRepository repository;
  final String accountId;
  final bool Function() isCurrent;
  final VocabularyPendingStore store;
  Json? summary;
  List<VocabularyDeck> decks = [];
  String? nextCursor, error;
  bool loading = false, busy = false, stale = false, conflict = false;
  bool _disposed = false;
  int _epoch = 0;
  int _deckEpoch = 0;
  Json? pending;
  bool _preparing = false;
  bool get active => !_disposed && isCurrent();
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  String message(Object e) => e is ApiFailure ? e.message : e.toString();

  Future<Json> read(String path) async {
    if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
    final key = 'cache.${Uri.encodeComponent(path)}';
    try {
      final result = await repository.request('GET', path);
      if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
      await store.write(key, result);
      return result;
    } on ApiFailure catch (e) {
      if (!active || e.status != null || e.code != 'NETWORK') rethrow;
      final cache = await store.read(key);
      if (!active || cache == null) rethrow;
      stale = true;
      error = 'Đang xem dữ liệu đã lưu. Chưa kết nối máy chủ.';
      notifyListeners();
      return cache;
    }
  }

  Future<void> refresh() async {
    if (!active) return;
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    try {
      pending ??= await store.read('library.pending');
      if (!active || epoch != _epoch) return;
      final cache = await store.read('summary');
      if (summary == null && cache != null && active && epoch == _epoch) {
        summary = cache;
        stale = true;
        notifyListeners();
      }
      final result = await repository.request('GET', '/vocabulary/summary');
      if (!active || epoch != _epoch) return;
      if (result['totals'] is! Map || result['decks'] is! List) {
        throw const ApiFailure('Dữ liệu từ vựng chưa đầy đủ.');
      }
      summary = result;
      stale = false;
      await store.write('summary', result);
    } catch (e) {
      if (active && epoch == _epoch) {
        error = message(e);
        stale = true;
      }
    } finally {
      if (active && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<Json> loadDecks({String query = '', String? cursor}) async {
    final epoch = ++_deckEpoch;
    final result = await read(
      vocabularyQuery('/vocabulary/decks', {
        'query': query,
        'cursor': cursor,
        'limit': '100',
      }),
    );
    if (active && epoch == _deckEpoch) {
      final rows = vocabularyItems(
        result['items'],
      ).map(VocabularyDeck.new).toList();
      decks = cursor == null ? rows : [...decks, ...rows];
      nextCursor = result['nextCursor'] as String?;
      notifyListeners();
    }
    return result;
  }

  Future<VocabularyDeck> deck(String id) async => VocabularyDeck(
    vocabularyJson((await read('/vocabulary/decks/$id'))['deck']),
  );
  Future<Json> words(String id, {String query = '', String? cursor}) => read(
    vocabularyQuery('/vocabulary/decks/$id/words', {
      'query': query,
      'cursor': cursor,
      'limit': '100',
    }),
  );
  Future<Json> history({String? deckId, String? cursor}) => read(
    vocabularyQuery('/vocabulary/history', {
      'deckId': deckId,
      'cursor': cursor,
      'limit': '20',
    }),
  );
  Future<Json> createDeck(String name) =>
      mutate('POST', '/vocabulary/decks', {'name': name});
  Future<Json> updateDeck(VocabularyDeck deck, String name) => mutate(
    'PATCH',
    '/vocabulary/decks/${deck.id}',
    {'name': name, 'expectedVersion': deck.version},
  );
  Future<Json> deleteDeck(VocabularyDeck deck) => mutate(
    'DELETE',
    '/vocabulary/decks/${deck.id}',
    {'expectedVersion': deck.version},
  );
  Future<Json> createWord(String deckId, Json body) =>
      mutate('POST', '/vocabulary/decks/$deckId/words', body);
  Future<Json> updateWord(VocabularyWord word, Json body) => mutate(
    'PATCH',
    '/vocabulary/words/${word.id}',
    {...body, 'expectedVersion': word.version},
  );
  Future<Json> deleteWord(VocabularyWord word) => mutate(
    'DELETE',
    '/vocabulary/words/${word.id}',
    {'expectedVersion': word.version},
  );
  Future<VocabularyReviewAttempt?> startReview(
    String deckId, {
    String scope = 'NEEDS_REVIEW',
  }) async {
    final result = await mutate('POST', '/vocabulary/decks/$deckId/reviews', {
      'scope': scope,
    });
    return result['attempt'] == null
        ? null
        : VocabularyReviewAttempt(vocabularyJson(result['attempt']));
  }

  Future<Json> mutate(String method, String path, Json body) async {
    if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
    if (busy || _preparing) throw const ApiFailure('Đang lưu thao tác trước.');
    _preparing = true;
    try {
      pending ??= await store.read('library.pending');
      if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
      if (pending != null) {
        final old = vocabularyJson(pending!['body'])..remove('commandId');
        if (pending!['method'] != method ||
            pending!['path'] != path ||
            jsonEncode(old) != jsonEncode(body)) {
          throw const ApiFailure(
            'Có thao tác chưa xác nhận. Hãy thử lại thao tác đó trước.',
          );
        }
      } else {
        pending = {
          'method': method,
          'path': path,
          'body': {...vocabularyCopy(body), 'commandId': vocabularyCommandId()},
        };
      }
      return await _retryPending();
    } finally {
      _preparing = false;
    }
  }

  Future<Json> retryPending() async {
    if (_preparing) throw const ApiFailure('Đang chuẩn bị thao tác trước.');
    return _retryPending();
  }

  Future<Json> _retryPending() async {
    if (!active || busy) {
      throw const ApiFailure('Không thể gửi thao tác lúc này.');
    }
    busy = true;
    error = null;
    notifyListeners();
    try {
      pending ??= await store.read('library.pending');
      if (pending == null) throw const ApiFailure('Không có thao tác chờ.');
      await store.write('library.pending', pending);
      if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
      final result = await repository.request(
        pending!['method'] as String,
        pending!['path'] as String,
        body: vocabularyJson(pending!['body']),
      );
      if (!active) throw const ApiFailure('Phiên đăng nhập đã thay đổi.');
      if ((result['receipt'] as Map?)?['commandId'] !=
          (pending!['body'] as Map)['commandId']) {
        throw const ApiFailure('Máy chủ chưa xác nhận đúng thao tác.');
      }
      await store.write('library.pending', null);
      pending = null;
      conflict = false;
      await refresh();
      return result;
    } catch (e) {
      if (active) {
        error = message(e);
        conflict =
            e is ApiFailure &&
            (e.status == 409 || e.status == 400 || e.status == 404);
      }
      rethrow;
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  /// Explicit resolution only; keep rejected payload for recovering user input.
  Future<void> resolveConflict() async {
    if (!active || busy || _preparing || !conflict) return;
    busy = true;
    notifyListeners();
    try {
      await store.write('library.rejected', pending);
      await store.write('library.pending', null);
      if (!active) return;
      pending = null;
      conflict = false;
      error = null;
      await refresh();
    } catch (e) {
      if (active) error = message(e);
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
