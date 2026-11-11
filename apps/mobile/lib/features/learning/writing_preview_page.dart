import 'package:flutter/material.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'writing_evaluation_service.dart';
import 'writing_evaluation_result_page.dart';
import 'writing_practice_page.dart';

Widget _writingFlag(BuildContext context) => IconButton(
  tooltip: 'Báo vấn đề',
  onPressed: () => previewMessage(
    context,
    'Đây là bài mẫu. Báo cáo chưa được gửi lên máy chủ.',
  ),
  icon: const FigmaAsset('speaking/imgVuesaxLinearFlag'),
);

/// Lớp tương thích ngược phục vụ Widget Test suite cũ
class WritingPreviewPage extends StatefulWidget {
  const WritingPreviewPage({
    super.key,
    required this.model,
    this.evaluationService,
  });

  final PreviewModel model;
  final WritingEvaluationService? evaluationService;

  @override
  State<WritingPreviewPage> createState() => _WritingPreviewPageState();
}

class _WritingPreviewPageState extends State<WritingPreviewPage> {
  int index = 0;
  bool hints = false, saving = false;
  List<WritingPracticeItem> items = WritingPracticeItem.defaultItems;
  late final service = widget.evaluationService ?? WritingEvaluationService();
  late final controller = TextEditingController(
    text: widget.model.drafts[index],
  );

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> save({bool announce = false}) async {
    if (saving) return;
    saving = true;
    try {
      await widget.model.saveDraft(index, controller.text);
      if (announce && mounted) {
        previewMessage(context, 'Đã lưu bản nháp trên thiết bị.');
      }
    } finally {
      saving = false;
    }
  }

  Future<void> move(int next) async {
    FocusScope.of(context).unfocus();
    await save();
    if (!mounted) return;
    setState(() {
      index = next;
      controller.text = widget.model.drafts[index];
      hints = false;
    });
  }

  Future<void> next() async {
    if (controller.text.trim().isEmpty) {
      previewMessage(context, 'Hãy viết câu trả lời trước khi tiếp tục.');
      return;
    }
    await save();
    if (!mounted) return;
    if (index == 0) {
      await move(1);
      return;
    }
    await widget.model.finish('writing');
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute<void>(
          builder: (_) => WritingResultPage(
            model: widget.model,
            items: items,
          ),
        ),
      );
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
      final currentItem = items[index % items.length];
      final result = await service.evaluateWriting(
        taskType: currentItem.taskType,
        taskPrompt: currentItem.prompt,
        essay: text,
        targetCefr: currentItem.cefrLevel,
      );
      if (mounted) {
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
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        previewMessage(context, 'Lỗi chấm AI: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) => PreviewSurface(
    showSampleLabel: false,
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Luyện Viết',
      trailing: _writingFlag(context),
      bottom: PreviewToolbar(
        index: index,
        total: 2,
        onBack: index == 0 ? null : () => move(0),
        onNext: controller.text.trim().isEmpty ? null : next,
        nextLabel: index == 1 ? 'Nộp bài' : 'Tiếp theo',
      ),
      child: ListView(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.horizontal(context),
          vertical: AppSpacing.md,
        ),
        children: [
          PreviewProgress(
            index: index,
            total: 2,
            label: 'Câu ${index + 1}/2',
          ),
          FigmaCard(
            padding: AppSpacing.cardPadding,
            child: learningHeading(items[index % items.length].prompt, size: 20),
          ),
          const SizedBox(height: 12),
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
                    const FigmaAsset(
                      'writing/imgVuesaxLinearArrowDown',
                      size: 20,
                    ),
                  ],
                ),
              ),
              if (hints) ...[
                Wrap(
                  spacing: 8,
                  children: [
                    for (final p in items[index % items.length].expectedPoints)
                      LearningPill(p),
                  ],
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 160,
            child: TextField(
              key: const Key('writingInput'),
              controller: controller,
              maxLines: null,
              expands: true,
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TextButton(
                onPressed: () {
                  setState(() => controller.text = sampleWriting[index]);
                },
                child: const Text('Điền bài mẫu'),
              ),
              ElevatedButton.icon(
                key: const Key('writingAiEvaluate'),
                onPressed: evaluateWithAi,
                icon: const Icon(Icons.auto_awesome, size: 16),
                label: const Text('Chấm bài AI (CEFR)'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

