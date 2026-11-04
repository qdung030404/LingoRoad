import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart';
import 'package:mobile/features/vocabulary/vocabulary_pending_store.dart';
import 'package:mobile/features/vocabulary/vocabulary_repository.dart';
import 'package:mobile/features/vocabulary/vocabulary_review_controller.dart';

class FakeVocabularyRepository implements VocabularyRepository {
  FakeVocabularyRepository(this.handler);
  final Future<Json> Function(String, String, Json?) handler;
  final List<Json> calls = [];
  @override
  Future<Json> request(String method, String path, {Json? body}) {
    calls.add({
      'method': method,
      'path': path,
      'body': body == null ? null : vocabularyCopy(body),
    });
    return handler(method, path, body);
  }
}

Json summary() => {
  'totals': {'totalWords': 0},
  'decks': [],
};
Json attempt({int version = 0, bool finished = false}) {
  final item = {
    'id': 'item',
    'wordId': 'word',
    'state': 'PENDING',
    'draft': '',
    'word': {
      'id': 'word',
      'english': 'apple',
      'meaning': 'quả táo',
      'contentVersion': 1,
    },
  };
  return {
    'id': 'review',
    'deckId': 'deck',
    'deckSnapshot': {'name': 'Bộ từ'},
    'version': version,
    'status': finished ? 'COMPLETED' : 'IN_PROGRESS',
    'phase': 'FRONT',
    'queue': finished ? [] : ['item'],
    'currentItem': finished ? null : item,
    'items': [item],
    'counts': {'totalCount': 1, 'reviewedCount': finished ? 1 : 0},
  };
}

class BrokenStore extends VocabularyPendingStore {
  BrokenStore() : super('a');
  @override
  Future<void> write(String target, Json? value) async =>
      throw StateError('disk unavailable');
}

