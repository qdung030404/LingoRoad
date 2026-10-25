import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'word_library.dart';
import 'word_collection_pages.dart';

class HomeDashboard extends StatelessWidget {
  const HomeDashboard({
    super.key,
    required this.model,
    required this.library,
    required this.onProfile,
    required this.onLesson,
    required this.onGrammar,
    required this.onWords,
    required this.onReview,
    required this.onNavigate,
  });
  final PreviewModel model;
  final WordLibrary library;
  final VoidCallback onProfile, onLesson, onGrammar, onWords, onReview;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(
        left: 0,
        right: 0,
        top: 0,
        height: 532,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(-.3, -1),
              end: Alignment(.3, 1),
              colors: [Color(0xFF1F452A), Color(0xFF53AC69), AppColors.grey25],
              stops: [.14353, .45387, .70454],
            ),
          ),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        top: 0,
        height: 532,
        child: Image.asset(
          'assets/figma/home_v2_glow_3x.png',
          fit: BoxFit.fill,
        ),
      ),
      ListView(
        key: const PageStorageKey('preview-content-0'),
        primary: false,
        padding: EdgeInsets.fromLTRB(
          8,
          (MediaQuery.paddingOf(context).top).clamp(60, double.infinity) + 16,
          8,
          120,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Semantics(
                  button: true,
                  label: 'Tài khoản',
                  child: InkWell(
                    key: const Key('previewAvatar'),
                    onTap: onProfile,
                    borderRadius: BorderRadius.circular(24),
                    child: const ClipOval(
                      child: FigmaAsset('home-v2/imgEllipse5', size: 48),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Ôn tập hôm nay',
                  onPressed: onReview,
                  icon: const FigmaAsset(
                    'home-v2/imgVuesaxBulkNotification',
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Hello, Anna!',
                    style: designHeading(36, color: Colors.white, height: 1),
                  ),
                ),
                PreviewLevelBadge(onTap: onProfile),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.grey25,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              children: [
                DashboardCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      learningHeading('Tuần này của bạn', size: 24),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          for (var i = 0; i < 7; i++) ...[
                            if (i > 0) const SizedBox(width: 6),
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.grey100),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      [
                                        'T2',
                                        'T3',
                                        'T4',
                                        'T5',
                                        'T6',
                                        'T7',
                                        'CN',
                                      ][i],
                                      style: designText(
                                        12,
                                        color: AppColors.grey800,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    PreviewCheck(
                                      checked: i >= 2 && i <= 4,
                                      size: 24,
                                      focused: i == 5,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Row(
                        children: [
                          Expanded(
                            child: WordStatistic(
                              'Từ vựng',
                              '35',
                              'imgVuesaxBulkNote2',
                            ),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: WordStatistic(
                              'Bài học',
                              '12',
                              'imgVuesaxBulkBook',
                            ),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: WordStatistic(
                              'Thời gian',
                              '2h 15p',
                              'imgVuesaxBulkTimer',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                DashboardCard(
                  child: Column(
                    children: [
                      _header('Tiếp tục học'),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading(
                              'Greetings and introductions',
                              size: 24,
                            ),
                            const SizedBox(height: 6),
                            learningBody('Chào hỏi và giới thiệu'),
                            const SizedBox(height: 12),
                            const Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                LearningPill(
                                  '10 từ',
                                  small: true,
                                  icon: FigmaAsset(
                                    'home/imgVuesaxLinearTaskSquare',
                                    size: 20,
                                  ),
                                ),
                                LearningPill(
                                  '10 phút',
                                  small: true,
                                  icon: FigmaAsset(
                                    'home/imgVuesaxLinearTimer',
                                    size: 20,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            _progress(
                              model.completed.contains('vocabulary') ? 1 : .32,
                            ),
                            const SizedBox(height: 24),
                            CustomAppButton(
                              text: 'Tiếp tục học',
                              onPressed: onLesson,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                DashboardCard(
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading('Kế hoạch hôm nay', size: 24),
                            const SizedBox(height: 10),
                            _progress(
                              model.completed.isEmpty
                                  ? .32
                                  : (model.completed.length / 3).clamp(0, 1),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: AppColors.grey100),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            for (var i = 0; i < 3; i++) ...[
                              if (i > 0)
                                const Divider(
                                  height: 24,
                                  color: AppColors.grey100,
                                ),
                              InkWell(
                                onTap: i == 0 ? onLesson : onGrammar,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    PreviewCheck(
                                      checked:
                                          i == 0 ||
                                          model.completed.contains('grammar'),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          learningHeading(
                                            [
                                              'Greetings and introductions',
                                              'Subject pronouns and verb to be',
                                              "Pronouns and the Verb 'To Be'",
                                            ][i],
                                            size: 18,
                                          ),
                                          const SizedBox(height: 4),
                                          learningBody(
                                            '${i == 0 ? 'Từ vựng' : 'Ngữ pháp'} · 10 phút',
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: SizedBox(
              width: 352,
              height: 356,
              child: DashboardCard(
                radius: 12,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Expanded(
                            child: learningHeading('Từ của tôi', size: 24),
                          ),
                          OutlinedButton(
                            onPressed: onWords,
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 32),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                              side: const BorderSide(color: AppColors.grey200),
                            ),
                            child: Text('Xem tất cả', style: designText(10)),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: AppColors.grey100),
                    Expanded(
                      child: ListView(
                        key: const PageStorageKey('home-word-decks'),
                        primary: false,
                        padding: const EdgeInsets.all(12),
                        children: [
                          for (final deck in library.decks.take(2)) ...[
                            WordDeckCard(
                              deck: deck,
                              library: library,
                              onTap: () => previewPush(
                                context,
                                WordListPage(
                                  library: library,
                                  deckId: deck.id,
                                  onNavigate: onNavigate,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ],
  );

  Widget _header(String text) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.grey100)),
    ),
    child: learningHeading(text, size: 24),
  );

  Widget _progress(double value) => Row(
    children: [
      Expanded(
        child: LinearProgressIndicator(
          value: value,
          minHeight: 6,
          borderRadius: BorderRadius.circular(64),
          color: AppColors.primary500,
          backgroundColor: AppColors.grey100,
        ),
      ),
      const SizedBox(width: 8),
      Text(
        '${(value * 100).round()}%',
        style: designText(12, color: AppColors.grey800),
      ),
    ],
  );
}

class DashboardCard extends StatelessWidget {
  const DashboardCard({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius = 24,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    padding: padding,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: AppColors.grey100),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0F0D2249),
          blurRadius: 4,
          offset: Offset(0, 1),
        ),
      ],
    ),
    child: child,
  );
}

class PreviewCheck extends StatelessWidget {
  const PreviewCheck({
    super.key,
    required this.checked,
    this.size = 20,
    this.focused = false,
  });
  final bool checked, focused;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: checked ? AppColors.primary500 : Colors.white,
      borderRadius: BorderRadius.circular(size == 24 ? 6 : 4),
      border: Border.all(
        color: checked || focused ? AppColors.primary500 : AppColors.grey200,
      ),
    ),
    child: checked
        ? Padding(
            padding: EdgeInsets.all(size * .2),
            child: const ColorFiltered(
              colorFilter: ColorFilter.mode(Colors.white, BlendMode.srcIn),
              child: FigmaAsset('reading/imgCheck', size: 12),
            ),
          )
        : null,
  );
}
