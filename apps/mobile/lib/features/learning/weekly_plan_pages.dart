import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'lesson_pages.dart';
import 'preview_model.dart';

Widget learningSegments(
  List<String> labels,
  int selected,
  ValueChanged<int> onChange, {
  List<String>? icons,
}) => Container(
  padding: const EdgeInsets.all(4),
  decoration: BoxDecoration(
    color: AppColors.grey50,
    borderRadius: icons == null ? AppRadius.buttonRadius : AppRadius.cardSm,
  ),
  child: Row(
    children: [
      for (var i = 0; i < labels.length; i++)
        Expanded(
          child: InkWell(
            onTap: () => onChange(i),
            borderRadius: AppRadius.buttonRadius,
            child: Container(
              padding: EdgeInsets.symmetric(
                vertical: icons == null ? 11.5 : 8,
              ),
              decoration: BoxDecoration(
                color: selected == i ? Colors.white : Colors.transparent,
                borderRadius: icons == null
                    ? AppRadius.buttonRadius
                    : AppRadius.tagRadius,
                boxShadow: selected == i ? AppShadows.level1 : null,
              ),
              child: Column(
                children: [
                  if (icons != null) ...[
                    FigmaAsset('practice/${icons[i]}', size: 20),
                    const SizedBox(height: 8),
                  ],
                  Text(
                    labels[i],
                    style: designText(
                      14,
                      weight: FontWeight.w500,
                      color: selected == i
                          ? AppColors.grey900
                          : AppColors.grey800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
    ],
  ),
);

Widget learningCatalogCard(
  String title,
  String description,
  int index,
  VoidCallback onTap, {
  String source = 'practice',
}) => LearningCard(
  gap: 16,
  onTap: onTap,
  children: [
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        learningHeading(title),
        const SizedBox(height: 8),
        learningBody(description),
      ],
    ),
    Row(
      children: [
        Expanded(
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              LearningPill(
                index == 0
                    ? 'Hoàn thành'
                    : index == 1
                    ? 'Đang học'
                    : 'Chưa học',
                small: true,
                fill: index == 0
                    ? AppColors.primary25
                    : index == 1
                    ? const Color(0xFFFFF7EA)
                    : Colors.white,
                color: index == 0
                    ? const Color(0xFF1F452A)
                    : index == 1
                    ? const Color(0xFFE28A00)
                    : AppColors.grey900,
              ),
              LearningPill(
                '${index == 0
                    ? 8
                    : index == 1
                    ? 5
                    : 10} phút',
                small: true,
                icon: FigmaAsset('$source/imgVuesaxLinearTimer', size: 20),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        FigmaAsset(
          '$source/imgFrame${index == 0
              ? 74
              : index == 1
              ? 75
              : 76}',
          size: 40,
        ),
      ],
    ),
  ],
);

// Retain visited tab elements and their scroll positions while PageView prepares
// the adjacent viewport. Navigation changes rebuild only the bottom bar.
class RetainedTab extends StatefulWidget {
  const RetainedTab({super.key, required this.child});
  final Widget child;

  @override
  State<RetainedTab> createState() => _RetainedTabState();
}

class _RetainedTabState extends State<RetainedTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}

class WeeklyPlanPage extends StatelessWidget {
  const WeeklyPlanPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: model,
    builder: (context, _) => PreviewSurface(
      child: FigmaPage(
        titleStyle: designHeading(18),
        title: '',
        headerHeight: 42,
        bottom: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomAppButton(
              text: 'Bắt đầu học',
              onPressed: () =>
                  previewPush(context, VocabularyLessonPage(model: model)),
            ),
            const SizedBox(height: 16),
            CustomAppButton(
              text: 'Điều chỉnh kế hoạch',
              isSecondary: true,
              onPressed: () =>
                  previewPush(context, AdjustPlanPage(model: model)),
            ),
          ],
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          children: [
            learningHeading('Lộ trình tuần đầu tiên', size: 28),
            const SizedBox(height: 16),
            learningBody(
              'Dựa trên đánh giá và mục tiêu, chúng tôi thiết kế kế hoạch phù hợp để bạn bắt đầu.',
            ),
            const SizedBox(height: 24),
            LearningCard(
              children: [
                learningHeading('Trọng tâm tuần này'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: model.focus.map((s) => LearningPill(s)).toList(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            LearningCard(
              children: [
                learningHeading('Thời gian học mỗi ngày'),
                _planRow(
                  'plan/imgVuesaxBulkTimer',
                  '${model.dailyMinutes} phút/ngày',
                  'Bắt đầu với những phiên học ngắn, duy trì thói quen mỗi ngày.',
                ),
              ],
            ),
            const SizedBox(height: 12),
            LearningCard(
              children: [
                learningHeading('Bắt đầu ngay hôm nay'),
                _planRow(
                  'plan/imgTaskSquare',
                  'Phiên khởi động: Đọc và Nghe',
                  'Làm quen với bài tập và giúp hệ thống hiểu rõ hơn về năng lực của bạn.',
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
  Widget _planRow(String icon, String title, String subtitle) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(icon, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: designText(14, weight: FontWeight.w500)),
            const SizedBox(height: 4),
            learningBody(subtitle, size: 12),
          ],
        ),
      ),
    ],
  );
}

class AdjustPlanPage extends StatefulWidget {
  const AdjustPlanPage({super.key, required this.model});
  final PreviewModel model;
  @override
  State<AdjustPlanPage> createState() => _AdjustPlanPageState();
}

class _AdjustPlanPageState extends State<AdjustPlanPage> {
  late int minutes = widget.model.dailyMinutes;
  late Set<String> focus = Set.of(widget.model.focus);
  Future<void> save() async {
    await widget.model.savePlan(minutes, focus);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Điều chỉnh kế hoạch',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Bắt đầu học',
            onPressed: focus.isEmpty
                ? null
                : () async {
                    await widget.model.savePlan(minutes, focus);
                    if (context.mounted) {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              VocabularyLessonPage(model: widget.model),
                        ),
                      );
                    }
                  },
          ),
          const SizedBox(height: 16),
          CustomAppButton(
            text: 'Lưu kế hoạch',
            isSecondary: true,
            onPressed: focus.isEmpty ? null : save,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        children: [
          LearningCard(
            children: [
              learningHeading('Kỹ năng muốn tập trung'),
              learningBody(
                'Dựa trên đánh giá và mục tiêu, chúng tôi thiết kế kế hoạch phù hợp để bạn bắt đầu.',
                size: 14,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in ['Đọc: Ngữ pháp', 'Nghe', 'Nói', 'Viết'])
                    LearningPill(
                      s,
                      selected: focus.contains(s),
                      onTap: () => setState(
                        () =>
                            focus.contains(s) ? focus.remove(s) : focus.add(s),
                      ),
                    ),
                ],
              ),
              if (focus.isEmpty) const Text('Chọn ít nhất một kỹ năng.'),
            ],
          ),
          const SizedBox(height: 12),
          LearningCard(
            children: [
              learningHeading('Thời gian học mỗi ngày'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final n in [5, 10, 20])
                    LearningPill(
                      '$n phút',
                      selected: minutes == n,
                      onTap: () => setState(() => minutes = n),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7EA),
              border: Border.all(color: const Color(0xFFE28A00)),
              borderRadius: AppRadius.cardRadius,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FigmaAsset('adjust/imgVuesaxOutlineInfoCircle', size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lưu ý',
                        style: designText(16, color: const Color(0xFFE28A00)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Thay đổi này chỉ điều chỉnh nội dung và thời lượng học được đề xuất. Kết quả đánh giá trình độ của bạn vẫn được giữ nguyên.',
                        style: designText(14, color: const Color(0xFFE28A00)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