class GatedStore extends VocabularyPendingStore {
  GatedStore() : super('a');
  final entered = Completer<void>(), release = Completer<void>();
  @override
  Future<void> write(String target, Json? value) async {
    if (target.endsWith('.rejected')) {
      if (!entered.isCompleted) entered.complete();
      await release.future;
    }
    await super.write(target, value);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'lost ACK is retried with durable command ID after controller restart',
    () async {
      var fail = true;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return summary();
        if (fail) throw const ApiFailure('Mất phản hồi');
        return {
          'receipt': {'commandId': body!['commandId']},
          'deck': {'id': 'deck', 'name': 'Bộ từ', 'version': 0},
        };
      });
      final first = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await expectLater(first.createDeck('Bộ từ'), throwsA(isA<ApiFailure>()));
      final commandId = (repo.calls.last['body'] as Map)['commandId'];
      first.dispose();
      fail = false;
      final second = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await second.refresh();
      await second.retryPending();
      expect(
        (repo.calls.where((c) => c['method'] == 'POST').last['body']
            as Map)['commandId'],
        commandId,
      );
      expect(await second.store.read('library.pending'), isNull);
      second.dispose();
    },
  );
  test(
    'concurrent library mutations cannot overwrite the first pending command',
    () async {
      final gate = Completer<Json>();
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return summary();
        final result = await gate.future;
        return {
          ...result,
          'receipt': {'commandId': body!['commandId']},
        };
      });
      final controller = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final first = controller.createDeck('first');
      await expectLater(
        controller.createDeck('second'),
        throwsA(isA<ApiFailure>()),
      );
      gate.complete({});
      await first;
      expect(repo.calls.where((c) => c['method'] == 'POST').length, 1);
      controller.dispose();
    },
  );
  test('failed local persistence prevents any server mutation', () async {
    final repo = FakeVocabularyRepository(
      (method, path, body) async => summary(),
    );
    final controller = VocabularyController(
      repository: repo,
      accountId: 'a',
      isCurrent: () => true,
      store: BrokenStore(),
    );
    await expectLater(
      controller.createDeck('first'),
      throwsA(isA<StateError>()),
    );
    expect(repo.calls, isEmpty);
    controller.dispose();
  });
  test(
    'account switch ignores a response and retains only old-account pending',
    () async {
      var current = true;
      final gate = Completer<Json>();
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return summary();
        await gate.future;
        return {
          'receipt': {'commandId': body!['commandId']},
        };
      });
      final a = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => current,
      );
      final action = a.createDeck('A');
      await Future<void>.delayed(Duration.zero);
      current = false;
      gate.complete({});
      await expectLater(action, throwsA(isA<ApiFailure>()));
      expect(await a.store.read('library.pending'), isNotNull);
      expect(await VocabularyPendingStore('b').read('library.pending'), isNull);
      a.dispose();
    },
  );
  test(
    'review keeps old card on lost ACK and replays exact payload once',
    () async {
      var failed = true;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': attempt()};
        if (failed) throw const ApiFailure('offline');
        return {
          'receipt': {'commandId': body!['commandId']},
          'attempt': attempt(version: 1),
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');
      expect(await review.skip(), false);
      expect(review.attempt!.version, 0);
      final original = vocabularyCopy(review.pending!);
      failed = false;
      expect(await review.retryPending(), true);
      expect(
        repo.calls.where((c) => c['method'] == 'POST').last['body'],
        original,
      );
      expect(review.unsynced, false);
      review.dispose();
      owner.dispose();
    },
  );
  test(
    'draft restores only for matching item/revision; conflicts keep text recoverable',
    () async {
      var version = 0;
      final repo = FakeVocabularyRepository(
        (method, path, body) async => {'attempt': attempt(version: version)},
      );
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final first = VocabularyReviewController(owner: owner);
      await first.load('review');
      await first.setPhase('RECALL');
      first.changeDraft('my answer');
      await first.saveDraft();
      first.dispose();
      final second = VocabularyReviewController(owner: owner);
      await second.load('review');
      expect(second.phase, 'RECALL');
      expect(second.draft, 'my answer');
      version = 2;
      await second.load('review');
      expect(second.recoveredDraft, 'my answer');
      expect(second.draft, '');
      second.dispose();
      owner.dispose();
    },
  );
  test(
    'rating does not publish next card until ACK and feedback duration',
    () async {
      final ack = Completer<Json>();
      Json? sent;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': attempt()};
        sent = body;
        await ack.future;
        return {
          'receipt': {'commandId': body!['commandId']},
          'attempt': attempt(version: 1, finished: true),
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');
      final rating = review.rate('EASY');
      await Future<void>.delayed(Duration.zero);
      expect(sent?['rating'], 'EASY');
      expect(review.selectedRating, 'EASY');
      expect(review.attempt!.version, 0);
      ack.complete({});
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(review.attempt!.version, 0);
      expect(await rating, true);
      expect(review.attempt!.version, 1);
      review.dispose();
      owner.dispose();
    },
  );
  test(
    'read cache is isolated and never used to mask forbidden/not-found responses',
    () async {
      var offline = false, forbidden = false;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (forbidden) throw const ApiFailure('Không tìm thấy', status: 404);
        if (offline) throw const ApiFailure('offline');
        return {
          'items': [
            {'id': 'deck', 'name': 'A', 'version': 0},
          ],
          'nextCursor': null,
        };
      });
      final a = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await a.loadDecks();
      offline = true;
      await a.loadDecks();
      expect(a.decks.single.name, 'A');
      expect(a.stale, true);
      final b = VocabularyController(
        repository: repo,
        accountId: 'b',
        isCurrent: () => true,
      );
      await expectLater(b.loadDecks(), throwsA(isA<ApiFailure>()));
      forbidden = true;
      await expectLater(a.loadDecks(), throwsA(isA<ApiFailure>()));
      a.dispose();
      b.dispose();
    },
  );
  test(
    'phase/check persistence errors are visible and never send a request',
    () async {
      final repo = FakeVocabularyRepository(
        (method, path, body) async => {'attempt': attempt()},
      );
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
        store: BrokenStore(),
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');
      await review.setPhase('RECALL');
      expect(review.phase, 'FRONT');
      expect(review.error, contains('disk unavailable'));
      review.changeDraft('apple');
      expect(await review.check(), false);
      expect(review.draft, 'apple');
      expect(repo.calls.where((c) => c['method'] == 'POST'), isEmpty);
      review.dispose();
      owner.dispose();
      await Future<void>.delayed(Duration.zero);
    },
  );
  test(
    'conflict resolution blocks concurrent retry while pending is cleared',
    () async {
      final store = GatedStore();
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return summary();
        throw const ApiFailure('revision conflict', status: 409);
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
        store: store,
      );
      await expectLater(owner.createDeck('A'), throwsA(isA<ApiFailure>()));
      final resolving = owner.resolveConflict();
      await store.entered.future;
      await expectLater(owner.retryPending(), throwsA(isA<ApiFailure>()));
      expect(repo.calls.where((c) => c['method'] == 'POST').length, 1);
      store.release.complete();
      await resolving;
      expect(owner.pending, isNull);
      owner.dispose();
    },
  );
  test('review conflict resolution cannot race a receipt retry', () async {
    final store = GatedStore();
    final repo = FakeVocabularyRepository((method, path, body) async {
      if (method == 'GET') return {'attempt': attempt()};
      throw const ApiFailure('revision conflict', status: 409);
    });
    final owner = VocabularyController(
      repository: repo,
      accountId: 'a',
      isCurrent: () => true,
      store: store,
    );
    final review = VocabularyReviewController(owner: owner);
    await review.load('review');
    expect(await review.skip(), false);
    final resolving = review.resolveConflict();
    await store.entered.future;
    expect(await review.retryPending(), false);
    expect(repo.calls.where((c) => c['method'] == 'POST').length, 1);
    store.release.complete();
    await resolving;
    expect(review.pending, isNull);
    expect(review.conflict, false);
    review.dispose();
    owner.dispose();
  });
}
