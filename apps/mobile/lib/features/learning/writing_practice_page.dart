import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'writing_evaluation_service.dart';
import 'writing_review_page.dart';
import 'writing_task_page.dart';
export 'writing_review_page.dart';
export 'writing_preview_page.dart';
export 'writing_task_page.dart';

Widget _writingFlag(BuildContext context) => IconButton(
  tooltip: 'Báo vấn đề',
  onPressed: () => previewMessage(
    context,
    'Đây là bài mẫu. Báo cáo chưa được gửi lên máy chủ.',
  ),
  icon: const FigmaAsset('speaking/imgVuesaxLinearFlag'),
);

/// Component: Danh sách Đề bài Luyện Viết từ Ngân hàng Đề thi Database (Single-Task Selection)
/// Dùng được cả ở trang độc lập lẫn nhúng trực tiếp trong Tab Luyện tập
class WritingPracticeSection extends StatefulWidget {
  const WritingPracticeSection({
    super.key,
    required this.model,
    this.evaluationService,
  });

  final PreviewModel model;
  final WritingEvaluationService? evaluationService;

  @override
  State<WritingPracticeSection> createState() => _WritingPracticeSectionState();
}

class _WritingPracticeSectionState extends State<WritingPracticeSection> {
  bool isLoading = true;
  String selectedQuestionType = 'ALL';
  List<WritingPracticeItem> items = WritingPracticeItem.defaultItems;
  late final service = widget.evaluationService ?? WritingEvaluationService();

  @override
  void initState() {
    super.initState();
    _loadItems();
  }

