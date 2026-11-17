import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_pages.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/learning_widgets.dart';
import 'package:mobile/features/learning/listening_audio.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'learning_workflow_test.dart' show MemoryLearningRepository;

class FakeListeningEngine implements ListeningAudioEngine {
  final positionEvents = StreamController<Duration>.broadcast(sync: true);
  final durationEvents = StreamController<Duration>.broadcast(sync: true);
  final stateEvents = StreamController<PlayerState>.broadcast(sync: true);
  Completer<void>? loading;
  bool failLoad = false, disposed = false;
  bool failSeek = false, failRate = false, failPause = false;
  int loads = 0, plays = 0, pauses = 0;
  double rate = 1;
  Duration position = Duration.zero;
  @override
  Stream<Duration> get positions => positionEvents.stream;
  @override
  Stream<Duration> get durations => durationEvents.stream;
  @override
  Stream<PlayerState> get states => stateEvents.stream;
  @override
  Future<void> load(String url) async {
    loads++;
    await loading?.future;
    if (failLoad) throw StateError('offline');
    durationEvents.add(const Duration(seconds: 60));
  }

  @override
  Future<void> pause() async {
    pauses++;
    if (failPause) throw StateError('pause failed');
    if (!disposed) stateEvents.add(PlayerState.paused);
  }

  @override
  Future<void> resume() async {
    plays++;
    stateEvents.add(PlayerState.playing);
  }

  @override
  Future<void> seek(Duration value) async {
    if (failSeek) throw StateError('seek failed');
    position = value;
    positionEvents.add(value);
  }

  @override
  Future<void> setRate(double value) async {
    if (failRate) throw StateError('rate failed');
    rate = value;
  }

  @override
  Future<void> dispose() async {
    disposed = true;
    await positionEvents.close();
    await durationEvents.close();
    await stateEvents.close();
  }
}

