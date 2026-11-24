import 'dart:typed_data';
import 'package:mobile/features/speaking/conversation_review_audio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/assessment_details.dart';
import 'package:mobile/features/speaking/conversation_assessment.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';

class _SampleAudio extends ConversationReviewAudio {
  _SampleAudio() : super(() => true);

  String? playedText;

  @override
  Future<void> playSample(String text) async => playedText = text;
}

void main() {
  test('extracts one sentence without splitting common abbreviations', () {
    expect(
      conversationSuggestionSentence(
        'I get up at 6 a.m. on weekdays. I work later.',
      ),
      'I get up at 6 a.m. on weekdays.',
    );
    expect(
      conversationSuggestionSentence('I saw Dr. Smith'),
      'I saw Dr. Smith.',
    );
  });

  testWidgets('legacy suggestions display and play only the first example', (
    tester,
  ) async {
    final audio = _SampleAudio();
    addTearDown(audio.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: ConversationAnswerAssessment(
            index: 0,
            answer: const {'answer': "I'm going dead."},
            audio: audio,
            quotedSuggestions: const [
              'Bạn có thể nói: “I find math difficult.” (Tôi thấy môn toán khó.) '
                  'hoặc “Math is challenging for me.”',
              'I struggle with math.',
            ],
          ),
        ),
      ),
    );
    expect(find.text('Câu gợi ý'), findsOneWidget);
    expect(find.text('I find math difficult.'), findsOneWidget);
    expect(find.textContaining('Math is challenging'), findsNothing);
    expect(find.textContaining('Bạn có thể nói'), findsNothing);
    await tester.tap(find.byTooltip('Nghe câu gợi ý'));
    expect(audio.playedText, 'I find math difficult.');
  });

  test(
    'word audio crosses two segments of the same turn and skips the gap',
    () {
      final wav = Uint8List.fromList(List.generate(140, (i) => i));
      final clip = conversationClip(
        wav,
        [
          {'offsetMs': 0, 'durationMs': 1},
          {'offsetMs': 2, 'durationMs': 1},
        ],
        offset: .5,
        duration: 1,
      );
      expect(clip.sublist(44), [
        ...wav.sublist(60, 76),
        ...wav.sublist(108, 124),
      ]);
      expect(ByteData.sublistView(clip).getUint32(40, Endian.little), 32);
    },
  );
  testWidgets(
    'segmented answer exposes word details directly without per-answer score summary',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: ConversationAnswerAssessment(
                index: 0,
                answer: {
                  'question': 'What is your name?',
                  'answer': 'Anna.',
                  'pronunciation': {
                    'mode': 'TOPIC',
                    'assessmentConfig': {'phonemeAlphabet': 'IPA'},
                    'transcript': 'Anna.',
                    'words': [
                      {
                        'word': 'Anna',
                        'accuracy': 55.5,
                        'errorType': 'Mispronunciation',
                        'offsetMs': 2590,
                        'durationMs': 420,
                        'prosody': {'monotone': true},
                        'phonemes': [
                          {
                            'phoneme': 'eɪ',
                            'accuracy': 42,
                            'offsetMs': 2590,
                            'durationMs': 200,
                          },
                          {'phoneme': 'n'},
                        ],
                        'syllables': [
                          {
                            'syllable': 'æn',
                            'accuracy': 65,
                            'offsetMs': 2590,
                            'durationMs': 420,
                          },
                        ],
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
      expect(find.byKey(const Key('speaking-summary')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('speaking-reference-0')));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Đóng chi tiết'), findsOneWidget);
      expect(find.text('Phát âm sai'), findsOneWidget);
      expect(find.text('55.5'), findsOneWidget);
      final learnerButton = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, 'Giọng của bạn'),
      );
      expect(learnerButton.onPressed, isNull);
      expect(
        find.text('Phiên này không còn bản thu để nghe lại.'),
        findsOneWidget,
      );
      expect(find.text('Âm tiết & âm vị'), findsOneWidget);
      expect(find.text('Âm vị'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('65'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
      expect(find.text('2.59 – 3.01 giây'), findsOneWidget);
      expect(find.text('Giọng đều'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('/eɪ/')).dx,
        greaterThan(tester.getTopLeft(find.text('/æn/')).dx),
      );
      expect(
        tester.getTopLeft(find.text('/n/')).dx,
        tester.getTopLeft(find.text('/æn/')).dx,
      );
      for (final label in ['/eɪ/', '/æn/', '/n/']) {
        final paragraph = tester.renderObject<RenderParagraph>(
          find.text(label),
        );
        final openingSlash = paragraph
            .getBoxesForSelection(
              const TextSelection(baseOffset: 0, extentOffset: 1),
            )
            .single;
        final closingSlash = paragraph
            .getBoxesForSelection(
              TextSelection(
                baseOffset: label.length - 1,
                extentOffset: label.length,
              ),
            )
            .single;
        expect(closingSlash.top, openingSlash.top, reason: label);
        expect(
          closingSlash.left,
          greaterThan(openingSlash.left),
          reason: label,
        );
      }
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('word replay uses the selected word timings', (tester) async {
    (num, num)? interval;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: SpeakingAssessment(
            result: const {
              'mode': 'TOPIC',
              'transcript': 'Good morning.',
              'words': [
                {'word': 'Good', 'offsetMs': 200, 'durationMs': 120},
                {'word': 'morning', 'offsetMs': 380, 'durationMs': 290},
              ],
            },
            detailsOnly: true,
            inlineDetails: true,
            onSample: (_) async {},
            onWordAudio: (start, length) async => interval = (start, length),
          ),
        ),
      ),
    );
    await tester.tap(find.byKey(const ValueKey('speaking-reference-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Giọng của bạn'));
    expect(interval, (380, 290));
  });
}