  Future<void> _loadItems() async {
    try {
      final fetched = await service.fetchWritingItems();
      if (mounted) {
        setState(() {
          if (fetched.isNotEmpty) {
            items = fetched;
          }
          isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  List<WritingPracticeItem> get filteredItems {
    if (selectedQuestionType == 'ALL') return items;
    return items.where((e) {
      final code = e.skillCode.toLowerCase();
      final p = e.prompt.toLowerCase();
      final isLetter = code.contains('letter') || code.contains('email');
      final isDiscussion =
          p.contains('discuss both') || p.contains('discussing both');
      final isOpinion = code.contains('essay') && !isDiscussion;
      final isEssay = code.contains('essay');

      switch (selectedQuestionType) {
        case 'LETTER_EMAIL':
          return isLetter;
        case 'ESSAY':
          return isEssay;
        case 'OPINION':
          return isOpinion;
        case 'DISCUSSION':
          return isDiscussion;
        default:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header giới thiệu
        FigmaCard(
          padding: AppSpacing.cardPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: learningHeading('Ngân hàng Đề Luyện Viết (CEFR)', size: 18),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary50,
                      borderRadius: AppRadius.tagRadius,
                      border: Border.all(color: AppColors.primary200),
                    ),
                    child: Text(
                      '${filteredItems.length} đề',
                      style: designText(
                        12,
                        color: AppColors.primary700,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Chọn một đề bài thực tế bên dưới để viết và nhận đánh giá chi tiết 4 tiêu chí rubric từ Giám khảo AI.',
                style: designText(14, color: AppColors.grey700, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Bộ lọc Loại câu hỏi
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final type in const [
                {'id': 'ALL', 'label': 'Tất cả loại bài'},
                {'id': 'LETTER_EMAIL', 'label': 'Thư tín / Email'},
                {'id': 'ESSAY', 'label': 'Bài luận (Essay)'},
                {'id': 'OPINION', 'label': 'Nghị luận ý kiến'},
                {'id': 'DISCUSSION', 'label': 'Thảo luận 2 quan điểm'},
              ])
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: FilterChip(
                    selected: selectedQuestionType == type['id'],
                    label: Text(type['label']!),
                    labelStyle: designText(
                      13,
                      color: selectedQuestionType == type['id']
                          ? Colors.white
                          : AppColors.grey800,
                      weight: FontWeight.w600,
                    ),
                    selectedColor: AppColors.primary500,
                    backgroundColor: AppColors.grey100,
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.pill,
                      side: BorderSide(
                        color: selectedQuestionType == type['id']
                            ? AppColors.primary500
                            : AppColors.grey200,
                      ),
                    ),
                    showCheckmark: false,
                    onSelected: (val) {
                      if (val) setState(() => selectedQuestionType = type['id']!);
                    },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        if (isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.xl),
              child: CircularProgressIndicator(color: AppColors.primary500),
            ),
          )
        else
          // Danh sách các đề bài
          for (var i = 0; i < filteredItems.length; i++) ...[
            _buildTaskCard(filteredItems[i], i),
            const SizedBox(height: AppSpacing.md),
          ],
      ],
    );
  }

  Widget _buildTaskCard(WritingPracticeItem item, int index) {
    final draft = widget.model.getDraft(item.id, index);
    final words = wordCount(draft);
    final score = widget.model.getScore(item.id, index);
    final hasScore = words > 0 && score > 0;
    final displayScore = hasScore ? score.toStringAsFixed(1) : '0.0';

    return FigmaCard(
      padding: AppSpacing.cardPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: hasScore ? AppColors.primary50 : AppColors.grey100,
                  borderRadius: AppRadius.tagRadius,
                  border: Border.all(
                    color: hasScore ? AppColors.primary200 : AppColors.grey300,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      hasScore ? Icons.star_rounded : Icons.edit_note_rounded,
                      size: 14,
                      color: hasScore ? AppColors.primary700 : AppColors.grey600,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      displayScore,
                      style: designText(
                        12,
                        color: hasScore ? AppColors.primary700 : AppColors.grey700,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  item.skillTitle,
                  style: designText(
                    12,
                    color: AppColors.grey600,
                    weight: FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '${item.minWords}–${item.maxWords} từ',
                style: designText(12, color: AppColors.grey600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.prompt,
            style: designText(
              15,
              weight: FontWeight.w600,
              color: AppColors.grey900,
              height: 1.4,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(
                words >= 20 ? Icons.check_circle : Icons.edit_note,
                size: 16,
                color: words >= 20 ? AppColors.primary500 : AppColors.grey500,
              ),
              const SizedBox(width: 4),
              Text(
                words > 0 ? '$words từ đã viết' : 'Chưa bắt đầu',
                style: designText(
                  12,
                  color: words >= 20 ? AppColors.primary700 : AppColors.grey600,
                  weight: words >= 20 ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary500,
                    foregroundColor: Colors.white,
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: () async {
                    await previewPush(
                      context,
                      WritingTaskPage(
                        model: widget.model,
                        item: item,
                        itemIndex: index,
                        evaluationService: service,
                      ),
                    );
                    if (mounted) setState(() {});
                  },
                  icon: const Icon(Icons.edit, size: 16),
                  label: Text(
                    words > 0 ? 'Tiếp tục viết' : 'Bắt đầu viết',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              if (words > 0) ...[
                const SizedBox(width: AppSpacing.sm),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.grey800,
                    side: const BorderSide(color: AppColors.grey300),
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: 10,
                    ),
                  ),
                  onPressed: () async {
                    await previewPush(
                      context,
                      WritingReviewPage(
                        model: widget.model,
                        items: [item],
                      ),
                    );
                    if (mounted) setState(() {});
                  },
                  child: const Text('Xem lại'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Màn hình 1: Danh sách Đề bài Luyện Viết từ Ngân hàng Đề thi Database (Single-Task Selection)
class WritingPracticeListPage extends StatelessWidget {
  const WritingPracticeListPage({
    super.key,
    required this.model,
    this.evaluationService,
  });

  final PreviewModel model;
  final WritingEvaluationService? evaluationService;

  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Đề Luyện Viết (CEFR)',
      trailing: _writingFlag(context),
      child: ListView(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.horizontal(context),
          vertical: AppSpacing.md,
        ),
        children: [
          WritingPracticeSection(
            model: model,
            evaluationService: evaluationService,
          ),
        ],
      ),
    ),
  );
}
