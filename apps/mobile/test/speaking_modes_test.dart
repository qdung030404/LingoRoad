import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/speaking_modes_page.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_review_widgets.dart';
import 'speaking_workflow_test.dart'
    show FakeSpeakingRepository, FakeRecorder, wav;

class ModeRepository extends FakeSpeakingRepository {
  @override
  Future<Json> promptsForMode(String mode) async => {
    'enabled': true,
    'items': [
      {
        'id': 'first',
        'text': mode == 'TOPIC' ? 'Introduce yourself' : 'She sees cheese.',
        'difficulty': 1,
        'hints': ['Where do you live?'],
      },
      if (mode == 'TONGUE_TWISTER')
        {'id': 'second', 'text': 'Red lorry, yellow lorry.', 'difficulty': 1},
    ],
  };
  @override
  Future<Json> gameProgress() async => {
    'items': [
      {'id': 'first', 'unlocked': true, 'stars': 0, 'bestScore': null},
      {'id': 'second', 'unlocked': false, 'stars': 0, 'bestScore': null},
    ],
  };
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'topic WAV preserves PCM through 60 seconds while reading keeps 30-second cap',
    () {
      final input = wav(16000 * 61);
      final topic = limitSpeakingWav(input, maxSeconds: 60);
      expect(topic.length, 44 + 60 * 32000);
      expect(topic.sublist(44), input.sublist(44, 44 + 60 * 32000));
      expect(limitSpeakingWav(input).length, 44 + 30 * 32000);
    },
  );
  testWidgets(
    'three modes fit 320px and topic selection uses 60-second recording',
    (tester) async {
      tester.view.physicalSize = const Size(320, 820);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = SpeakingController(
        repository: ModeRepository(),
        recorder: FakeRecorder('unused'),
        accountId: 'modes',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: SpeakingModesPage(
            controller: controller,
            practicePage: () => const Scaffold(body: Text('Practice opened')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Luyện đọc'), findsOneWidget);
      expect(find.text('Nói theo chủ đề'), findsOneWidget);
      final topicButton = find.byKey(const ValueKey('speaking-mode-TOPIC'));
      await tester.ensureVisible(topicButton);
      await tester.pumpAndSettle();
      await tester.tap(topicButton);
      await tester.pumpAndSettle();
      expect(controller.maxSeconds, 60);
      expect(find.text('Introduce yourself'), findsOneWidget);
      await tester.tap(find.text('Bắt đầu luyện'));
      await tester.pumpAndSettle();
      expect(find.text('Practice opened'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
  testWidgets(
    'game catalogue exposes the first level and disables locked levels',
    (tester) async {
      final controller = SpeakingController(
        repository: ModeRepository(),
        recorder: FakeRecorder('unused'),
        accountId: 'game',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: SpeakingModesPage(
            controller: controller,
            practicePage: () => const Scaffold(body: Text('Practice opened')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final tongueTwisterBtn = find.byKey(
        const ValueKey('speaking-mode-TONGUE_TWISTER'),
      );
      await tester.scrollUntilVisible(
        tongueTwisterBtn,
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(tongueTwisterBtn);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Hoàn thành màn trước'), 200);
      final locked = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Hoàn thành màn trước'),
      );
      expect(locked.onPressed, isNull);
      expect(controller.maxSeconds, 30);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
  testWidgets(
    'topic result shows three pronunciation criteria and grounded content at narrow width',
    (tester) async {
      tester.view.physicalSize = const Size(320, 820);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: SpeakingResult(
                result: {
                  'schemaVersion': 3,
                  'mode': 'TOPIC',
                  'overall': 78.5,
                  'accuracy': 80,
                  'fluency': 90,
                  'prosody': 65,
                  'durationSeconds': 45,
                  'transcript': 'Hello.',
                  'words': [],
                  'scoringPolicy': {
                    'weights': {'accuracy': 40, 'fluency': 25, 'prosody': 25},
                  },
                  'content': {
                    'status': 'succeeded',
                    'overall': 80,
                    'vocabulary': 70,
                    'grammar': 80,
                    'topic': 90,
                    'strengths': ['Diễn đạt rõ ý'],
                    'improvements': [
                      {
                        'quote': 'Hello.',
                        'explanationVi': 'Thêm thông tin.',
                        'suggestion': 'Hello, my name is Anna.',
                      },
                    ],
                  },
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Điểm phát âm'), findsOneWidget);
      expect(find.text('78.5'), findsOneWidget);
      expect(find.text('80.0'), findsOneWidget);
      expect(find.text('Nội dung bài nói'), findsNothing);
      await tester.tap(find.text('Điểm chi tiết'));
      await tester.pumpAndSettle();
      expect(find.text('Mức độ đọc đủ'), findsNothing);
      expect(find.text('Nội dung bài nói'), findsOneWidget);
      expect(find.text('Từ vựng'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('read-aloud keeps legacy score, completeness and word review', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: SpeakingResult(
              referenceText: 'Hello world.',
              result: {
                'pronunciation': 96.7,
                'accuracy': 100,
                'fluency': 95,
                'completeness': 98,
                'transcript': 'Hello.',
                'words': [
                  {
                    'word': 'Hello',
                    'accuracy': 100,
                    'errorType': 'None',
                    'phonemes': [
                      {'phoneme': 'h', 'accuracy': 100},
                    ],
                  },
                  {'word': 'world', 'errorType': 'Omission'},
                ],
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Điểm phát âm'), findsOneWidget);
    expect(find.text('Phát âm'), findsNothing);
    expect(find.text('96.7'), findsOneWidget);
    expect(find.text('Nội dung'), findsNothing);
    expect(find.text('Mức độ đọc đủ'), findsNothing);
    await tester.tap(find.text('Điểm chi tiết'));
    await tester.pumpAndSettle();
    expect(find.text('Mức độ đọc đủ'), findsOneWidget);
    expect(find.text('98.0'), findsOneWidget);
    expect(find.text('Nội dung bài nói'), findsNothing);
    expect(find.text('Chi tiết bài đọc'), findsOneWidget);
    expect(find.text('Annotation'), findsNothing);
    expect(find.text('Bỏ sót'), findsOneWidget);
    expect(find.text('Đọc thêm'), findsOneWidget);
    expect(find.text('Ngắt nghỉ sai'), findsOneWidget);
    expect(
      tester.getCenter(find.text('Bỏ sót')).dy,
      tester.getCenter(find.text('Phát âm cần luyện')).dy,
    );
    final transcript = find.text('Xem lời nhận diện');
    await tester.ensureVisible(transcript);
    await tester.pumpAndSettle();
    await tester.tap(transcript);
    await tester.pumpAndSettle();
    expect(find.text('Hello.'), findsOneWidget);
    final word = find.byKey(const ValueKey('speaking-reference-0'));
    await tester.ensureVisible(word);
    await tester.pumpAndSettle();
    await tester.tap(word);
    await tester.pumpAndSettle();
    expect(find.text('Âm tiết & âm vị'), findsOneWidget);
    expect(find.byTooltip('Đóng chi tiết'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('saved results use the shared topic header in both modes', (
    tester,
  ) async {
    for (final mode in ['READ_ALOUD', 'TOPIC']) {
      final isTopic = mode == 'TOPIC';
      final repository = ModeRepository()
        ..value = {
          'id': 'submission',
          'status': 'SUCCEEDED',
          'createdAt': '2026-11-11T05:34:00Z',
          'promptSnapshot': {
            'mode': mode,
            'text': isTopic ? 'Describe your day.' : 'My name is Anna',
            if (isTopic) 'title': 'My day',
          },
        };
      final controller = SpeakingController(
        repository: repository,
        recorder: FakeRecorder('unused'),
        accountId: 'modes',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: SpeakingHistoryDetail(controller: controller, id: 'submission'),
        ),
      );
      await tester.pumpAndSettle();
      final header = tester.widget<SpeakingReviewHeader>(
        find.byType(SpeakingReviewHeader),
      );
      expect(header.title, isTopic ? 'My day' : 'My name is Anna');
      expect(
        header.icon,
        isTopic ? Icons.mic_none_rounded : Icons.headphones_rounded,
      );
      expect(header.statusLabel, 'Đã chấm');
      expect(header.dateLabel, '11/11/2026, 12:34');
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    }
  });
}
