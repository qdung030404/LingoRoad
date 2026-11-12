import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import 'audio_controls.dart';
import 'placement_controller.dart';
import 'placement_result_pages.dart';

export 'placement_result_pages.dart';

class PlacementHome extends StatefulWidget {
  const PlacementHome({super.key, required this.session});
  final SessionController session;
  @override
  State<PlacementHome> createState() => _PlacementHomeState();
}

class _PlacementHomeState extends State<PlacementHome> {
  bool busy = false;
  String? error;
  Future<void> begin() async {
    setState(() {
      busy = true;
      error = null;
    });
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => QuestionPage(session: widget.session),
      ),
    );
    try {
      await widget.session.refreshPlacement();
    } catch (e) {
      if (mounted) setState(() => error = errorMessage(e));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final resume = widget.session.placement['status'] == 'IN_PROGRESS';
    return FigmaPage(
      title: 'Kiểm tra đầu vào',
      headerHeight: 42,
      trailing: profileAction(context, widget.session),
      bottom: CustomAppButton(
        text: resume ? 'Tiếp tục bài đang làm' : 'Bắt đầu kiểm tra',
        onPressed: begin,
        isLoading: busy,
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text(
            resume
                ? 'Tiếp tục bài kiểm tra'
                : 'Cùng tìm điểm xuất phát của bạn',
            style: designHeading(28, height: 1),
          ),
          const SizedBox(height: 24),
          FigmaCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                _introLine(
                  'intro/imgVuesaxBulkTimer',
                  resume
                      ? 'Đã làm ${widget.session.placement['currentIndex'] ?? 0}/10 câu'
                      : 'Khoảng 10-15 phút',
                ),
                const SizedBox(height: 12),
                _introLine('intro/imgVuesaxBulkTask', '2 phần: Đọc - Nghe'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          for (final entry in [
            (
              'intro/imgVuesaxBulkSetting5',
              'Thích ứng với năng lực của bạn',
              'Độ khó câu hỏi sẽ thay đổi dựa trên câu trả lời của bạn.',
            ),
            (
              'intro/imgVuesaxBulkTask1',
              'Làm bài theo từng bước',
              'Hoàn thành từng câu hỏi và tiếp tục theo hướng dẫn trên màn hình.',
            ),
            (
              'intro/imgChart',
              'Đánh giá sát với năng lực thực tế',
              'Hãy chọn đáp án phù hợp nhất với khả năng hiện tại của bạn.',
            ),
          ])
            Padding(
              padding: const EdgeInsets.only(left: 8, right: 16, bottom: 24),
              child: Row(
                children: [
                  FigmaAsset(entry.$1, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.$2,
                          style: designText(14, weight: FontWeight.w500),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          entry.$3,
                          style: designText(12, color: AppColors.grey800),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (error != null) ErrorNotice(error!),
        ],
      ),
    );
  }

  Widget _introLine(String icon, String text) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(icon, size: 20),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(text, style: designText(16, weight: FontWeight.w500)),
      ),
    ],
  );
}

class QuestionPage extends StatefulWidget {
  const QuestionPage({super.key, required this.session});
  final SessionController session;
  @override
  State<QuestionPage> createState() => _QuestionPageState();
}

