import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'speaking_workflow_test.dart' show FakeRecorder, FakeSpeakingRepository;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'real speaking retains original introduction and microphone layout',
    (tester) async {
      final controller = SpeakingController(
        repository: FakeSpeakingRepository(),
        recorder: FakeRecorder('unused'),
        accountId: 'legacy-ui',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: PracticeIntroPage(
            skill: PracticeSkill.speaking,
            model: PreviewModel(),
            speaking: controller,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bài tập'), findsOneWidget);
      expect(find.text('Bốn chế độ luyện nói'), findsOneWidget);
      expect(find.byTooltip('Lịch sử Speaking'), findsOneWidget);
      await tester.tap(find.text('Bắt đầu'));
      await tester.pumpAndSettle();
      expect(find.text('Luyện đọc'), findsOneWidget);
      final readingButton = find.byKey(const ValueKey('speaking-mode-READ_ALOUD'));
      await tester.ensureVisible(readingButton);
      await tester.pumpAndSettle();
      await tester.tap(readingButton);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bắt đầu luyện').first);
      await tester.pumpAndSettle();
      expect(find.byType(MicrophonePreviewPage), findsOneWidget);
      expect(find.text('Cho phép dùng micro\nđể luyện nói'), findsOneWidget);
      expect(find.text('Cho phép dùng micro'), findsOneWidget);
      expect(find.text('Không tiện nói lúc này'), findsOneWidget);
      expect(find.text('Tiếp tục với bản mẫu'), findsNothing);
      expect(find.text('Dữ liệu mẫu'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('guest microphone keeps original preview presentation', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: MicrophonePreviewPage(model: PreviewModel()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Dữ liệu mẫu'), findsOneWidget);
    expect(find.text('Tiếp tục với bản mẫu'), findsOneWidget);
    expect(find.text('Cho phép dùng micro\nđể luyện nói'), findsOneWidget);
    expect(
      find.text(
        'Bản xem trước dùng bản thu mẫu. Micro của thiết bị không được sử dụng.',
      ),
      findsOneWidget,
    );
  });
}
