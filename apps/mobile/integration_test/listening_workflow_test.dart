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
    debugPrint('LISTENING: completed cafe attempt with 4/5');
    final review = tester
        .widget<ListeningAudioControls>(find.byType(ListeningAudioControls))
        .controller;
    expect(identical(review, practiceAudio), false);
    expect(review.playing, false);
    expect(review.rate, 1);
    expect(review.position, Duration.zero);
    await waitFor(find.text('Bản chép lời'));
    await tap(find.text('Hiện bản dịch tiếng Việt'));
    await waitFor(
      find.text('Chào bạn. Hôm nay bạn muốn dùng gì cho bữa trưa?'),
    );
    await tester.scrollUntilVisible(
      find.text('Nghe đoạn trả lời câu 2'),
      400,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 25,
    );
    await tap(find.text('Nghe đoạn trả lời câu 2'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(seconds: 5)),
    );
    await tester.pump();
    expect(review.evidenceIds, contains('s04'));
    await review.pause();
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
    await tester.scrollUntilVisible(
      find.text('Phát toàn bài'),
      -400,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 25,
    );
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
        theme: AppTheme.lightTheme,
        home: LearningAttemptPage(owner: owner, attemptId: attemptId),
      ),
    );
    await waitFor(find.text('Kết quả bài học'));
    expect(find.text('4/5 câu đúng'), findsOneWidget);
    await tester.ensureVisible(find.text('Hiện bản dịch tiếng Việt'));
    await tester.pump();
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      false,
    );
    if (const bool.fromEnvironment('CAPTURE_EVIDENCE')) {
      debugPrint('LISTENING: converting surface for capture');
      debugPrint('LISTENING: taking review screenshot');
      await capture('listening-cafe-review');
    }
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
