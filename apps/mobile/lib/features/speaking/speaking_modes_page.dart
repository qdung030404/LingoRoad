import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_pages.dart';
import 'voice_conversations_page.dart';

const speakingModes = {
  'READ_ALOUD': (
    'Luyện đọc',
    'Đọc câu và đoạn ngắn, luyện phát âm từng từ.',
    Icons.menu_book_rounded,
  ),
  'TOPIC': (
    'Nói theo chủ đề',
    'Diễn đạt trong 60 giây, nhận phản hồi phát âm và nội dung.',
    Icons.chat_bubble_outline_rounded,
  ),
  'TONGUE_TWISTER': (
    'Thử thách phát âm',
    'Vượt 12 màn câu líu lưỡi và thu thập sao.',
    Icons.emoji_events_outlined,
  ),
};

class SpeakingModesPage extends StatefulWidget {
  const SpeakingModesPage({
    super.key,
    required this.controller,
    required this.practicePage,
  });
  final SpeakingController controller;
  final Widget Function() practicePage;
  @override
  State<SpeakingModesPage> createState() => _SpeakingModesPageState();
}

class _SpeakingModesPageState extends State<SpeakingModesPage> {
  SpeakingController get c => widget.controller;
  bool choosing = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(c.initialize());
    });
  }

  Future<void> enter(Json prompt) async {
    await c.select(prompt);
    if (!mounted || !c.active) return;
    await previewPush(context, widget.practicePage());
    if (c.active && c.mode == 'TONGUE_TWISTER') {
      try {
        await c.refreshGameProgress();
      } catch (_) {
        if (mounted) {
          previewMessage(context, 'Chưa tải được thành tích. Hãy thử lại.');
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (context, _) => FigmaPage(
      title: choosing ? 'Luyện Nói' : speakingModes[c.mode]!.$1,
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: c.busy || c.recording
            ? null
            : () {
                if (choosing) {
                  Navigator.pop(context);
                } else {
                  setState(() => choosing = true);
                }
              },
        icon: const Icon(Icons.chevron_left),
      ),
      trailing: IconButton(
        tooltip: 'Lịch sử luyện nói',
        icon: const Icon(Icons.history),
        onPressed: c.busy
            ? null
            : () => previewPush(context, SpeakingHistoryPage(controller: c)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (c.processing)
            LearningCard(
              children: [
                learningHeading('Bài nói đang được xử lý'),
                learningBody('Mở bài đang chấm để kiểm tra kết quả.'),
                OutlinedButton(
                  onPressed: () => previewPush(context, widget.practicePage()),
                  child: const Text('Tiếp tục bài đang chấm'),
                ),
              ],
            ),
          if (c.error != null) ...[
            learningBody(c.error!),
            TextButton(
              onPressed: c.busy
                  ? null
                  : () async {
                      if (!c.initialized) {
                        await c.initialize();
                      } else {
                        await c.chooseMode(c.mode);
                      }
                    },
              child: const Text('Thử lại'),
            ),
          ],
          if (c.busy) const Center(child: CircularProgressIndicator()),
          if (choosing)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: LearningCard(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.record_voice_over_rounded,
                          size: 24,
                          color: AppColors.primary700,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading('Hội thoại AI', size: 20),
                            const SizedBox(height: 8),
                            learningBody(
                              'Trò chuyện theo chủ đề cùng lingoRoad trong 3 phút.',
                              size: 14,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  FilledButton(
                    key: const ValueKey('speaking-mode-CONVERSATION'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.grey900,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: c.busy || c.processing || !c.active
                        ? null
                        : () => previewPush(
                            context,
                            VoiceConversationsPage(controller: c),
                          ),
                    child: const Text('Khám phá'),
                  ),
                ],
              ),
            ),
          if (choosing)
            for (final entry in speakingModes.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: LearningCard(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.primary25,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            entry.value.$3,
                            size: 24,
                            color: AppColors.primary700,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              learningHeading(entry.value.$1, size: 20),
                              const SizedBox(height: 8),
                              learningBody(entry.value.$2, size: 14),
                            ],
                          ),
                        ),
                      ],
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.grey900,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      key: ValueKey('speaking-mode-${entry.key}'),
                      onPressed: c.busy || c.processing || !c.active
                          ? null
                          : () async {
                              await c.chooseMode(entry.key);
                              if (mounted && c.active) {
                                setState(() => choosing = false);
                              }
                            },
                      child: const Text('Khám phá'),
                    ),
                  ],
                ),
              )
          else ...[
            if (!c.enabled)
              learningBody(
                'Chế độ này đang tạm dừng. Bạn vẫn xem được lịch sử.',
              ),
            if (c.mode == 'TONGUE_TWISTER')
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: learningBody(
                  'Đạt 60 điểm và đọc đủ ít nhất 80% để mở màn tiếp. Mốc sao là 60, 80 và 90 điểm.',
                ),
              ),
            for (final (index, prompt) in c.prompts.indexed)
              Builder(
                builder: (context) {
                  Json? progress;
                  for (final item in c.gameProgress) {
                    if (item['id'] == prompt['id']) progress = item;
                  }
                  final unlocked =
                      c.mode != 'TONGUE_TWISTER' ||
                      progress?['unlocked'] == true;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: LearningCard(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: learningHeading(
                                c.mode == 'TONGUE_TWISTER'
                                    ? 'Màn ${index + 1}'
                                    : 'Bài ${index + 1}',
                                size: 18,
                              ),
                            ),
                            Text(
                              const [
                                'Dễ',
                                'Vừa',
                                'Khó',
                              ][((prompt['difficulty'] as num? ?? 1).toInt() -
                                      1)
                                  .clamp(0, 2)],
                            ),
                            if (!unlocked)
                              const Padding(
                                padding: EdgeInsets.only(left: 8),
                                child: Icon(Icons.lock_outline),
                              ),
                          ],
                        ),
                        learningBody(prompt['text']?.toString() ?? ''),
                        if (progress != null)
                          Text(
                            '${'★' * ((progress['stars'] as num?)?.toInt() ?? 0)}  Tốt nhất ${progress['bestScore'] == null ? '—' : (progress['bestScore'] as num).toStringAsFixed(1)}',
                          ),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.grey900,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(48),
                          ),
                          onPressed:
                              !unlocked ||
                                  !c.enabled ||
                                  c.busy ||
                                  c.processing ||
                                  !c.active
                              ? null
                              : () => enter(prompt),
                          child: Text(
                            unlocked ? 'Bắt đầu luyện' : 'Hoàn thành màn trước',
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ],
      ),
    ),
  );
}