class _QuestionPageState extends State<QuestionPage> {
  late final controller = PlacementController(widget.session.api);
  bool listeningReady = false, audioVisible = true;
  @override
  void initState() {
    super.initState();
    controller.start();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() => audioVisible = false);
    await controller.submit();
    if (!mounted) return;
    if (controller.result != null) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ResultPage(
            session: widget.session,
            sessionId: controller.sessionId!,
            initialResult: controller.result,
          ),
        ),
      );
    } else {
      setState(() => audioVisible = true);
    }
  }

  Future<void> review() async {
    setState(() => audioVisible = false);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ReviewPage(
          session: widget.session,
          sessionId: controller.sessionId!,
          initialIndex: (controller.item?['index'] as int? ?? 1) - 1,
        ),
      ),
    );
    if (mounted) setState(() => audioVisible = true);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final item = controller.item;
      if (item == null) {
        return FigmaPage(
          title: 'Kiểm tra đầu vào',
          child: controller.busy
              ? const Center(child: CircularProgressIndicator())
              : PageBody(
                  children: [
                    ErrorNotice(
                      controller.error ?? 'Không tải được bài kiểm tra.',
                      onRetry: controller.start,
                    ),
                  ],
                ),
        );
      }
      final listening = item['skill'] == 'LISTENING';
      if (listening && !listeningReady) {
        return FigmaPage(
          title: 'Phần 2 · Nghe',
          bottom: CustomAppButton(
            text: 'Bắt đầu phần Nghe',
            onPressed: () => setState(() => listeningReady = true),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionProgress(index: 5),
                const SizedBox(height: 32),
                Text(
                  'Sẵn sàng cho phần Nghe?',
                  style: designHeading(28, height: 1),
                ),
                const SizedBox(height: 24),
                FigmaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '5 câu hỏi · Nghe và chọn đáp án',
                        style: designText(16, weight: FontWeight.w500),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Đáp án phần Đọc đã được lưu. Hãy bật âm lượng hoặc dùng tai nghe.',
                        style: designText(
                          14,
                          color: AppColors.grey800,
                          height: 1.5,
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
      final index = item['index'] as int;
      final sectionIndex = item['sectionIndex'] as int? ?? index % 5;
      final options = (item['options'] as List).cast<String>();
      return FigmaPage(
        title: listening ? 'Phần 2 · Nghe' : 'Phần 1 · Đọc',
        trailing: IconButton(
          tooltip: 'Hướng dẫn làm bài',
          icon: FigmaAsset(
            listening
                ? 'listening/imgVuesaxLinearFlag'
                : 'reading/imgVuesaxLinearMessageQuestion',
          ),
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            showDragHandle: true,
            builder: (_) => const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Chọn đáp án rồi bấm Tiếp theo. Đáp án đã nộp được khóa; bạn có thể xem lại bằng nút danh sách câu hỏi.',
              ),
            ),
          ),
        ),
        bottom: QuestionToolbar(
          progress: '${sectionIndex + 1}/5',
          onReview: review,
          canReview: index > 0 && !controller.busy,
          label: index == controller.totalItems - 1 ? 'Nộp bài' : 'Tiếp theo',
          onNext: controller.selected == null ? null : submit,
          busy: controller.busy,
        ),
        child: ListView(
          key: ValueKey(item['id']),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          children: [
            SectionProgress(index: index),
            const SizedBox(height: 12),
            Semantics(
              label: 'Câu ${index + 1}/${controller.totalItems}',
              child: Text(
                'Câu ${sectionIndex + 1}/5',
                key: const Key('questionNumber'),
                style: designText(
                  16,
                  weight: FontWeight.w500,
                  color: AppColors.grey800,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (item['passage'] is String &&
                (item['passage'] as String).isNotEmpty)
              PassageCard(passage: item['passage'] as String),
            if (listening && audioVisible && item['mediaUrl'] != null)
              AudioControls(
                key: ValueKey(item['id']),
                url: Uri.parse(
                  widget.session.api.config.apiBaseUrl,
                ).resolve(item['mediaUrl'] as String).toString(),
              ),
            const SizedBox(height: 32),
            Text(
              item['prompt'] as String,
              style: designText(18, weight: FontWeight.w600, height: 1.2),
            ),
            const SizedBox(height: 24),
            for (var i = 0; i < options.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AnswerOption(
                  key: ValueKey('option-$i'),
                  index: i,
                  text: options[i],
                  selected: controller.selected == i,
                  onTap: controller.busy ? null : () => controller.select(i),
                ),
              ),
            if (controller.error != null) ErrorNotice(controller.error!),
          ],
        ),
      );
    },
  );
}

class QuestionToolbar extends StatelessWidget {
  const QuestionToolbar({
    super.key,
    required this.progress,
    required this.onReview,
    required this.canReview,
    required this.label,
    this.onNext,
    this.busy = false,
  });
  final String progress, label;
  final VoidCallback onReview;
  final VoidCallback? onNext;
  final bool canReview, busy;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 48,
        child: CustomAppButton(
          text: '',
          isSecondary: true,
          borderRadius: AppRadius.tagRadius,
          icon: const FigmaAsset('reading/imgVuesaxLinearArrowLeft1', size: 20),
          onPressed: canReview ? onReview : null,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          text: progress,
          isSecondary: true,
          borderRadius: AppRadius.tagRadius,
          icon: const FigmaAsset('reading/imgVuesaxBoldCategory', size: 20),
          onPressed: busy ? null : onReview,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          key: const Key('submitAnswer'),
          text: label,
          borderRadius: AppRadius.tagRadius,
          fontSize: 18,
          onPressed: onNext,
          isLoading: busy,
        ),
      ),
    ],
  );
}
