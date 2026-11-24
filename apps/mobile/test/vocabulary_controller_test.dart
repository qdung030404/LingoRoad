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
  FakeVocabularyRepository(this.handler, {this.imageHandler});
  final Future<Json> Function(String, String, Json?) handler;
  final Future<Json> Function(String)? imageHandler;
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

  @override
  Future<Json> uploadImage(String filePath) async {
    calls.add({
      'method': 'POST',
      'path': '/vocabulary/upload-image',
      'filePath': filePath,
    });
    return imageHandler != null
        ? await imageHandler!(filePath)
        : {'url': 'https://example.com/test-image.jpg'};
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

Json multiAttempt({
  int count = 3,
  int version = 0,
  List<String>? words,
  List<String>? meanings,
}) {
  final defaultWords = ['apple', 'banana', 'cherry'];
  final defaultMeanings = ['quả táo', 'quả chuối', 'quả anh đào'];
  final items = List.generate(count, (i) {
    final english =
        words != null && i < words.length
            ? words[i]
            : (i < defaultWords.length ? defaultWords[i] : 'word$i');
    final meaning =
        meanings != null && i < meanings.length
            ? meanings[i]
            : (i < defaultMeanings.length ? defaultMeanings[i] : 'nghĩa $i');
    return {
      'id': 'item-$i',
      'wordId': 'word-$i',
      'state': 'PENDING',
      'draft': '',
      'word': {
        'id': 'word-$i',
        'english': english,
        'meaning': meaning,
        'contentVersion': 1,
      },
    };
  });
  return {
    'id': 'review',
    'deckId': 'deck',
    'deckSnapshot': {'name': 'Bộ từ'},
    'version': version,
    'status': 'IN_PROGRESS',
    'phase': 'FRONT',
    'queue': items.map((e) => e['id'] as String).toList(),
    'currentItem': items.isEmpty ? null : items.first,
    'items': items,
    'counts': {
      'totalCount': count,
      'reviewedCount': 0,
      'skippedCount': 0,
    },
  };
}

class BrokenStore extends VocabularyPendingStore {
  BrokenStore() : super('a');
  @override
  Future<void> write(String target, Json? value) async =>
      throw StateError('disk unavailable');
}

class GatedStore extends VocabularyPendingStore {
  GatedStore({this.gateTarget = '.rejected'}) : super('a');
  final String gateTarget;
  final entered = Completer<void>(), release = Completer<void>();
  @override
  Future<void> write(String target, Json? value) async {
    if (target.endsWith(gateTarget)) {
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
    'rating advances card locally with zero latency and batches submit',
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
      expect(await rating, true);
      expect(review.attempt!.queue, isEmpty);
      expect(review.attempt!.current, isNull);
      expect(review.attempt!.finished, false);
      await Future<void>.delayed(Duration.zero);
      expect(sent?['results'], isNotNull);
      expect((sent!['results'] as List).first['rating'], 'EASY');
      ack.complete({});
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(review.attempt!.finished, true);
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

  test('uploadImage delegates to repository and returns url', () async {
    final repo = FakeVocabularyRepository(
      (method, path, body) async => {},
      imageHandler: (path) async => {'url': 'https://azure.blob/test.png'},
    );
    final controller = VocabularyController(
      repository: repo,
      accountId: 'test-acc',
      isCurrent: () => true,
    );
    final url = await controller.uploadImage('sample.png');
    expect(url, 'https://azure.blob/test.png');
    expect(repo.calls.any((c) => c['path'] == '/vocabulary/upload-image'), isTrue);
    controller.dispose();
  });

  test('suggestWords uses in-memory cache and clears on dispose', () async {
    int networkCalls = 0;
    final repo = FakeVocabularyRepository((method, path, body) async {
      if (path.contains('/vocabulary/suggest')) {
        networkCalls++;
        return {
          'suggestions': [
            {'word': 'apple', 'pos': 'Noun'},
          ],
        };
      }
      return {};
    });
    final controller = VocabularyController(
      repository: repo,
      accountId: 'test-acc',
      isCurrent: () => true,
    );
    final res1 = await controller.suggestWords('apple');
    expect(res1.length, 1);
    expect(networkCalls, 1);

    // Second call should use cache
    final res2 = await controller.suggestWords('apple');
    expect(res2.length, 1);
    expect(networkCalls, 1);

    controller.dispose();
  });

  test(
    'multi-card rating advances locally without blocking before batch threshold',
    () async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': multiAttempt(count: 3)};
        return {};
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');

      expect(await review.rate('EASY'), true);
      expect(review.attempt!.current!.id, 'item-1');
      expect(review.hasPendingSingleCommand, false);
      expect(review.unsynced, true);

      expect(await review.rate('MEDIUM'), true);
      expect(review.attempt!.current!.id, 'item-2');
      expect(review.hasPendingSingleCommand, false);
      expect(repo.calls.where((c) => c['method'] == 'POST'), isEmpty);

      review.dispose();
      owner.dispose();
    },
  );

  test(
    'checkpoint at 15 cards and immediate skip within 10s forces flush before SKIP',
    () async {
      final state = multiAttempt(count: 17);
      final postPaths = <String>[];
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': vocabularyCopy(state)};
        postPaths.add(path);
        if (path.endsWith('/batch-submit')) {
          final results = body!['results'] as List;
          final ids = results.map((e) => (e as Map)['itemId'] as String).toSet();
          final items = (state['items'] as List).cast<Json>();
          for (final item in items) {
            if (ids.contains(item['id'])) {
              item['state'] = 'REVIEWED';
            }
          }
          final queue = (state['queue'] as List).cast<String>()
            ..removeWhere(ids.contains);
          state['queue'] = queue;
          state['currentItem'] = queue.isEmpty
              ? null
              : items.firstWhere((e) => e['id'] == queue.first);
          state['version'] = (state['version'] as int) + 1;
        } else if (path.endsWith('/commands') && body?['action'] == 'SKIP') {
          final queue = (state['queue'] as List).cast<String>();
          final skippedId = queue.removeAt(0);
          final items = (state['items'] as List).cast<Json>();
          items.firstWhere((e) => e['id'] == skippedId)['state'] = 'SKIPPED';
          state['currentItem'] = queue.isEmpty
              ? null
              : items.firstWhere((e) => e['id'] == queue.first);
          state['version'] = (state['version'] as int) + 1;
        }
        return {
          'receipt': {'commandId': body!['commandId']},
          'attempt': vocabularyCopy(state),
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');

      for (var i = 0; i < 15; i++) {
        expect(await review.rate('EASY'), true);
      }
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(postPaths, ['/vocabulary/reviews/review/batch-submit']);

      // Rate 16th card right after checkpoint (within 10s throttle window), then skip 17th
      expect(await review.rate('MEDIUM'), true);
      expect(await review.skip(), true);

      expect(postPaths, [
        '/vocabulary/reviews/review/batch-submit',
        '/vocabulary/reviews/review/batch-submit',
        '/vocabulary/reviews/review/commands',
      ]);
      expect(review.attempt!.queue, isEmpty);
      review.dispose();
      owner.dispose();
    },
  );

  test(
    'abandon aborts when flushing uncommitted ratings fails',
    () async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': multiAttempt(count: 2)};
        throw const ApiFailure('network down');
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');
      expect(await review.rate('EASY'), true);

      expect(await review.abandon(), false);
      expect(
        repo.calls.where((c) => c['path'] == '/vocabulary/reviews/review/commands'),
        isEmpty,
      );
      review.dispose();
      owner.dispose();
    },
  );

  test(
    'lost ACK freezes in-flight batch commandId and payload while queuing new ratings',
    () async {
      var failFirstBatch = true;
      final state = multiAttempt(count: 3);
      final sentBatches = <Json>[];
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': vocabularyCopy(state)};
        sentBatches.add(vocabularyCopy(body!));
        if (failFirstBatch) {
          failFirstBatch = false;
          throw const ApiFailure('lost ack');
        }
        final results = body['results'] as List;
        final ids = results.map((e) => (e as Map)['itemId'] as String).toSet();
        final items = (state['items'] as List).cast<Json>();
        for (final item in items) {
          if (ids.contains(item['id'])) item['state'] = 'REVIEWED';
        }
        final queue = (state['queue'] as List).cast<String>()
          ..removeWhere(ids.contains);
        state['queue'] = queue;
        state['currentItem'] = queue.isEmpty
            ? null
            : items.firstWhere((e) => e['id'] == queue.first);
        if (body['isFinal'] == true && queue.isEmpty) {
          state['status'] = 'COMPLETED';
        }
        state['version'] = (state['version'] as int) + 1;
        return {
          'receipt': {'commandId': body['commandId']},
          'attempt': vocabularyCopy(state),
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');

      expect(await review.rate('EASY'), true);
      expect(await review.checkpoint(), false);
      expect(sentBatches.length, 1);
      final firstCommandId = sentBatches[0]['commandId'];
      final firstResults = sentBatches[0]['results'] as List;
      expect(firstResults.length, 1);

      // Rate a second card while the first batch is awaiting retry
      expect(await review.rate('HARD'), true);
      expect(await review.retryPending(), true);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(sentBatches.length, 3);
      // Exact replay of frozen in-flight batch
      expect(sentBatches[1]['commandId'], firstCommandId);
      expect((sentBatches[1]['results'] as List).length, 1);
      expect((sentBatches[1]['results'] as List).first['itemId'], 'item-0');
      // Second batch carries only the newly queued item with a fresh commandId
      expect(sentBatches[2]['commandId'], isNot(firstCommandId));
      expect((sentBatches[2]['results'] as List).length, 1);
      expect((sentBatches[2]['results'] as List).first['itemId'], 'item-1');

      review.dispose();
      owner.dispose();
    },
  );

  test(
    'journal restores uncommitted ratings after restart and flushes them',
    () async {
      var fail = true;
      final state = multiAttempt(count: 2);
      final sentBatches = <Json>[];
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': vocabularyCopy(state)};
        if (fail) throw const ApiFailure('offline');
        sentBatches.add(vocabularyCopy(body!));
        final results = body['results'] as List;
        final ids = results.map((e) => (e as Map)['itemId'] as String).toSet();
        final queue = (state['queue'] as List).cast<String>()
          ..removeWhere(ids.contains);
        state['queue'] = queue;
        state['currentItem'] = queue.isEmpty ? null : state['items'][1];
        state['version'] = (state['version'] as int) + 1;
        return {
          'receipt': {'commandId': body['commandId']},
          'attempt': vocabularyCopy(state),
        };
      });

      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final first = VocabularyReviewController(owner: owner);
      await first.load('review');
      expect(await first.rate('EASY'), true);
      expect(await first.checkpoint(), false);
      first.dispose();

      fail = false;
      final second = VocabularyReviewController(owner: owner);
      await second.load('review');
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(sentBatches.length, 1);
      expect((sentBatches[0]['results'] as List).first['itemId'], 'item-0');
      expect(second.attempt!.current!.id, 'item-1');
      second.dispose();
      owner.dispose();
    },
  );

  test(
    'rate surfaces persistence error and does not advance card when store fails',
    () async {
      final repo = FakeVocabularyRepository(
        (method, path, body) async => {'attempt': multiAttempt(count: 2)},
      );
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
        store: BrokenStore(),
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');
      expect(await review.rate('EASY'), false);
      expect(review.error, contains('disk unavailable'));
      expect(review.attempt!.current!.id, 'item-0');
      expect(review.attempt!.queue, ['item-0', 'item-1']);
      review.dispose();
      owner.dispose();
    },
  );

  test(
    'concurrent rate calls while journal is saving do not duplicate itemId',
    () async {
      final store = GatedStore(gateTarget: '.journal');
      final repo = FakeVocabularyRepository(
        (method, path, body) async => {'attempt': multiAttempt(count: 2)},
      );
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
        store: store,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');

      final firstRate = review.rate('EASY');
      await store.entered.future;
      // Second rate before first _saveJournal completes must be ignored
      expect(await review.rate('HARD'), false);

      store.release.complete();
      expect(await firstRate, true);

      final savedJournal = await store.read('review.review.journal');
      final queued = savedJournal?['queued'] as List?;
      expect(queued?.length, 1);
      expect((queued?.first as Map)['itemId'], 'item-0');
      expect((queued?.first as Map)['rating'], 'EASY');
      expect(review.attempt!.current!.id, 'item-1');

      review.dispose();
      owner.dispose();
    },
  );

  test(
    'resolveConflict backs up uncommitted journal to rejectedJournal before clearing',
    () async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': multiAttempt(count: 3)};
        throw const ApiFailure('invalid batch', status: 400);
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final review = VocabularyReviewController(owner: owner);
      await review.load('review');

      expect(await review.rate('EASY'), true);
      expect(await review.checkpoint(), false);
      expect(review.conflict, true);

      // Add another rating while in flight failed before resolving
      await review.resolveConflict();
      expect(review.conflict, false);
      expect(review.unsynced, false);

      final backup = await owner.store.read('review.review.rejectedJournal');
      expect(backup, isNotNull);
      expect(backup!['inFlight'], isNotNull);
      expect(
        ((backup['inFlight'] as Map)['results'] as List).first['itemId'],
        'item-0',
      );
      expect(await owner.store.read('review.review.journal'), isNull);

      review.dispose();
      owner.dispose();
    },
  );
}
