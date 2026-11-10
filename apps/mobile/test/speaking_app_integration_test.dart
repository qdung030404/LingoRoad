import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';

class SpeakingAppApi extends FakeApi {
  SpeakingAppApi() : super(signedIn: true, completed: true);
  int promptLoads = 0;
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
  }) async {
    if (path == '/speaking/prompts') {
      promptLoads++;
      return {
        'enabled': true,
        'items': [
          {'id': 'prompt-1', 'text': 'My name is Anna', 'contentVersion': 1},
        ],
      };
    }
    return super.request(method, path, data: data, auth: auth);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'signed-in app keeps original Speaking intro and permission flow',
    (tester) async {
      final api = SpeakingAppApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();
      expect(find.byType(SpeakingCatalogue), findsNothing);
      expect(find.text('Chặng 1'), findsWidgets);
      await tester.tap(find.text(PracticeSkill.speaking.title).first);
      await tester.pumpAndSettle();
      expect(find.byType(PracticeIntroPage), findsOneWidget);
      await tester.tap(find.text('Bắt đầu'));
      await tester.pumpAndSettle();
      expect(api.promptLoads, greaterThanOrEqualTo(1));
      expect(find.text('Luyện đọc'), findsOneWidget);
      final readingButton = find.byKey(const ValueKey('speaking-mode-READ_ALOUD'));
      await tester.ensureVisible(readingButton);
      await tester.tap(readingButton);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bắt đầu luyện').first);
      await tester.pumpAndSettle();
      expect(find.byType(MicrophonePreviewPage), findsOneWidget);
      expect(find.text('Tiếp tục với bản mẫu'), findsNothing);
      expect(find.text('Dữ liệu mẫu'), findsNothing);
    },
  );

  testWidgets(
    'guest Speaking offers sign-in and returns to normal auth sheet',
    (tester) async {
      final api = FakeApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('openLearningPreview')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();
      final signIn = find.byKey(const Key('speakingSignIn'));
      await tester.ensureVisible(signIn);
      await tester.tap(signIn);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('authSheet')), findsOneWidget);
      expect(find.byType(SpeakingCatalogue), findsNothing);
      expect(
        api.requestedPaths.where((p) => p.startsWith('/speaking/')),
        isEmpty,
      );
    },
  );
}
