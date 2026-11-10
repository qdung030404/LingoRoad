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
import 'writing_review_page.dart';

Widget _writingFlag(BuildContext context) => IconButton(
  tooltip: 'Báo vấn đề',
  onPressed: () => previewMessage(
    context,
    'Đây là bài mẫu. Báo cáo chưa được gửi lên máy chủ.',
  ),
  icon: const FigmaAsset('speaking/imgVuesaxLinearFlag'),
);

/// Màn hình 2: Màn hình Viết bài Tập trung cho 1 Đề bài Độc lập (Single-Task Writing Page)
class WritingTaskPage extends StatefulWidget {
  const WritingTaskPage({
    super.key,
    required this.model,
    required this.item,
    this.itemIndex = 0,
    this.evaluationService,
  });

  final PreviewModel model;
  final WritingPracticeItem item;
  final int itemIndex;
  final WritingEvaluationService? evaluationService;

  @override
  State<WritingTaskPage> createState() => _WritingTaskPageState();
}

class _WritingTaskPageState extends State<WritingTaskPage> {
  bool hints = false, saving = false, promptExpanded = true;
  bool isSubmitted = false;
  late final service = widget.evaluationService ?? WritingEvaluationService();
  late final TextEditingController controller;

  @override
  void initState() {
    super.initState();
    controller = TextEditingController(
      text: widget.model.getDraft(widget.item.id, widget.itemIndex),
    );
    isSubmitted = widget.model.getEvaluation(widget.item.id) != null;
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> save({bool announce = false}) async {
    if (saving) return;
    saving = true;
    try {
      await widget.model.saveItemDraft(
        widget.item.id,
        controller.text,
        widget.itemIndex,
      );
      if (announce && mounted) {
        previewMessage(context, 'Đã lưu bản nháp trên thiết bị.');
      }
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không lưu được bản nháp. Vui lòng thử lại.');
      }
    } finally {
      saving = false;
    }
  }

