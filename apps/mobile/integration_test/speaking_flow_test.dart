import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';

// Device-only UI/recorder smoke. Uses a fake provider and never signs in/out,
// touches cloud APIs, or changes an existing account's stored app data.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native microphone, own playback, submission and history', (
    tester,
  ) async {
    final repository = _Repository();
    final recorder = DeviceSpeakingRecorder('device-smoke-speaking');
    var amplitudeSamples = 0;
    final amplitudeSubscription = recorder.amplitudes.listen(
      (_) => amplitudeSamples++,
    );
    addTearDown(amplitudeSubscription.cancel);
    final c = SpeakingController(
      repository: repository,
      recorder: recorder,
      accountId: 'device-smoke-speaking',
      isCurrent: () => true,
    );
    await tester.runAsync(c.initialize);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: PracticeIntroPage(
          skill: PracticeSkill.speaking,
          model: PreviewModel(),
          speaking: c,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bắt đầu'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('speaking-mode-READ_ALOUD')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bắt đầu luyện'));
    await tester.pumpAndSettle();
    expect(find.byType(MicrophonePreviewPage), findsOneWidget);
    await tester.tap(find.text('Cho phép dùng micro'));
    await tester.pumpAndSettle();
    expect(find.byType(SpeakingPreviewPage), findsOneWidget);
    await tester.tap(find.byKey(const Key('previewRecord')));
    await tester.runAsync(
      () async => Future<void>.delayed(const Duration(seconds: 3)),
    );
    await tester.pump();
    expect(
      c.recording,
      isTrue,
      reason: 'Grant RECORD_AUDIO to test app before running this smoke.',
    );
    await tester.tap(find.byKey(const Key('previewRecord')));
    await tester.runAsync(
      () async => Future<void>.delayed(const Duration(seconds: 1)),
    );
    await tester.pumpAndSettle();
    expect(c.audioPath, isNotNull);
    expect(
      amplitudeSamples,
      greaterThan(0),
      reason: 'Native recorder emits microphone amplitude.',
    );
    final recordedPath = c.audioPath!;
    expect(await File(recordedPath).length(), greaterThan(44));
    await tester.tap(find.byKey(const Key('speakingPlayback')));
    await tester.runAsync(
      () async => Future<void>.delayed(const Duration(seconds: 1)),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.byKey(const Key('previewNext')));
    await tester.tap(find.byKey(const Key('previewNext')));
    await tester.runAsync(
      () async => Future<void>.delayed(const Duration(seconds: 1)),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('speaking-reference-0')), findsOneWidget);
    expect(repository.uploads, 1);
    expect(await File(recordedPath).exists(), true);
    expect(find.byKey(const Key('speakingExportWav')), findsNothing);
    expect(find.text('94.3'), findsOneWidget);
    expect(find.text('Ngữ điệu'), findsOneWidget);
    if (const bool.fromEnvironment('CAPTURE_SPEAKING_UI')) {
      debugPrint('SPEAKING_V2_RESULT_CAPTURE');
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(seconds: 3)),
      );
    }
    await tester.ensureVisible(find.byKey(const Key('speaking-reference-0')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('speaking-reference-0')));
    await tester.pumpAndSettle();
    expect(find.text('Âm vị'), findsOneWidget);
    expect(find.text('m'), findsOneWidget);
    await tester.tap(find.text('Nghe đoạn của từ'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(seconds: 1)),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Đóng chi tiết'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hoàn thành'));
    await tester.pumpAndSettle();
    expect(c.submission, isNull);
    expect(await File(recordedPath).exists(), false);
    await tester.tap(find.text('Bắt đầu luyện'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cho phép dùng micro'));
    await tester.pumpAndSettle();
    expect(c.submission, isNull);
    expect(find.byKey(const Key('previewRecord')), findsOneWidget);
    expect(find.text('Chúng tôi nghe được'), findsNothing);
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Lịch sử luyện nói'));
    await tester.pumpAndSettle();
    expect(find.text('Đã chấm'), findsOneWidget);
    await tester.tap(find.text('Xem kết quả'));
    await tester.pumpAndSettle();
    expect(find.text('Kết quả phát âm'), findsOneWidget);
    expect(find.text('Nghe bản thu của bạn'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    c.dispose();
  });
}

class _Repository extends SpeakingRepository {
  int uploads = 0;
  Json value = {
    'id': 'device-submission',
    'promptSnapshot': {'text': 'My name is Anna'},
    'status': 'CREATED',
    'createdAt': '2026-11-08T08:00:00Z',
  };
  @override
  Future<Json> prompts() async => {
    'enabled': true,
    'items': [
      {'id': 'device-prompt', 'text': 'My name is Anna', 'contentVersion': 1},
    ],
  };
  @override
  Future<Json> create(String promptId, String requestId) async => Map.of(value);
  @override
  Future<Json> submission(String id) async => Map.of(value);
  @override
  Future<Json> upload(String id, String path) async {
    uploads++;
    value = {
      ...value,
      'status': 'SUCCEEDED',
      'result': {
        'schemaVersion': 2,
        'assessmentProfile': 'read-aloud-v2',
        'assessmentCompleteness': 'full',
        'referenceText': 'My name is Anna',
        'accuracy': 95.2,
        'fluency': 90.1,
        'completeness': 100,
        'prosody': 88.7,
        'pronunciation': 94.3,
        'transcript': 'My name is Anna',
        'words': [
          {
            'word': 'My',
            'accuracy': 95.2,
            'errorType': 'None',
            'offsetMs': 0,
            'durationMs': 500,
            'phonemes': [
              {'phoneme': 'm', 'accuracy': 96.1},
            ],
            'syllables': [
              {'syllable': 'maɪ', 'accuracy': 95.2},
            ],
            'prosody': {
              'unexpectedBreakConfidence': 0.1,
              'missingBreakConfidence': 0.2,
              'monotone': false,
            },
          },
          {'word': 'name', 'accuracy': 88.2, 'errorType': 'None'},
          {'word': 'is', 'accuracy': 91.1, 'errorType': 'None'},
          {'word': 'Anna', 'accuracy': 75.7, 'errorType': 'None'},
        ],
        'feedbackVi': 'Kết quả minh họa dùng để kiểm tra giao diện.',
      },
    };
    return Map.of(value);
  }

  @override
  Future<Json> history({String? cursor}) async => {
    'items': [value],
    'nextCursor': null,
  };
}
