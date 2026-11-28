import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/app_startup_timing.dart';
import '../core/theme/app_colors.dart';
import '../shared/figma_widgets.dart';
import 'auth/auth_page.dart';
import 'auth/session_controller.dart';
import 'common.dart';
import 'placement/placement_pages.dart';
import 'profile/profile_page.dart';
import 'learning/learning_preview.dart';
import 'learning/home_cache.dart';
import 'learning/learning_repository.dart';
import 'learning/learning_widgets.dart';

class DemoShell extends StatelessWidget {
  const DemoShell({super.key, required this.session});
  final SessionController session;
  @override
  Widget build(BuildContext context) {
    final cached = session.cachedHome;
    if (cached != null && session.stage == SessionStage.error) {
      AppStartupTiming.afterNextFrame('home-cached');
      final sameDate = cached['date'] == homeLearningDate();
      final totals = cached['totals'] as Map;
      final plan = sameDate ? cached['plan'] as Map? : null;
      return Scaffold(
        body: PageBody(
          children: [
            const BrandHeading(
              title: 'Trang chủ',
              description: 'Đang xem dữ liệu đã lưu',
            ),
            LearningCard(
              children: [
                learningHeading('Tiến độ học tập'),
                learningBody(
                  "${totals['completedLessonCount']} bài đã hoàn thành",
                ),
                learningBody(
                  "${(totals['activeSeconds'] as num? ?? 0) ~/ 60} phút đã ghi nhận",
                ),
              ],
            ),
            if (plan != null)
              LearningCard(
                children: [
                  learningHeading('Kế hoạch hôm nay'),
                  for (final item in learningItems(plan['items']))
                    ListTile(
                      leading: Icon(
                        item['completed'] == true
                            ? Icons.check_circle
                            : Icons.circle_outlined,
                      ),
                      title: Text(item['title'] as String),
                    ),
                ],
              ),
            if ((sameDate ? cached['continueLesson'] : null)
                case final Map lesson)
              LearningCard(
                children: [
                  learningHeading('Tiếp tục học'),
                  learningBody(lesson['title'] as String),
                ],
              ),
            ErrorNotice(
              session.error ?? 'Không thể kết nối.',
              onRetry: session.initialize,
            ),
            TextButton(
              onPressed: session.logout,
              child: const Text('Đăng xuất'),
            ),
          ],
        ),
      );
    }
    switch (session.stage) {
      case SessionStage.loading:
        return const _StartupScreen();
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

class _StartupScreen extends StatelessWidget {
  const _StartupScreen();

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: AppColors.grey0,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.grey0,
        body: SizedBox.expand(
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -.16),
                radius: .65,
                colors: [
                  AppColors.primary200,
                  AppColors.primary25,
                  AppColors.grey0,
                ],
                stops: [0, .64, 1],
              ),
            ),
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const ExcludeSemantics(
                        child: ClipOval(
                          child: SizedBox.square(
                            dimension: 80,
                            child: ColoredBox(
                              color: AppColors.grey0,
                              child: Center(
                                child: FigmaAsset('brand/logo', size: 70),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'LingoRoad',
                        style: designHeading(32, color: AppColors.primary900),
                      ),
                      const SizedBox(height: 24),
                      Semantics(
                        liveRegion: true,
                        label: 'Đang tải ứng dụng',
                        excludeSemantics: true,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (reduceMotion)
                              const Icon(
                                Icons.hourglass_empty_rounded,
                                size: 18,
                                color: AppColors.primary700,
                              )
                            else
                              const SizedBox(
                                width: 120,
                                child: LinearProgressIndicator(
                                  minHeight: 4,
                                  borderRadius: BorderRadius.all(
                                    Radius.circular(4),
                                  ),
                                  backgroundColor: AppColors.primary50,
                                  color: AppColors.primary700,
                                ),
                              ),
                            const SizedBox(height: 12),
                            Text(
                              'Đang tải…',
                              style: designText(14, color: AppColors.grey800),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
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
    final completed = session.hasCompletedPlacement;
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
