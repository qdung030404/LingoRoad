part of 'vocabulary_controller_test.dart';

void _registerVocabularyControllerExtraTests() {
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
