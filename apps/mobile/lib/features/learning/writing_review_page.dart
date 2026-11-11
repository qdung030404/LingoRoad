import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'writing_evaluation_service.dart';
import 'writing_evaluation_result_page.dart';

/// Màn hình Kết quả luyện tập nộp bài (Legacy flow wrapper)
class WritingResultPage extends StatelessWidget {
  const WritingResultPage({super.key, required this.model, this.items});
  final PreviewModel model;
  final List<WritingPracticeItem>? items;

  List<WritingPracticeItem> get _items =>
      (items != null && items!.isNotEmpty)
          ? items!
          : WritingPracticeItem.defaultItems;

  int _resolveTargetIndex() {
    for (var i = 0; i < _items.length; i++) {
      if (i < model.drafts.length && wordCount(model.drafts[i]) >= 20) {
        return i;
      }
    }
    return 0;
  }

  Future<void> _evaluateAi(BuildContext context, int taskIndex) async {
    final text = model.drafts[taskIndex].trim();
    final words = wordCount(text);
    if (words < 20) {
      previewMessage(
        context,
        'Bài viết ${taskIndex + 1} cần tối thiểu 20 từ để AI chấm điểm (hiện có $words từ).',
      );
      return;
    }
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog(
        child: Padding(
          padding: AppSpacing.dialogPadding,
          child: const CircularProgressIndicator(),
        ),
      ),
    );
    try {
      final service = WritingEvaluationService();
      final item = _items[taskIndex % _items.length];
      final result = await service.evaluateWriting(
        taskType: item.taskType,
        taskPrompt: item.prompt,
        essay: text,
        targetCefr: item.cefrLevel,
          itemId: item.id,
      );
      await model.saveScore(item.id, result.overallScore, taskIndex);
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        previewPush(
          context,
          WritingEvaluationResultPage(
            result: result,
            prompt: item.prompt,
            essay: text,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        previewMessage(
          context,
          'Không thể chấm điểm AI: ${e.toString().replaceAll("Exception: ", "")}',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => PreviewSurface(
    showSampleLabel: false,
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Kết quả',
      headerHeight: 42,
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Chấm điểm bài viết với AI (CEFR)',
            onPressed: () => _evaluateAi(context, _resolveTargetIndex()),
          ),
          const SizedBox(height: 12),
          CustomAppButton(
            text: 'Xem chi tiết từng bài',
            isSecondary: true,
            onPressed: () => previewPush(
              context,
              WritingReviewPage(model: model, items: _items),
            ),
          ),
          const SizedBox(height: 12),
          CustomAppButton(
            text: 'Hoàn thành bài tập',
            isSecondary: true,
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      child: ListView(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.horizontal(context),
          vertical: AppSpacing.md,
        ),
        children: [
          learningHeading('Bạn đã hoàn thành bài viết! 🎉', size: 28),
          const SizedBox(height: 12),
          learningBody(
            'Hệ thống đã lưu lại nội dung bài làm của bạn. Nhấn nút bên dưới để Giám khảo AI phân tích và trả về rubric CEFR.',
          ),
          const SizedBox(height: 24),
          for (var i = 0; i < _items.length; i++) ...[
            LearningCard(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary50,
                        borderRadius: AppRadius.tagRadius,
                        border: Border.all(color: AppColors.primary200),
                      ),
                      child: Text(
                        'Bậc ${_items[i].cefrLevel}',
                        style: designText(
                          12,
                          color: AppColors.primary700,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _items[i].skillTitle,
                        style: designText(
                          12,
                          color: AppColors.grey600,
                          weight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                learningHeading(_items[i].prompt, size: 16),
                const SizedBox(height: 12),
                learningBody(
                  i < model.drafts.length && model.drafts[i].isNotEmpty
                      ? model.drafts[i]
                      : '(Chưa có bài viết cho câu này)',
                  size: 14,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      '${i < model.drafts.length ? wordCount(model.drafts[i]) : 0} từ',
                      style: designText(12, color: AppColors.grey600),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => _evaluateAi(context, i),
                      icon: const Icon(Icons.auto_awesome, size: 16),
                      label: const Text('Chấm câu này'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ],
      ),
    ),
  );
}

/// Màn hình Xem lại bài viết (Review Page) - Được người dùng yêu cầu giữ lại
class WritingReviewPage extends StatefulWidget {
  const WritingReviewPage({
    super.key,
    required this.model,
    this.items,
    this.item,
    this.itemIndex = 0,
    this.evaluationService,
  });

  final PreviewModel model;
  final List<WritingPracticeItem>? items;
  final WritingPracticeItem? item;
  final int itemIndex;
  final WritingEvaluationService? evaluationService;

  @override
  State<WritingReviewPage> createState() => _WritingReviewPageState();
}

class _WritingReviewPageState extends State<WritingReviewPage> {
  late int index = widget.itemIndex;

  List<WritingPracticeItem> get _items {
    if (widget.item != null) return [widget.item!];
    if (widget.items != null && widget.items!.isNotEmpty) return widget.items!;
    return WritingPracticeItem.defaultItems;
  }

  WritingPracticeItem get currentItem => _items[index % _items.length];

  String get currentDraft =>
      widget.model.getDraft(currentItem.id, index);

  @override
  Widget build(BuildContext context) => PreviewSurface(
    showSampleLabel: false,
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: _items.length > 1
          ? 'Bài viết ${index + 1}/${_items.length}'
          : 'Xem lại bài viết',
      headerHeight: 42,
      bottom: PreviewToolbar(
        index: index,
        total: _items.length,
        onBack: index == 0 ? null : () => setState(() => index--),
        onNext: () {
          if (index < _items.length - 1) {
            setState(() => index++);
          } else {
            Navigator.pop(context);
          }
        },
        nextLabel: index == _items.length - 1 ? 'Hoàn tất' : 'Tiếp theo',
      ),
      child: ListView(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.horizontal(context),
          vertical: AppSpacing.md,
        ),
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary50,
                  borderRadius: AppRadius.tagRadius,
                  border: Border.all(color: AppColors.primary200),
                ),
                child: Text(
                  'Bậc ${currentItem.cefrLevel}',
                  style: designText(
                    12,
                    color: AppColors.primary700,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  currentItem.skillTitle,
                  style: designText(
                    12,
                    color: AppColors.grey600,
                    weight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          learningBody('Đề bài từ Ngân hàng đề:', size: 16),
          const SizedBox(height: 8),
          learningHeading(currentItem.prompt, size: 20),
          const SizedBox(height: 20),
          Row(
            children: [
              learningBody('Bài viết của bạn:', size: 16),
              const Spacer(),
              Text(
                '${wordCount(currentDraft)} từ',
                style: designText(14, color: AppColors.grey600),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: AppSpacing.cardPadding,
            decoration: BoxDecoration(
              color: AppColors.grey50,
              border: Border.all(color: AppColors.grey100),
              borderRadius: AppRadius.tagRadius,
            ),
            child: SelectableText(
              currentDraft.isEmpty
                  ? '(Chưa có bài làm cho đề bài này)'
                  : currentDraft,
              style: designText(16, height: 1.5),
            ),
          ),
          const SizedBox(height: 16),
          CustomAppButton(
            text: 'Chấm bài này với AI (CEFR)',
            onPressed: () async {
              final text = currentDraft.trim();
              final words = wordCount(text);
              if (words < 20) {
                previewMessage(
                  context,
                  'Bài viết cần tối thiểu 20 từ để AI chấm điểm (hiện có $words từ).',
                );
                return;
              }
              showDialog<void>(
                context: context,
                barrierDismissible: false,
                builder: (dialogContext) => Dialog(
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadius.dialogRadius,
                  ),
                  child: Padding(
                    padding: AppSpacing.dialogPadding,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(
                          color: AppColors.primary500,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'AI đang đánh giá theo chuẩn CEFR...',
                          textAlign: TextAlign.center,
                          style: designHeading(16),
                        ),
                      ],
                    ),
                  ),
                ),
              );
              try {
                final service = widget.evaluationService ?? WritingEvaluationService();
                final result = await service.evaluateWriting(
                  taskType: currentItem.taskType,
                  taskPrompt: currentItem.prompt,
                  essay: text,
                  targetCefr: currentItem.cefrLevel,
                  itemId: currentItem.id,
                );
                await widget.model.saveScore(currentItem.id, result.overallScore, index);
                if (context.mounted) {
                  Navigator.of(context, rootNavigator: true).pop();
                  previewPush(
                    context,
                    WritingEvaluationResultPage(
                      result: result,
                      prompt: currentItem.prompt,
                      essay: text,
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  Navigator.of(context, rootNavigator: true).pop();
                  previewMessage(
                    context,
                    'Không thể chấm điểm AI: ${e.toString().replaceAll("Exception: ", "")}',
                  );
                }
              }
            },
          ),
          const SizedBox(height: 16),
          LearningCard(
            children: [
              learningHeading('Thông tin tiêu chí Rubric CEFR', size: 16),
              learningBody(
                'Hệ thống AI sẽ đánh giá 4 tiêu chí chuẩn quốc tế:\n• Content: Độ đầy đủ và liên quan của các ý\n• Communicative Achievement: Văn phong, tính phù hợp với mục đích viết\n• Organisation: Bố cục, liên kết câu và đoạn\n• Language: Độ chính xác và đa dạng ngữ pháp, từ vựng',
                size: 13,
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