class FailingStartRepository extends MemoryLearningRepository {
  int starts = 0;
  bool failStart = true;
  @override
  Future<LearningAttempt> start(String id) async {
    starts++;
    if (failStart) throw const ApiFailure('Start response lost');
    return super.start(id);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'initial rate configuration failure retries requested speed before playback',
    () async {
      final e = FakeListeningEngine();
      final c = ListeningAudioController(
        url: 'test.wav',
        isCurrent: () => true,
        engine: e,
      );
      await c.setRate(.75);
      e.failRate = true;
      await c.toggle();
      expect(c.loaded, false);
      expect(c.playing, false);
      expect(c.rate, .75);
      expect(e.rate, 1);
      expect(e.plays, 0);
      e.failRate = false;
      await c.toggle();
      expect(c.loaded, true);
      expect(e.rate, .75);
      expect(c.rate, e.rate);
      expect(e.plays, 1);
      c.dispose();
    },
  );
  for (final operation in ['rate', 'seek', 'pause']) {
    test('failed $operation preserves actual playback and UI state', () async {
      final e = FakeListeningEngine();
      var stops = 0;
      final c = ListeningAudioController(
        url: 'test.wav',
        isCurrent: () => true,
        engine: e,
        onStopped: () => stops++,
      );
      await c.toggle();
      if (operation == 'rate') {
        e.failRate = true;
        await c.setRate(.75);
      }
      if (operation == 'seek') {
        e.failSeek = true;
        await c.skip(5);
      }
      if (operation == 'pause') {
        e.failPause = true;
        await c.pause();
      }
      expect(c.playing, true);
      expect(c.error, isNotNull);
      expect(c.rate, 1);
      expect(
        stops,
        0,
        reason: 'No positive native pause/state event occurred.',
      );
      e.failPause = false;
      await c.pause();
      expect(c.playing, false);
      c.dispose();
    });
  }
  testWidgets(
    'start failure discloses fresh attempt and never automatically retries',
    (tester) async {
      final repo = FailingStartRepository();
      final owner = LearningController(repository: repo, accountId: 'alice');
      owner.lessons = [
        LearningLesson({
          'id': 'lesson',
          'title': 'Listening',
          'kind': 'LISTENING',
        }),
      ];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Thử lại sẽ tạo lượt học mới và có thể thay thế lượt chưa nộp của bài này.',
        ),
        findsOneWidget,
      );
      expect(repo.starts, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(repo.starts, 1);
      repo.failStart = false;
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(repo.starts, 2);
      expect(find.text('Câu 1/5'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  test(
    'load failure retries; speed and seek while paused never autoplay',
    () async {
      final engine = FakeListeningEngine()..failLoad = true;
      final c = ListeningAudioController(
        url: 'test.wav',
        isCurrent: () => true,
        engine: engine,
      );
      await c.toggle();
      expect(c.loaded, false);
      expect(c.error, isNotNull);
      engine.failLoad = false;
      await c.toggle();
      await c.pause();
      final plays = engine.plays;
      await c.setRate(.75);
      await c.seek(const Duration(seconds: 59));
      await c.skip(5);
      expect(engine.position, const Duration(seconds: 60));
      await c.skip(-100);
      expect(engine.position, Duration.zero);
      expect(engine.plays, plays);
      expect(c.rate, .75);
      c.dispose();
    },
  );
  test('background pause invalidates an in-flight load', () async {
    final engine = FakeListeningEngine()..loading = Completer<void>();
    final c = ListeningAudioController(
      url: 'test.wav',
      isCurrent: () => true,
      engine: engine,
    );
    final pending = c.toggle();
    await Future<void>.delayed(Duration.zero);
    await c.pause();
    engine.loading!.complete();
    await pending;
    expect(engine.plays, 0);
    expect(c.playing, false);
    c.dispose();
  });
  test('evidence queue skips gaps and stops at last end', () async {
    final e = FakeListeningEngine();
    final c = ListeningAudioController(
      url: 'test.wav',
      isCurrent: () => true,
      engine: e,
    );
    await c.playSegments([
      {'id': 'a', 'startMs': 1000, 'endMs': 2000},
      {'id': 'b', 'startMs': 5000, 'endMs': 6000},
    ]);
    expect(e.position, const Duration(seconds: 1));
    e.positionEvents.add(const Duration(seconds: 2));
    await Future<void>.delayed(Duration.zero);
    expect(e.position, const Duration(seconds: 5));
    e.positionEvents.add(const Duration(seconds: 6));
    await Future<void>.delayed(Duration.zero);
    expect(c.playing, false);
    expect(e.pauses, 1);
    c.dispose();
  });
  test(
    'changing account disposes audio even without a widget rebuild',
    () async {
      var current = true;
      final e = FakeListeningEngine();
      final c = ListeningAudioController(
        url: 'test.wav',
        isCurrent: () => current,
        engine: e,
      );
      await c.toggle();
      current = false;
      await Future<void>.delayed(const Duration(milliseconds: 250));
      expect(e.disposed, true);
      c.dispose();
    },
  );
  testWidgets(
    'player survives check and question move; transcript stays gated',
    (tester) async {
      final repo = MemoryLearningRepository();
      (repo.state['lesson'] as Map)['kind'] = 'LISTENING';
      repo.state['content'] = <String, dynamic>{
        'steps': [],
        'audioUrl': 'test.wav',
      };
      final owner = LearningController(repository: repo, accountId: 'alice');
      final e = FakeListeningEngine();
      var creates = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(
            owner: owner,
            lessonId: 'lesson',
            audioEngineFactory: () {
              creates++;
              return e;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<LearningAttemptPage>(find.byType(LearningAttemptPage))
            .owner,
        owner,
      );
      await tester.tap(find.byTooltip('Phát audio'));
      await tester.pumpAndSettle();
      e.positionEvents.add(const Duration(seconds: 12));
      await tester.pump();
      await tester.tap(find.byKey(const Key('listeningSpeed')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('0.75×'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Câu 2/5'), findsOneWidget);
      expect(creates, 1);
      expect(e.loads, 1);
      expect(e.rate, .75);
      expect(find.text('0:12'), findsOneWidget);
      expect(find.text('1:00'), findsOneWidget);
      expect(find.text('Bản chép lời'), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      expect(e.pauses, greaterThan(0));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'review translation is opt-in; legacy transcript and large type fit',
    (tester) async {
      final e = FakeListeningEngine();
      final c = ListeningAudioController(
        url: 'test.wav',
        isCurrent: () => true,
        engine: e,
      );
      await tester.binding.setSurfaceSize(const Size(320, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
            child: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: FigmaCard(
                        padding: const EdgeInsets.all(16),
                        child: ListeningAudioControls(controller: c),
                      ),
                    ),
                    LearningCard(
                      children: [
                        ListeningTranscript(
                          controller: c,
                          content: {
                            'transcriptSegments': [
                              {
                                'id': 's1',
                                'speaker': 'Ben',
                                'startMs': 0,
                                'endMs': 2000,
                                'text': 'Hello.',
                                'translationVi': 'Xin chào.',
                              },
                            ],
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      expect(find.text('Xin chào.'), findsNothing);
      expect(
        tester.widget<Slider>(find.byType(Slider)).semanticFormatterCallback!(
          12000,
        ),
        '12 giây',
      );
      await tester.tap(find.byType(Switch));
      await tester.pump();
      expect(find.text('Xin chào.'), findsOneWidget);
      expect(e.plays, 0);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListeningTranscript(
              key: UniqueKey(),
              controller: c,
              content: {'transcript': 'Legacy transcript'},
            ),
          ),
        ),
      );
      expect(find.text('Legacy transcript'), findsOneWidget);
      expect(find.byType(Switch), findsNothing);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
