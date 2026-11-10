import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/speaking_modes_page.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
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
      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey('speaking-mode-TONGUE_TWISTER')),
      );
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
              child: SpeakingAssessment(
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
      expect(find.text('Mức độ đọc đủ'), findsNothing);
      expect(find.text('Nội dung bài nói'), findsOneWidget);
      expect(find.text('Điểm nội dung 80.0 / 100'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
