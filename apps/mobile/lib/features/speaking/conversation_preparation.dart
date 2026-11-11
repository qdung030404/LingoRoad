import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';

class ConversationPreparation extends StatefulWidget {
  const ConversationPreparation({
    super.key,
    required this.controller,
    required this.topicId,
    this.onStart,
    this.activities,
  });

  final SpeakingController controller;
  final String topicId;
  final ValueChanged<Json>? onStart;
  final Widget Function(Json)? activities;

  @override
  State<ConversationPreparation> createState() =>
      _ConversationPreparationState();
}

class _ConversationPreparationState extends State<ConversationPreparation> {
  late Future<Json> topic;

  Future<Json> load() async {
    try {
      return await widget.controller.repository.conversationTopic(
        widget.topicId,
      );
    } catch (_) {
      return {'loadError': true};
    }
  }

  @override
  void initState() {
    super.initState();
    topic = load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.grey25,
    appBar: AppBar(
      backgroundColor: AppColors.grey25,
      scrolledUnderElevation: 0,
      titleTextStyle: designHeading(18),
      title: Text(
        widget.activities == null ? 'Chuẩn bị hội thoại' : 'Luyện theo chủ đề',
      ),
    ),
    body: FutureBuilder<Json>(
      future: topic,
      builder: (context, snapshot) {
        if (!widget.controller.active) {
          return const Center(child: Text('Phiên đăng nhập đã thay đổi.'));
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data!;
        if (data['loadError'] == true) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  learningBody('Chưa tải được hướng dẫn cho chủ đề này.'),
                  TextButton(
                    onPressed: () => setState(() {
                      topic = load();
                    }),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            ),
          );
        }
        final preparation = Map<String, dynamic>.from(
          data['preparation'] as Map? ?? {},
        );
        final vocabulary = speakingItems(preparation['vocabulary']);
        final phrases = speakingItems(preparation['phrases']);
        final help = speakingItems(preparation['helpPhrases']);
        final questions = data['hints'] as List? ?? [];
        final tips = preparation['tips'] as List? ?? [];
        return SafeArea(
          top: false,
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.primary25,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (widget.activities != null)
                            const Icon(
                              Icons.forum_outlined,
                              color: AppColors.primary700,
                              size: 28,
                            )
                          else
                            Text(
                              'TRƯỚC KHI BẮT ĐẦU',
                              style: designText(
                                12,
                                weight: FontWeight.w600,
                                color: AppColors.primary700,
                              ),
                            ),
                          const SizedBox(height: 8),
                          learningHeading(
                            data['title']?.toString() ??
                                data['text'].toString(),
                            size: widget.activities == null ? 24 : 28,
                          ),
                          const SizedBox(height: 8),
                          learningBody(
                            preparation['goal']?.toString() ??
                                'Xem câu hỏi gợi ý và chuẩn bị câu trả lời của bạn.',
                            size: 15,
                          ),
                          if (widget.activities == null) ...[
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                const Icon(
                                  Icons.schedule_rounded,
                                  size: 18,
                                  color: AppColors.primary700,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Tối đa 3 phút · Hỏi đáp bằng tiếng Anh',
                                    style: designText(
                                      13,
                                      color: AppColors.primary700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (widget.activities != null) ...[
                      const SizedBox(height: 16),
                      widget.activities!(data),
                      const SizedBox(height: 16),
                      learningHeading('Học liệu chủ đề', size: 18),
                    ],
                    const SizedBox(height: 16),
                    _PreparationSection(
                      collapsible: widget.activities != null,
                      title: 'Từ vựng gợi ý',
                      icon: Icons.menu_book_rounded,
                      children: [
                        if (vocabulary.isEmpty)
                          learningBody(
                            'Chưa có từ vựng gợi ý cho chủ đề này.',
                            size: 14,
                          ),
                        if (vocabulary.isNotEmpty)
                          _PreparationList(
                            listKey: const ValueKey('suggestedVocabularyList'),
                            caption: '${vocabulary.length} từ và cụm từ',
                            itemCount: vocabulary.length,
                            itemBuilder: (_, index) =>
                                _VocabularyCard(vocabulary[index]),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _PreparationSection(
                      collapsible: widget.activities != null,
                      title: 'Mẫu câu thông dụng',
                      icon: Icons.chat_bubble_outline_rounded,
                      children: [
                        if (phrases.isEmpty)
                          learningBody(
                            'Chưa có mẫu câu gợi ý cho chủ đề này.',
                            size: 14,
                          ),
                        if (phrases.isNotEmpty)
                          _PreparationList(
                            listKey: const ValueKey('commonSentencesList'),
                            caption: '${phrases.length} câu mẫu',
                            itemCount: phrases.length,
                            itemBuilder: (_, index) =>
                                _SentenceCard(phrases[index]),
                          ),
                      ],
                    ),
                    if (questions.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _PreparationSection(
                        collapsible: widget.activities != null,
                        title: 'Câu hỏi có thể gặp',
                        icon: Icons.help_outline_rounded,
                        children: [
                          for (var i = 0; i < questions.length; i++)
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${i + 1}.',
                                  style: designText(
                                    15,
                                    color: AppColors.primary700,
                                    weight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    questions[i].toString(),
                                    style: designText(15),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ],
                    if (help.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _PreparationSection(
                        collapsible: widget.activities != null,
                        title: 'Khi cần hỗ trợ',
                        icon: Icons.support_agent_rounded,
                        children: [for (final item in help) _Phrase(item)],
                      ),
                    ],
                    if (tips.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _PreparationSection(
                        collapsible: widget.activities != null,
                        title: widget.activities == null
                            ? 'Cách luyện'
                            : 'Mẹo luyện tập',
                        icon: Icons.lightbulb_outline_rounded,
                        children: [
                          for (final tip in tips)
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.check_rounded,
                                  size: 18,
                                  color: AppColors.primary700,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: learningBody(tip.toString(), size: 14),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (widget.activities == null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: AppColors.grey100)),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        data['enabled'] == true
                            ? 'Micro được bật khi bạn bắt đầu hội thoại.'
                            : 'Hội thoại AI đang tạm dừng. Bạn có thể xem hướng dẫn.',
                        style: designText(12, color: AppColors.grey800),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.grey900,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(52),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                          ),
                          onPressed:
                              data['enabled'] == true &&
                                  widget.controller.active
                              ? () => widget.onStart?.call(data)
                              : null,
                          icon: const Icon(Icons.mic_rounded),
                          label: const Text('Bắt đầu hội thoại'),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );
}

class _PreparationSection extends StatelessWidget {
  const _PreparationSection({
    required this.title,
    required this.icon,
    required this.children,
    this.collapsible = false,
  });
  final String title;
  final IconData icon;
  final List<Widget> children;
  final bool collapsible;

  @override
  Widget build(BuildContext context) => collapsible
      ? FigmaCard(
          padding: EdgeInsets.zero,
          child: Material(
            color: Colors.transparent,
            child: ExpansionTile(
              shape: const Border(),
              collapsedShape: const Border(),
              leading: Icon(icon, color: AppColors.primary700),
              title: learningHeading(title, size: 16),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final item in children)
                  Padding(padding: const EdgeInsets.only(top: 12), child: item),
              ],
            ),
          ),
        )
      : FigmaCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 20, color: AppColors.primary700),
                  const SizedBox(width: 10),
                  Expanded(child: learningHeading(title, size: 18)),
                ],
              ),
              for (var i = 0; i < children.length; i++) ...[
                const SizedBox(height: 16),
                if (i > 0) ...[
                  const Divider(height: 1, color: AppColors.grey100),
                  const SizedBox(height: 12),
                ],
                children[i],
              ],
            ],
          ),
        );
}

class _PreparationList extends StatefulWidget {
  const _PreparationList({
    required this.listKey,
    required this.caption,
    required this.itemCount,
    required this.itemBuilder,
  });

  final Key listKey;
  final String caption;
  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;

  @override
  State<_PreparationList> createState() => _PreparationListState();
}

class _PreparationListState extends State<_PreparationList> {
  final _scroll = ScrollController(keepScrollOffset: false);

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(widget.caption, style: designText(13, color: AppColors.grey800)),
      const SizedBox(height: 10),
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 288),
        child: Scrollbar(
          controller: _scroll,
          thumbVisibility: true,
          child: ListView.separated(
            key: widget.listKey,
            controller: _scroll,
            primary: false,
            shrinkWrap: true,
            physics: const ClampingScrollPhysics(),
            padding: const EdgeInsets.only(right: 12),
            itemCount: widget.itemCount,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: widget.itemBuilder,
          ),
        ),
      ),
    ],
  );
}

