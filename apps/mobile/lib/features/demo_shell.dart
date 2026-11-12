import 'package:flutter/material.dart';
import '../shared/figma_widgets.dart';
import 'auth/auth_page.dart';
import 'auth/session_controller.dart';
import 'common.dart';
import 'placement/placement_pages.dart';
import 'profile/profile_page.dart';
import 'learning/learning_preview.dart';

class DemoShell extends StatelessWidget {
  const DemoShell({super.key, required this.session});
  final SessionController session;
  @override
  Widget build(BuildContext context) {
    switch (session.stage) {
      case SessionStage.loading:
        return Scaffold(
          backgroundColor: Colors.white,
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(
                  label: 'Logo LingoRoad',
                  image: true,
                  child: const FigmaAsset('brand/logo', size: 96),
                ),
                const SizedBox(height: 20),
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ],
            ),
          ),
        );
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
              TextButton(
                onPressed: session.logout,
                child: const Text('Đăng xuất'),
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
    final completed = session.placement['status'] == 'COMPLETED';
    return NavigatorPopHandler<void>(
      onPopWithResult: (_) => navigatorKey.currentState?.maybePop(),
      child: Navigator(
        key: navigatorKey,
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          settings: RouteSettings(
            name: completed ? LearningPreview.routeName : 'placement-home',
          ),
          builder: (_) => completed
              ? LearningPreview(
                  key: ValueKey(session.user?['id']),
                  account: session,
                  onLogout: session.logout,
                )
              : PlacementHome(session: session),
        ),
      ),
    );
  }
}
