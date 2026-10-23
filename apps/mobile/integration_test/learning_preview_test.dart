import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/shared/figma_widgets.dart';
import '../test/test_helpers.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('all learning preview routes, native samples and local drafts', (
    tester,
  ) async {
    await binding.convertFlutterSurfaceToImage();
    Future<void> tap(Finder finder) async {
      FocusManager.instance.primaryFocus?.unfocus();
      await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
      await tester.pumpAndSettle();
      for (var i = 0; i < 12 && finder.evaluate().isEmpty; i++) {
        await tester.drag(find.byType(ListView).last, const Offset(0, -200));
        await tester.pumpAndSettle();
      }
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> shot(String name, {bool settle = true}) async {
      if (settle) {
        await tester.pumpAndSettle();
      } else {
        await tester.pump();
      }
      if (const bool.fromEnvironment('CAPTURE_EVIDENCE')) {
        await binding.takeScreenshot(name);
      }
      expect(tester.takeException(), isNull);
    }

    Future<void> home() async {
      for (
        var i = 0;
        i < 10 && find.byKey(const Key('previewTab0')).evaluate().isEmpty;
        i++
      ) {
        await tap(find.byTooltip('Quay lại'));
      }
      expect(find.byKey(const Key('previewTab0')), findsOneWidget);
    }

    // The signed-out fixture avoids changing the real account's secure storage.
    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    await tap(find.byKey(const Key('openLearningPreview')));
    await shot('01-home');
    await tap(find.byKey(const Key('previewTab1')));
    await shot('02-grammar-road');
    await tap(find.text('Từ vựng'));
    await shot('03-vocabulary-road');
    await tap(find.byKey(const Key('previewTab0')));
    await tap(find.text('Bắt đầu'));
    await shot('04-vocabulary-lesson');
    await tap(find.text('Bắt đầu học'));
    await shot('05-vocabulary-word');
    for (var i = 0; i < 10; i++) {
      await tap(find.byKey(const Key('previewNext')));
    }
    await shot('06-vocabulary-quiz');
    for (var i = 0; i < 5; i++) {
      await tap(find.byKey(ValueKey('previewOption${i % 4}')));
      await tap(find.byKey(const Key('previewNext')));
      await tap(find.byKey(const Key('previewNext')));
    }
    await home();
    await tap(find.byKey(const Key('previewTab1')));
    await tap(find.text('Ngữ pháp'));
    await tap(find.text("Subject pronouns and 'to be'"));
    await shot('07-grammar-lesson');
    await home();
    await tap(find.byKey(const Key('previewTab2')));
    await shot('08-practice');
    for (final skill in [PracticeSkill.listening, PracticeSkill.reading]) {
      await tap(find.text(skill.label).first);
      await tap(find.text(skill.title));
      await shot('09-${skill.source}');
      await tap(find.text('Bắt đầu'));
      await shot('10-${skill.label}-question');
      if (skill == PracticeSkill.listening) {
        await tester.tap(find.byTooltip('Nghe đoạn hội thoại'));
        await tester.pump();
        for (
          var i = 0;
          i < 80 && find.byTooltip('Tạm dừng audio mẫu').evaluate().isEmpty;
          i++
        ) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 100)),
          );
          await tester.pump();
        }
        expect(find.byTooltip('Tạm dừng audio mẫu'), findsOneWidget);
        for (var wait = 0; wait < 40; wait++) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 100)),
          );
          await tester.pump();
          if ((tester
                      .widget<LinearProgressIndicator>(
                        find.byKey(const Key('sampleAudioProgress')),
                      )
                      .value ??
                  0) >
              0) {
            break;
          }
        }
        expect(
          tester
              .widget<LinearProgressIndicator>(
                find.byKey(const Key('sampleAudioProgress')),
              )
              .value,
          greaterThan(0),
        );
        await shot('11-listening-playing', settle: false);
        await tester.tap(find.byTooltip('Tạm dừng audio mẫu'));
        await tester.pumpAndSettle();
      }
      await home();
    }
    await tap(find.text('Viết').first);
    await tap(find.text(PracticeSkill.writing.title));
    await shot('12-write-intro');
    await tap(find.text('Bắt đầu'));
    await shot('13-writing');
    await tap(find.byKey(const Key('writingHints')));
    await shot('14-writing-hints');
    await tap(find.byKey(const Key('writingHints')));
    await tap(find.text('Điền bài mẫu'));
    await tap(find.byKey(const Key('previewNext')));
    await tap(find.text('Điền bài mẫu'));
    await tap(find.byKey(const Key('previewNext')));
    await shot('15-writing-result');
    await tap(find.text('Xem chi tiết từng bài'));
    await shot('16-writing-review');
    await tap(find.byKey(const Key('previewNext')));
    expect(find.text(sampleWriting[1]), findsOneWidget);
    await home();
    await tap(find.text('Nói').first);
    await tap(find.text(PracticeSkill.speaking.title));
    await shot('17-speak-intro');
    await tap(find.text('Bắt đầu'));
    await shot('18-microphone');
    await tap(find.text('Tiếp tục với bản mẫu'));
    await shot('19-speaking');
    for (var i = 0; i < 5; i++) {
      if (i == 3) await shot('20-speaking-preparation');
      await tap(find.byKey(Key(i >= 3 ? 'previewNext' : 'previewRecord')));
      await tester.pump(const Duration(seconds: 1));
      if (i == 3) await shot('21-speaking-recording');
      await tap(find.byKey(const Key('previewRecord')));
      if (i == 0) await shot('22-speaking-recorded');
      await tap(find.byKey(const Key('previewNext')));
      if (i == 3) await shot('23-speaking-feedback');
      await tap(find.text(i == 4 ? 'Hoàn thành' : 'Câu tiếp'));
    }
    await home();
    await tap(find.byKey(const Key('previewTab3')));
    await shot('24-progress');
    await tap(find.text('Lộ trình tuần đầu tiên'));
    await shot('25-plan');
    await tap(find.text('Điều chỉnh kế hoạch'));
    await shot('26-adjust-plan');
    await tap(find.text('20 phút'));
    await tap(find.text('Lưu kế hoạch'));
    expect(find.text('20 phút/ngày'), findsOneWidget);
    await home();
    await tap(find.byKey(const Key('previewTab0')));
    await tap(
      find.byWidgetPredicate(
        (w) => w is FigmaAsset && w.asset == 'home/imgVuesaxLinearUser',
      ),
    );
    await tap(find.text('Đóng bản xem trước'));
    expect(find.byKey(const Key('openLearningPreview')), findsOneWidget);
    await tap(find.byKey(const Key('openLearningPreview')));
    await tap(find.byKey(const Key('previewTab3')));
    await tap(find.text('Lộ trình tuần đầu tiên'));
    expect(find.text('20 phút/ngày'), findsOneWidget);
    await shot('27-restored-plan');
    final restored = PreviewModel();
    await tester.runAsync(restored.restore);
    expect(restored.drafts, sampleWriting);
    expect(
      restored.completed,
      containsAll(['vocabulary', 'writing', 'speaking']),
    );
    binding.reportData = {
      ...?binding.reportData,
      'scenario': 'learning-ui-preview',
      'nativeAudioPositionVerified': true,
      'localPersistenceVerified': true,
      'completed': restored.completed.toList(),
      'minutes': restored.dailyMinutes,
    };
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
