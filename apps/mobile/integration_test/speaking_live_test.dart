import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';

// Opt-in only: a person reads the on-screen instructions into the physical mic.
// Requires adb reverse tcp:13000 tcp:13000 and tcp:9099 tcp:9099.
// Dedicated local Auth Emulator identity; never initializes Firebase SDK.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const enabled = bool.fromEnvironment('LIVE_AZURE_SPEAKING');
  testWidgets(
    'physical microphone to Azure, three cases and persisted history',
    (tester) async {
      final api = ApiClient(
        config: AppConfig(apiBaseUrl: 'http://127.0.0.1:13000'),
        store: _MemoryTokens(),
      );
      final dio = Dio();
      SpeakingController? c;
      String? emulatorToken;
      var createdFixture = false;
      Future<void> waitReal(int seconds) async {
        final until = DateTime.now().add(Duration(seconds: seconds));
        while (DateTime.now().isBefore(until)) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 200)),
          );
          await tester.pump();
        }
      }

      try {
        late Json account;
        late Json before;
        await tester.runAsync(() async {
          final identity = await dio.post<Map<String, dynamic>>(
            'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
            data: {
              'email':
                  'speaking-device-${DateTime.now().microsecondsSinceEpoch}@example.com',
              'password': 'SpeakingDevice123!',
              'returnSecureToken': true,
            },
          );
          emulatorToken = identity.data!['idToken'] as String;
          api.accessToken = emulatorToken;
          account = await api.request('GET', '/auth/me');
          createdFixture = true;
          before = await api.request('GET', '/learning/progress');
          c = SpeakingController(
            repository: ApiSpeakingRepository(api),
            recorder: DeviceSpeakingRecorder(account['id'] as String),
            accountId: account['id'] as String,
            isCurrent: () => true,
          );
          await c!.initialize();
        });
        expect(c!.prompts.length, 3);
        final prompts = List<Json>.of(c!.prompts);
        for (var i = 0; i < prompts.length; i++) {
          await tester.runAsync(() => c!.select(prompts[i]));
          final instruction = switch (i) {
            0 => 'Lượt 1: đọc ĐÚNG câu mẫu bên dưới.',
            1 => 'Lượt 2: đọc câu mẫu nhưng BỎ MỘT TỪ.',
            _ => 'Lượt 3: đọc câu KHÁC: The weather is beautiful today.',
          };
          await tester.pumpWidget(
            MaterialApp(
              theme: AppTheme.lightTheme,
              home: Scaffold(
                body: Column(
                  children: [
                    SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          '$instruction\nBấm Ghi âm khi sẵn sàng. Bản thu dừng sau 10 giây.',
                          style: const TextStyle(fontSize: 18),
                        ),
                      ),
                    ),
                    Expanded(
                      child: SpeakingRecordPage(
                        key: ValueKey(i),
                        controller: c!,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
          for (var seconds = 0; seconds < 180 && !c!.recording; seconds++) {
            await waitReal(1);
          }
          expect(
            c!.recording,
            true,
            reason: 'Allow microphone permission before running the live test.',
          );
          await waitReal(10);
          await tester.runAsync(c!.stop);
          await tester.pumpAndSettle();
          final audio = c!.audioPath;
          expect(audio, isNotNull);
          expect(await File(audio!).length(), greaterThan(44));
          await tester.ensureVisible(find.text('Nghe bản thu của bạn'));
          await tester.tap(find.text('Nghe bản thu của bạn'));
          await waitReal(2);
          await tester.ensureVisible(find.text('Nộp bản thu'));
          await tester.tap(find.text('Nộp bản thu'));
          for (var attempt = 0; attempt < 75 && !c!.terminal; attempt++) {
            await waitReal(1);
          }
          expect(
            c!.status,
            'SUCCEEDED',
            reason:
                'Azure case ${i + 1}: ${c!.submission?['errorCode']} ${c!.error}',
          );
          expect(c!.result?['provider'], 'azure');
          for (final key in [
            'accuracy',
            'fluency',
            'completeness',
            'pronunciation',
          ]) {
            expect(c!.result![key], inInclusiveRange(0, 100));
          }
          expect(await File(audio).exists(), true);
        }
        final page = await tester.runAsync(
          () => c!.repository.historyForMode(mode: 'READ_ALOUD'),
        );
        final history = speakingItems(page!['items']);
        expect(history.length, 3);
        expect(history.every((row) => row['status'] == 'SUCCEEDED'), true);
        await tester.runAsync(() async {
          final after = await api.request('GET', '/learning/progress');
          expect(
            after,
            before,
            reason: 'Speaking must not alter daily progress.',
          );
        });
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.lightTheme,
            home: SpeakingHistoryPage(controller: c!),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Đã chấm'), findsNWidgets(3));
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        if (c != null) {
          await tester.runAsync(c!.discard);
          c!.dispose();
        }
        await tester.runAsync(() async {
          if (createdFixture) {
            await api.request('DELETE', '/__test/speaking-account');
          }
          if (emulatorToken != null && !createdFixture) {
            await dio.post(
              'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=fake-key',
              data: {'idToken': emulatorToken},
            );
          }
        });
      }
    },
    skip: !enabled,
  );
}

class _MemoryTokens implements TokenStore {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}
