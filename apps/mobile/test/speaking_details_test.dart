import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/assessment_details.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';
import 'package:mobile/features/speaking/speaking_result_audio.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'weighted overall is identified and component scores stay provider values',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: SpeakingAssessment(
                result: {
                  'overall': 77.325,
                  'pronunciation': 73.6,
                  'accuracy': 88,
                  'fluency': 77,
                  'prosody': 51.5,
                  'completeness': 100,
                  'scoringPolicy': {
                    'version': 'lingoroad-weighted-v1',
                    'weights': {
                      'accuracy': 40,
                      'fluency': 25,
                      'prosody': 25,
                      'completeness': 10,
                    },
                  },
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('77.3'), findsOneWidget);
      expect(find.text('73.6'), findsNothing);
      expect(find.text('88.0'), findsOneWidget);
      expect(find.text('51.5'), findsOneWidget);
      await tester.tap(find.byKey(const Key('speakingScorePolicy')));
      await tester.pumpAndSettle();
      expect(find.text('40%'), findsOneWidget);
      expect(find.text('25%'), findsNWidgets(2));
      expect(find.text('10%'), findsOneWidget);
    },
  );
  test('prosody availability is checked for each individual category', () {
    final limited = [
      {
        'prosody': {
          'monotone': false,
          'unexpectedBreakConfidence': null,
          'missingBreakConfidence': null,
        },
      },
    ];
    expect(speakingIssueAvailable(limited, 'Monotone'), isTrue);
    expect(speakingIssueAvailable(limited, 'UnexpectedBreak'), isFalse);
    expect(speakingIssueAvailable(limited, 'MissingBreak'), isFalse);
  });
  test('legacy shared cache cleanup preserves other features files', () async {
    final root = await Directory.systemTemp.createTemp('speaking-share-cache-');
    addTearDown(() => root.delete(recursive: true));
    final shared = await Directory('${root.path}/share_plus').create();
    final own = await File(
      '${shared.path}/lingoroad-speaking-test.wav',
    ).writeAsString('own');
    final other = await File('${shared.path}/other.wav').writeAsString('other');
    await cleanSharedSpeakingAudio(temporaryDirectory: root);
    expect(await own.exists(), isFalse);
    expect(await other.exists(), isTrue);
  });
  testWidgets('background cancels a segment awaiting native stop', (
    tester,
  ) async {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    for (final name in [
      'xyz.luan/audioplayers.global',
      'xyz.luan/audioplayers.global/events',
    ]) {
      messenger.setMockMethodCallHandler(
        MethodChannel(name),
        (_) async => null,
      );
    }
    final stop = Completer<void>();
    final calls = <String>[];
    messenger.setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers'),
      (call) async {
        calls.add(call.method);
        if (call.method == 'create') {
          final id = (call.arguments as Map)['playerId'];
          messenger.setMockMethodCallHandler(
            MethodChannel('xyz.luan/audioplayers/events/$id'),
            (_) async => null,
          );
        }
        if (call.method == 'stop') await stop.future;
        return null;
      },
    );
    final key = GlobalKey<SpeakingResultAudioState>();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SpeakingResultAudio(key: key, path: 'unused.wav'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final playing = key.currentState!.playSegment(100, 300);
    await tester.pump();
    expect(calls, contains('stop'));
    key.currentState!.didChangeAppLifecycleState(AppLifecycleState.inactive);
    stop.complete();
    await playing;
    await tester.pumpAndSettle();
    expect(calls, isNot(contains('setSourceUrl')));
    expect(calls, isNot(contains('resume')));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  test(
    'alignment preserves punctuation and distinct repeated word positions',
    () {
      final words = [
        {'word': 'Hello', 'errorType': 'None'},
        {'word': 'hello', 'errorType': 'Insertion'},
        {'word': 'hello', 'errorType': 'Mispronunciation'},
        {'word': 'world', 'errorType': 'Omission'},
      ];
      final tokens = assessmentReferenceTokens('Hello, hello world!', words);
      expect(
        tokens
            .where((token) => token.wordIndex != 1)
            .map((token) => token.text)
            .join(),
        'Hello, hello world!',
      );
      expect(
        tokens
            .where((token) => token.wordIndex != null)
            .map((token) => token.wordIndex),
        [0, 1, 2, 3],
      );
      expect(assessmentScoreText(40.26), '40.3');
      expect(assessmentScoreText(null), 'Chưa có dữ liệu');
      expect(
        speakingWordIssues({
          'prosody': {
            'unexpectedBreakConfidence': .75,
            'missingBreakConfidence': .7501,
            'monotone': true,
          },
        }),
        {'MissingBreak', 'Monotone'},
      );
    },
  );

  testWidgets(
    'v2 filters, word details and partial result fit a narrow screen',
    (tester) async {
      tester.view.physicalSize = const Size(320, 1700);
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
                  'schemaVersion': 2,
                  'assessmentConfig': {'phonemeAlphabet': 'IPA'},
                  'assessmentCompleteness': 'partial',
                  'pronunciation': 51.34,
                  'accuracy': 45.27,
                  'fluency': 65.5,
                  'completeness': 60.1,
                  'prosody': null,
                  'referenceText': 'Hello, hello!',
                  'transcript': 'Hello hello.',
                  'words': [
                    {
                      'word': 'Hello',
                      'accuracy': 90.33,
                      'errorType': 'None',
                      'prosody': {
                        'unexpectedBreakConfidence': .8,
                        'missingBreakConfidence': 0,
                        'monotone': true,
                      },
                      'phonemes': [
                        {'phoneme': 'ɪ', 'accuracy': 51.34},
                      ],
                      'syllables': [],
                    },
                    {
                      'word': 'hello',
                      'accuracy': 30.27,
                      'errorType': 'Mispronunciation',
                      'prosody': {
                        'unexpectedBreakConfidence': .75,
                        'missingBreakConfidence': .9,
                        'monotone': true,
                      },
                    },
                  ],
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('51.3'), findsOneWidget);
      expect(find.text('Đánh giá chưa đầy đủ'), findsOneWidget);
      expect(find.text('Điểm từng từ'), findsNothing);
      expect(find.text('Chúng tôi nghe được'), findsNothing);
      expect(find.byKey(const Key('speakingTranscript')), findsNothing);
      final filters = find.byKey(const Key('speakingFilters'));
      await tester.ensureVisible(filters);
      await tester.tap(filters);
      await tester.pumpAndSettle();
      expect(find.text('Giọng đều · 1'), findsOneWidget);
      expect(find.text('Ngắt nghỉ sai · 1'), findsOneWidget);
      final filter = find.byKey(
        const ValueKey('speaking-filter-Mispronunciation'),
      );
      await tester.ensureVisible(filter);
      await tester.tap(filter);
      await tester.pumpAndSettle();
      expect(tester.widget<FilterChip>(filter).selected, isFalse);
      final word = find.byKey(const ValueKey('speaking-reference-0'));
      await tester.ensureVisible(word);
      await tester.tap(word);
      await tester.pumpAndSettle();
      expect(find.text('Âm vị'), findsOneWidget);
      expect(find.text('/ɪ/'), findsOneWidget);
      expect(find.text('Phiên âm IPA · Anh-Mỹ'), findsOneWidget);
      expect(find.text('Âm tiết'), findsOneWidget);
      expect(find.text('Nghe đoạn của từ'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('stored SAPI units keep their original alphabet label', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: SingleChildScrollView(
            child: SpeakingAssessment(
              result: {
                'referenceText': 'lived',
                'words': [
                  {
                    'word': 'lived',
                    'accuracy': 55,
                    'errorType': 'Mispronunciation',
                    'syllables': [
                      {'syllable': 'lihvd', 'accuracy': 40},
                    ],
                    'phonemes': [
                      {'phoneme': 'ih', 'accuracy': 15},
                    ],
                  },
                ],
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final word = find.byKey(const Key('speaking-reference-0'));
    await tester.ensureVisible(word);
    await tester.pumpAndSettle();
    await tester.tap(word);
    await tester.pumpAndSettle();
    expect(find.text('Ký hiệu phiên âm cũ (SAPI)'), findsOneWidget);
    expect(find.text('lihvd'), findsOneWidget);
    expect(find.text('ih'), findsOneWidget);
    expect(find.text('Phiên âm IPA · Anh-Mỹ'), findsNothing);
  });

  testWidgets('result player is compact and exposes playback only', (
    tester,
  ) async {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    for (final name in [
      'xyz.luan/audioplayers.global',
      'xyz.luan/audioplayers.global/events',
    ]) {
      messenger.setMockMethodCallHandler(
        MethodChannel(name),
        (_) async => null,
      );
    }
    messenger.setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers'),
      (call) async {
        if (call.method == 'create') {
          final id = (call.arguments as Map)['playerId'];
          messenger.setMockMethodCallHandler(
            MethodChannel('xyz.luan/audioplayers/events/$id'),
            (_) async => null,
          );
        }
        return null;
      },
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const Scaffold(
          body: SpeakingResultAudio(path: 'unused.wav', durationSeconds: 4),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Nghe lại bản thu'), findsOneWidget);
    expect(find.byKey(const Key('speakingResultPlayback')), findsOneWidget);
    expect(find.textContaining('Xuất'), findsNothing);
    expect(
      tester.getSize(find.byType(SpeakingResultAudio)).height,
      lessThan(150),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