  Future<void> evaluateWithAi() async {
    final text = controller.text.trim();
    final words = wordCount(text);
    if (words < 20) {
      previewMessage(
        context,
        'Bài viết cần tối thiểu 20 từ để AI chấm điểm (hiện có $words từ).',
      );
      return;
    }

    FocusScope.of(context).unfocus();
    await save();

    if (!mounted) return;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: Dialog(
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadius.dialogRadius,
          ),
          child: Padding(
            padding: AppSpacing.dialogPadding,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.primary500),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'AI đang đánh giá bài viết...',
                  textAlign: TextAlign.center,
                  style: designHeading(16),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'AI đang phân tích bài viết theo trình độ ${widget.item.cefrLevel} và checklist ngữ pháp.',
                  textAlign: TextAlign.center,
                  style: designText(12, color: AppColors.grey600),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final result = await service.evaluateWriting(
        taskType: widget.item.taskType,
        taskPrompt: widget.item.prompt,
        essay: text,
        targetCefr: widget.item.cefrLevel,
        itemId: widget.item.id,
        targetGrammars: widget.item.targetGrammars,
        learnerLevel: widget.item.cefrLevel,
      );
      await widget.model.saveScore(widget.item.id, result.overallScore, widget.itemIndex);
      await widget.model.saveEvaluation(widget.item.id, result);
      await widget.model.finish('writing');
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        setState(() {
          isSubmitted = true;
        });
        final shouldRewrite = await previewPush<bool>(
          context,
          WritingEvaluationResultPage(
            result: result,
            prompt: widget.item.prompt,
            essay: text,
          ),
        );
        if (shouldRewrite == true && mounted) {
          await widget.model.clearEvaluation(widget.item.id);
          setState(() {
            isSubmitted = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        previewMessage(
          context,
          'Không thể chấm điểm AI: ${e.toString().replaceAll("Exception: ", "")}',
        );
      }
    }
  }

  Future<void> _viewAiEvaluation() async {
    final eval = widget.model.getEvaluation(widget.item.id);
    if (eval == null) return;
    final shouldRewrite = await previewPush<bool>(
      context,
      WritingEvaluationResultPage(
        result: eval,
        prompt: widget.item.prompt,
        essay: controller.text,
      ),
    );
    if (shouldRewrite == true && mounted) {
      await widget.model.clearEvaluation(widget.item.id);
      setState(() {
        isSubmitted = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    onPopInvokedWithResult: (didPop, _) {
      if (didPop) save();
    },
    child: PreviewSurface(
      child: FigmaPage(
        titleStyle: designHeading(18),
        title: 'Luyện Viết',
        trailing: _writingFlag(context),
        bottom: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.horizontal(context),
            vertical: AppSpacing.sm,
          ),
          child: CustomAppButton(
            key: const Key('writingAiEvaluate'),
            text: isSubmitted ? 'Xem đánh giá của AI' : 'Gửi bài để AI đánh giá',
            icon: const Icon(Icons.auto_awesome, size: 18, color: Colors.white),
            onPressed: isSubmitted
                ? _viewAiEvaluation
                : (wordCount(controller.text) < 20 ? null : evaluateWithAi),
          ),
        ),
        child: ListView(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.horizontal(context),
            vertical: AppSpacing.md,
          ),
          children: [
            // Thẻ Đề bài (hỗ trợ thu gọn để tăng không gian viết bài)
            FigmaCard(
              padding: AppSpacing.cardPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  InkWell(
                    key: const Key('togglePromptExpand'),
                    onTap: () =>
                        setState(() => promptExpanded = !promptExpanded),
                    borderRadius: AppRadius.tagRadius,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.item.skillTitle,
                            style: designText(
                              13,
                              color: AppColors.grey700,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              promptExpanded ? 'Thu gọn đề' : 'Xem toàn bộ đề',
                              style: designText(
                                12,
                                color: AppColors.primary600,
                                weight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              promptExpanded
                                  ? Icons.keyboard_arrow_up
                                  : Icons.keyboard_arrow_down,
                              size: 18,
                              color: AppColors.primary600,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (promptExpanded)
                    learningHeading(widget.item.prompt, size: 18)
                  else
                    Text(
                      widget.item.prompt,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: designText(14, color: AppColors.grey600),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Thẻ Thử thách Ngữ pháp Mục tiêu (Target Grammar Checklist)
            if (widget.item.targetGrammars.isNotEmpty) ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: AppColors.primary25,
                  borderRadius: AppRadius.cardRadius,
                  border: Border.all(color: AppColors.primary200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.checklist_rtl_rounded,
                          color: AppColors.primary700,
                          size: 18,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'Thử thách Ngữ pháp Mục tiêu',
                          style: designHeading(
                            14,
                            color: AppColors.primary800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Hãy áp dụng chính xác và tự nhiên các cấu trúc sau vào bài viết của bạn:',
                      style: designText(12, color: AppColors.grey700),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        for (final grammar in widget.item.targetGrammars)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: AppRadius.tagRadius,
                              border: Border.all(color: AppColors.primary300),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.star_outline_rounded,
                                  color: AppColors.primary600,
                                  size: 14,
                                ),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    grammar,
                                    style: designText(
                                      12,
                                      color: AppColors.primary800,
                                      weight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // Accordion Tiêu chí chấm điểm
            LearningCard(
              children: [
                InkWell(
                  key: const Key('writingHints'),
                  onTap: () => setState(() => hints = !hints),
                  child: Row(
                    children: [
                      Expanded(
                        child: learningHeading(
                          'Tiêu chí chấm điểm',
                          size: 16,
                        ),
                      ),
                      Icon(
                        hints
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        size: 20,
                        color: AppColors.grey700,
                      ),
                    ],
                  ),
                ),
                if (hints) ...[
                  const SizedBox(height: AppSpacing.sm),
                  learningHeading(
                    '4 tiêu chí chấm điểm của bài thi viết:',
                    size: 14,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  learningBody(
                    '1. Nội dung (Content): Mức độ liên quan, hoàn thành yêu cầu đề bài, phát triển ý tưởng.\n'
                    '2. Hiệu quả giao tiếp (Communicative Achievement): Văn phong phù hợp (trang trọng/thân mật), tuân thủ đúng quy ước thể loại bài viết.\n'
                    '3. Bố cục & Tổ chức (Organisation): Tính mạch lạc, phân chia đoạn văn, liên kết ý logic và sử dụng từ nối.\n'
                    '4. Ngôn ngữ (Language): Độ đa dạng và độ chính xác của từ vựng cùng các cấu trúc ngữ pháp.',
                    size: 13,
                  ),
                  if (widget.item.expectedPoints.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    learningHeading('Gợi ý ý trọng tâm:', size: 14),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final point in widget.item.expectedPoints)
                          LearningPill(
                            point,
                            onTap: () {
                              final current = controller.text;
                              controller.text =
                                  '$current${current.isEmpty ? '' : ' '}$point';
                              controller.selection =
                                  TextSelection.collapsed(
                                    offset: controller.text.length,
                                  );
                              setState(() {});
                            },
                          ),
                      ],
                    ),
                  ],
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // Ô soạn thảo văn bản (tăng chiều cao khi thu gọn đề bài)
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              height: promptExpanded ? 200 : 380,
              child: TextField(
                key: const Key('writingInput'),
                controller: controller,
                expands: true,
                maxLines: null,
                textAlignVertical: TextAlignVertical.top,
                onChanged: (_) => setState(() {}),
                style: designText(16, height: 1.5),
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Bắt đầu viết bài của bạn ở đây...',
                  hintStyle: designText(15, color: AppColors.grey600),
                  filled: true,
                  fillColor: AppColors.grey50,
                  contentPadding: const EdgeInsets.all(AppSpacing.md),
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.tagRadius,
                    borderSide: const BorderSide(color: AppColors.grey200),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.tagRadius,
                    borderSide: const BorderSide(color: AppColors.grey200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: AppRadius.tagRadius,
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),

            // Thanh đếm từ & Lưu nháp
            Row(
              children: [
                Expanded(
                  child: learningBody(
                    '${wordCount(controller.text)} từ · mục tiêu ${widget.item.minWords}–${widget.item.maxWords} từ',
                    size: 14,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => save(announce: true),
                  icon: const FigmaAsset(
                    'writing/imgVuesaxLinearBookSaved',
                    size: 18,
                  ),
                  label: Text(
                    'Lưu',
                    style: designText(15, color: AppColors.grey800),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),

            // Nút tiện ích: Điền bài mẫu & Xem lại
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                TextButton(
                  onPressed: () {
                    final sample = widget.item.sampleText ??
                        (widget.itemIndex < sampleWriting.length
                            ? sampleWriting[widget.itemIndex]
                            : '');
                    setState(() => controller.text = sample);
                  },
                  child: const Text('Điền bài mẫu'),
                ),
                TextButton.icon(
                  onPressed: () => previewPush(
                    context,
                    WritingReviewPage(
                      model: widget.model,
                      items: [widget.item],
                    ),
                  ),
                  icon: const Icon(Icons.history, size: 16),
                  label: const Text('Xem lại bài viết'),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

