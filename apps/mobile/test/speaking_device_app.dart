// Manual, opt-in Android acceptance app. No Firebase SDK sign-in or cloud keys.
// flutter build apk --debug --target=test/speaking_device_app.dart
// adb reverse tcp:13000 tcp:13000; adb reverse tcp:9099 tcp:9099
// Requires test-only backend test/speaking-device-server.cjs and real Azure ML.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _DeviceApp());
}

class _DeviceApp extends StatefulWidget {
  const _DeviceApp();
  @override
  State<_DeviceApp> createState() => _DeviceAppState();
}

class _DeviceAppState extends State<_DeviceApp> {
  final _navigator = GlobalKey<NavigatorState>();
  late final api = ApiClient(
    config: AppConfig(apiBaseUrl: 'http://127.0.0.1:13000', environment: 'dev'),
    store: _MemoryTokens(),
  );
  SpeakingController? speaking;
  String? error;
  bool cleaned = false, cleaning = false;
  @override
  void initState() {
    super.initState();
    initialize();
  }

  Future<void> initialize() async {
    try {
      final identity = await Dio().post<Map<String, dynamic>>(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        data: {
          'email':
              'speaking-device-${DateTime.now().microsecondsSinceEpoch}@example.com',
          'password': 'SpeakingDevice123!',
          'returnSecureToken': true,
        },
      );
      api.accessToken = identity.data!['idToken'] as String;
      final account = await api.request('GET', '/auth/me');
      if (!mounted) return;
      final controller = SpeakingController(
        repository: ApiSpeakingRepository(api),
        recorder: DeviceSpeakingRecorder(account['id'] as String),
        accountId: account['id'] as String,
        isCurrent: () => mounted && !cleaned,
      );
      await controller.initialize();
      if (mounted) {
        setState(() => speaking = controller);
      } else {
        controller.dispose();
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'Chưa kết nối được máy chủ kiểm thử. Kiểm tra ADB reverse 13000 và 9099.',
        );
      }
    }
  }

  Future<void> cleanup() async {
    if (speaking == null || cleaning) return;
    setState(() => cleaning = true);
    try {
      await speaking!.discard();
      await api.request('DELETE', '/__test/speaking-account');
      if (mounted) {
        setState(() {
          cleaned = true;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'Chưa dọn được tài khoản kiểm thử. Kiểm tra kết nối và thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => cleaning = false);
    }
  }

  @override
  void dispose() {
    speaking?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    navigatorKey: _navigator,
    title: 'Speaking · kiểm thử micro thật',
    theme: AppTheme.lightTheme,
    home: Scaffold(
      appBar: AppBar(title: const Text('Kiểm thử Speaking thật')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (cleaned)
                const Text(
                  'Đã xóa tài khoản kiểm thử, bài nộp và audio tạm. Có thể đóng ứng dụng.',
                )
              else ...[
                const Text(
                  'Đọc lần lượt 3 câu bằng micro của điện thoại. Bấm Ghi âm khi sẵn sàng, đọc rồi Dừng ghi âm → Nghe lại → Nộp bản thu.',
                  style: TextStyle(fontSize: 18),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Kiểm thử thêm: ở lần luyện khác, bỏ một từ hoặc đọc câu khác. Điểm dưới đây được lingoRoad chấm từ bản thu thật; tài khoản chỉ tồn tại trong môi trường kiểm thử.',
                ),
                const SizedBox(height: 16),
                if (error != null) Text(error!),
                if (speaking == null && error == null)
                  const Center(child: CircularProgressIndicator()),
                if (speaking != null) ...[
                  OutlinedButton(
                    onPressed: () => _navigator.currentState!.push(
                      MaterialPageRoute<void>(
                        builder: (_) => PracticeIntroPage(
                          skill: PracticeSkill.speaking,
                          model: PreviewModel(),
                          speaking: speaking,
                        ),
                      ),
                    ),
                    child: const Text('Luyện Nói'),
                  ),
                  TextButton(
                    onPressed: () => _navigator.currentState!.push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            SpeakingHistoryPage(controller: speaking!),
                      ),
                    ),
                    child: const Text('Lịch sử Speaking'),
                  ),
                ],
                const SizedBox(height: 24),
                if (speaking != null)
                  OutlinedButton(
                    onPressed: cleaning ? null : cleanup,
                    child: Text(
                      cleaning
                          ? 'Đang dọn dữ liệu…'
                          : 'Kết thúc và xóa tài khoản kiểm thử',
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    ),
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