class _PreparationListCard extends StatelessWidget {
  const _PreparationListCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.grey0,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );
}

class _VocabularyCard extends StatelessWidget {
  const _VocabularyCard(this.item);

  final Json item;

  @override
  Widget build(BuildContext context) => _PreparationListCard(
    children: [
      Text(
        item['word'].toString(),
        style: designText(
          17,
          weight: FontWeight.w700,
          color: AppColors.primary700,
        ),
      ),
      const SizedBox(height: 4),
      learningBody(item['meaningVi'].toString(), size: 14),
      const SizedBox(height: 8),
      DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.grey50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Text(
            item['example'].toString(),
            style: designText(14, height: 1.45),
          ),
        ),
      ),
    ],
  );
}

class _SentenceCard extends StatelessWidget {
  const _SentenceCard(this.item);

  final Json item;

  @override
  Widget build(BuildContext context) => _PreparationListCard(
    children: [
      Text(
        item['text'].toString(),
        style: designText(16, weight: FontWeight.w600, height: 1.45),
      ),
      const SizedBox(height: 6),
      Text(
        item['meaningVi'].toString(),
        style: designText(14, color: AppColors.grey800, height: 1.45),
      ),
    ],
  );
}

class _Phrase extends StatelessWidget {
  const _Phrase(this.item);
  final Json item;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        item['text'].toString(),
        style: designText(15, weight: FontWeight.w500),
      ),
      const SizedBox(height: 4),
      learningBody(item['meaningVi'].toString(), size: 14),
    ],
  );
}
