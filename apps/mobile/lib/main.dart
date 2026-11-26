import 'dart:async';

import 'package:flutter/material.dart';
import 'core/api/api_client.dart';
import 'core/app_startup_timing.dart';
import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/session_controller.dart';
import 'features/demo_shell.dart';
import 'features/profile/reminder_coordinator.dart';
import 'core/auth/firebase_identity.dart';
import 'features/speaking/speaking_recorder.dart';

void main() {
  AppStartupTiming.start();
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
  WidgetsBinding.instance.addPostFrameCallback((_) {
    unawaited(prepareSpeakingTemporaryAudio());
  });
}

class MyApp extends StatefulWidget {
  const MyApp({super.key, this.session});
  final SessionController? session;
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final SessionController session =
      widget.session ??
      SessionController(
        ApiClient(
          config: AppConfig(),
          store: SecureTokenStore(),
          identity: FirebaseIdentity(),
        ),
      );
  @override
  void initState() {
    super.initState();
    session.onAccountCleared ??=
        MethodChannelReminderPlatform().cancelForAccount;
    session.initialize();
  }

  @override
  void dispose() {
    if (widget.session == null) session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'LingoRoad',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.lightTheme,
    home: ListenableBuilder(
      listenable: session,
      builder: (context, _) => DemoShell(session: session),
    ),
  );
}
