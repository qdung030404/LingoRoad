import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_pages.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/listening_audio.dart';
import 'package:mobile/features/learning/practice_widgets.dart';
import 'package:mobile/shared/app_button.dart';

// Local Auth Emulator only; never touches the developer's Firebase SDK account.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native cafe practice, stable audio, segmented review and history', (
    tester,
  ) async {
    const emulator = String.fromEnvironment('LEARNING_TEST_EMULATOR');
    expect(
      emulator,
      isNotEmpty,
      reason: 'Requires an isolated local Auth Emulator.',
    );
    final api = ApiClient(config: AppConfig(), store: _MemoryTokens());
    late LearningController owner;
    late DailyLearningController daily;
    late Json lesson;
    await tester.runAsync(() async {
      final identity = await Dio().post<Map<String, dynamic>>(
        'http://$emulator/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        data: {
          'email':
              'listening-${DateTime.now().millisecondsSinceEpoch}@example.com',
          'password': 'ListeningDevice123!',
          'returnSecureToken': true,
        },
      );
      api.accessToken = identity.data!['idToken'] as String;
      final user = await api.request('GET', '/auth/me');
      daily = DailyLearningController(
        repository: ApiDailyRepository(api),
        accountId: user['id'] as String,
        isCurrent: () => true,
      );
      owner = LearningController(
        repository: ApiLearningRepository(api),
        accountId: user['id'] as String,
        daily: daily,
      );
      await owner.refresh();
      lesson = owner.lessons
          .firstWhere((l) => l.json['code'] == 'listening-campus-cafe')
          .json;
    });
    Future<void> waitFor(Finder finder) async {
      for (var i = 0; i < 160 && finder.evaluate().isEmpty; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
      }
      expect(finder, findsWidgets);
    }

    Future<void> tap(Finder finder) async {
      await waitFor(finder);
      await tester.ensureVisible(finder.first);
      await tester.pump();
      await tester.tap(finder.first);
      await tester.pump();
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 300)),
      );
      await tester.pump();
    }

    Future<void> settleNetwork() async {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 800)),
      );
      await tester.pump();
    }

    var surfaceConverted = false;
    Future<void> capture(String name) async {
      if (!const bool.fromEnvironment('CAPTURE_EVIDENCE')) return;
      if (!surfaceConverted) {
        await binding.convertFlutterSurfaceToImage();
        surfaceConverted = true;
      }
      await tester.pumpAndSettle();
      await binding.takeScreenshot(name);
    }

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: SingleChildScrollView(
            child: LearningCatalogue(
              controller: owner,
              kinds: const ['LISTENING'],
            ),
          ),
        ),
      ),
    );
    await tap(find.byKey(ValueKey('learning-lesson-${lesson['id']}')));
    await waitFor(find.text('Chuẩn bị nghe'));
    await capture('listening-preparation');
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    debugPrint('LISTENING: opened native cafe practice');
    expect(find.text('Bản chép lời'), findsNothing);
    await tap(find.byTooltip('Phát audio'));
    await waitFor(find.byTooltip('Tạm dừng'));
    await settleNetwork();
    final controls = tester.widget<ListeningAudioControls>(
      find.byType(ListeningAudioControls),
    );
    final practiceAudio = controls.controller;
    expect(practiceAudio.loaded, true);
    expect(practiceAudio.duration.inSeconds, greaterThan(30));
    await tap(find.byTooltip('Tiến 5 giây'));
    await tap(find.byKey(const Key('listeningSpeed')));
    await tap(find.text('0.75×'));
    final before = practiceAudio.position;
    for (var i = 0; i < 5; i++) {
      // q01 deliberately wrong; remaining four correct => 4/5.
      final answer = ['A', 'B', 'C', 'A', 'D'][i];
      await tap(find.byKey(ValueKey('learning-option-$answer')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text(i == 4 ? 'Nộp bài' : 'Tiếp theo'));
      if (i == 0) {
        expect(find.text('Bản chép lời'), findsNothing);
        expect(
          identical(
            tester
                .widget<ListeningAudioControls>(
                  find.byType(ListeningAudioControls),
                )
                .controller,
            practiceAudio,
          ),
          true,
        );
        expect(practiceAudio.position, greaterThanOrEqualTo(before));
        expect(practiceAudio.rate, .75);
        await tap(find.byTooltip('Tạm dừng'));
      }
      await tap(find.byKey(const Key('learningPrimaryAction')));
      if (i < 4) await waitFor(find.text('Câu ${i + 2}/5'));
      if (i == 0) {
        await tester.ensureVisible(find.byType(ListeningAudioControls));
        await tester.pump();
        await capture('listening-practice-compact');
      }
    }
    await waitFor(find.text('Kết quả bài học'));
    expect(find.text('4/5 câu đúng'), findsOneWidget);
    final resultActions = tester.widgetList<CustomAppButton>(
      find.byType(CustomAppButton),
    );
    expect(resultActions.where((button) => button.isSecondary), hasLength(2));
    await capture('listening-result-actions');
    debugPrint('LISTENING: completed cafe attempt with 4/5');
    await tap(find.text('Xem lại đáp án'));
    await waitFor(find.text('Xem lại câu 1/5'));
    final review = tester
        .widget<PracticeReviewPage>(find.byType(PracticeReviewPage))
        .audio!;
    expect(identical(review, practiceAudio), false);
    expect(review.playing, false);
    expect(review.rate, 1);
    expect(review.position, Duration.zero);
    await tap(find.text('Câu tiếp theo'));
    await waitFor(find.text('Xem lại câu 2/5'));
    await tap(find.text('Nghe đoạn trả lời câu 2'));
    expect(review.evidenceIds, contains('s04'));
    await tap(find.text('Câu sai (1)'));
    expect(find.text('Xem lại câu 1/5'), findsOneWidget);
    expect(find.text('Bạn chọn'), findsOneWidget);
    expect(find.text('Đáp án đúng'), findsOneWidget);
    expect(find.text('Câu tiếp theo'), findsNothing);
    expect(find.text('Về kết quả'), findsOneWidget);
    expect(review.evidenceIds, isEmpty);
    expect(review.playing, false);
    await capture('listening-cafe-review');
    await tester.scrollUntilVisible(
      find.text('Bản chép lời'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    await tap(find.text('Bản chép lời'));
    await waitFor(find.text('Hiện bản dịch tiếng Việt'));
    await tap(find.text('Hiện bản dịch tiếng Việt'));
    expect(
      find.text('Chào bạn. Hôm nay bạn muốn dùng gì cho bữa trưa?'),
      findsOneWidget,
    );
    final play = find.text('Phát toàn bài');
    final playPosition = tester.getTopLeft(play);
    final messages = find.byKey(const Key('listeningTranscriptMessages'));
    await tester.drag(messages, const Offset(0, -420));
    await tester.pumpAndSettle();
    expect(
      tester.widget<ListView>(messages).controller!.offset,
      greaterThan(0),
    );
    expect(tester.getTopLeft(play), playPosition);
    await capture('listening-transcript-scroll');
    late int seconds;
    late String attemptId;
    await tester.runAsync(() async {
      final history = await api.request('GET', '/learning/history');
      final item = (history['items'] as List).first as Map;
      attemptId = item['id'] as String;
      expect((item['result'] as Map)['correctCount'], 4);
      seconds =
          ((await api.request('GET', '/learning/progress'))['today']
                  as Map)['activeSeconds']
              as int;
    });
    await tap(find.text('Phát toàn bài'));
    await settleNetwork();
    await review.pause();
    await tester.runAsync(() async {
      final now =
          ((await api.request('GET', '/learning/progress'))['today']
                  as Map)['activeSeconds']
              as int;
      expect(now, seconds, reason: 'Review must not grant practice time.');
    });
    debugPrint(
      'LISTENING: verified segmented review and unchanged time credit',
    );
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: LearningHistoryPage(controller: owner),
      ),
    );
    await tap(find.byKey(ValueKey('learning-history-$attemptId')));
    await waitFor(find.text('Kết quả bài học'));
    expect(find.text('4/5 câu đúng'), findsOneWidget);
    await tap(find.text('Xem lại đáp án'));
    await waitFor(find.text('Xem lại câu 1/5'));
    await tester.scrollUntilVisible(
      find.text('Bản chép lời'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    await tap(find.text('Bản chép lời'));
    await waitFor(find.text('Hiện bản dịch tiếng Việt'));
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      false,
    );
    debugPrint('LISTENING: reopened history; translation remains opt-in');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    owner.dispose();
    daily.dispose();
    debugPrint('LISTENING: native workflow finished');
  });
}

class _MemoryTokens implements TokenStore {
  String? token;
  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String value) async {
    token = value;
  }

  @override
  Future<void> clear() async {
    token = null;
  }
}
