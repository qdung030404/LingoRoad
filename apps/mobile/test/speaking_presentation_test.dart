import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/recording_waveform.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';

void main() {
  testWidgets(
    'waveform follows microphone samples and resets on stream change',
    (tester) async {
      final samples = StreamController<double>(sync: true);
      final replacement = StreamController<double>(sync: true);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        await samples.close();
        await replacement.close();
      });

      Widget view(Stream<double> amplitudes) => MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Scaffold(body: RecordingWaveform(amplitudes: amplitudes)),
        ),
      );
      double barHeight(int index) => tester
          .widget<AnimatedContainer>(
            find.byKey(ValueKey('amplitude-bar-$index')),
          )
          .constraints!
          .maxHeight;

      await tester.pumpWidget(view(samples.stream));
      expect(barHeight(31), 4);
      samples.add(-30);
      await tester.pump();
      expect(barHeight(31), 30);
      samples.add(-60);
      await tester.pump();
      expect(barHeight(30), 30);
      expect(barHeight(31), 4);
      expect(
        tester
            .widget<AnimatedContainer>(
              find.byKey(const ValueKey('amplitude-bar-31')),
            )
            .duration,
        Duration.zero,
      );
      await tester.pumpWidget(view(replacement.stream));
      expect(samples.hasListener, isFalse);
      expect(barHeight(30), 4);
      replacement.add(0);
      await tester.pump();
      expect(barHeight(31), 56);
      replacement.add(double.nan);
      await tester.pump();
      expect(barHeight(31), 4);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(replacement.hasListener, isFalse);
    },
  );

  for (final width in [320.0, 393.0]) {
    for (final scale in [1.0, 1.5]) {
      testWidgets(
        'assessment fits ${width}px with text scale $scale and missing score',
        (tester) async {
          tester.view.physicalSize = Size(width, 1600);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await tester.pumpWidget(
            MaterialApp(
              theme: AppTheme.lightTheme,
              home: MediaQuery(
                data: MediaQueryData(textScaler: TextScaler.linear(scale)),
                child: Scaffold(
                  body: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: SpeakingAssessment(
                      result: {
                        'pronunciation': 80,
                        'accuracy': 76,
                        'fluency': null,
                        'completeness': 83,
                        'transcript': 'I am a student from Hanoi.',
                        'feedbackVi': 'Từ cần luyện theo Azure: student.',
                        'words': [
                          {
                            'word': 'student',
                            'accuracy': 39,
                            'errorType': 'Mispronunciation',
                          },
                          {
                            'word': 'a',
                            'accuracy': null,
                            'errorType': 'Omission',
                          },
                          {
                            'word': 'hanoi',
                            'accuracy': 69,
                            'errorType': 'None',
                          },
                          {
                            'word':
                                'anextremelylongwordthatmustwrapwithinthecard',
                            'accuracy': 95,
                            'errorType': 'None',
                          },
                        ],
                      },
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(find.text('Kết quả phát âm'), findsOneWidget);
          expect(find.text('2 từ cần luyện'), findsOneWidget);
          for (final criterion in [
            'accuracy',
            'fluency',
            'completeness',
            'prosody',
          ]) {
            final row = find.byKey(ValueKey('speaking-score-$criterion'));
            final bar = find.byKey(ValueKey('speaking-score-bar-$criterion'));
            expect(
              tester.getSize(bar).width,
              closeTo(tester.getSize(row).width, .1),
            );
            expect(tester.getSize(bar).height, 6);
            final value = find.byKey(
              ValueKey('speaking-score-value-$criterion'),
            );
            expect(
              tester.getRect(value).right,
              closeTo(tester.getRect(bar).right, .1),
            );
          }
          final summary = tester.getRect(
            find.byKey(const Key('speaking-summary')),
          );
          final circle = tester.getRect(
            find.byKey(const Key('speaking-summary-circle')),
          );
          expect(summary.right - circle.right, closeTo(16, .1));
          expect(
            tester.getRect(find.text('Kết quả phát âm')).left - summary.left,
            closeTo(16, .1),
          );
          expect(find.text('Chưa có dữ liệu'), findsNWidgets(2));
          expect(find.text('Bỏ sót'), findsNWidgets(2));
          final transcript = find.byKey(const Key('speakingTranscript'));
          await tester.ensureVisible(transcript);
          await tester.tap(transcript);
          await tester.pumpAndSettle();
          expect(find.text('I am a student from Hanoi.'), findsOneWidget);
          expect(
            find.text('Từ cần luyện theo lingoRoad: student.'),
            findsOneWidget,
          );
          expect(find.textContaining('Azure'), findsNothing);
          if (width == 393 && scale == 1) {
            expect(
              tester
                  .getSize(
                    find.byKey(const ValueKey('speaking-score-accuracy')),
                  )
                  .height,
              tester
                  .getSize(
                    find.byKey(const ValueKey('speaking-score-completeness')),
                  )
                  .height,
            );
          }
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
