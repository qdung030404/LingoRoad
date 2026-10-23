import 'package:flutter/material.dart';
import 'auth/auth_page.dart';
import 'auth/session_controller.dart';
import 'common.dart';
import 'placement/placement_pages.dart';
import 'profile/profile_page.dart';

class DemoShell extends StatelessWidget {
  const DemoShell({super.key, required this.session});
  final SessionController session;
  @override
  Widget build(BuildContext context) {
    switch (session.stage) {
      case SessionStage.loading:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case SessionStage.signedOut:
        return AuthPage(session: session);
      case SessionStage.onboarding:
        return ProfilePage(session: session, onboarding: true);
      case SessionStage.error:
        return Scaffold(
          body: PageBody(
            children: [
              const BrandHeading(
                title: 'Kết nối lại',
                description: 'Phiên đăng nhập vẫn được giữ trên thiết bị.',
              ),
              ErrorNotice(
                session.error ?? 'Không tải được dữ liệu.',
                onRetry: session.initialize,
              ),
            ],
          ),
        );
      case SessionStage.ready:
        return _AccountNavigator(session: session);
    }
  }
}

class _AccountNavigator extends StatefulWidget {
  const _AccountNavigator({required this.session});
  final SessionController session;
  @override
  State<_AccountNavigator> createState() => _AccountNavigatorState();
}

class _AccountNavigatorState extends State<_AccountNavigator> {
  final navigatorKey = GlobalKey<NavigatorState>();
  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    return NavigatorPopHandler<void>(
      onPopWithResult: (_) => navigatorKey.currentState!.pop(),
      child: Navigator(
        key: navigatorKey,
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          builder: (_) => session.placement['status'] == 'COMPLETED'
              ? ResultPage(
                  session: session,
                  sessionId: session.placement['currentSessionId'] as String,
                )
              : PlacementHome(session: session),
        ),
      ),
    );
  }
}
