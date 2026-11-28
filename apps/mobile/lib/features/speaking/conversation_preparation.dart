import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';

part 'conversation_preparation_widgets.dart';

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
  Widget build(BuildContext context) {
    final pageTitle = widget.activities == null
        ? 'Chuẩn bị hội thoại'
        : 'Luyện theo chủ đề';
    final canPop = Navigator.of(context).canPop();

    return FutureBuilder<Json>(
      future: topic,
      builder: (context, snapshot) {
        if (!widget.controller.active ||
            snapshot.connectionState != ConnectionState.done ||
            snapshot.data?['loadError'] == true) {
          return Scaffold(
            backgroundColor: AppColors.grey25,
            appBar: AppBar(
              backgroundColor: AppColors.grey25,
              scrolledUnderElevation: 0,
              titleTextStyle: designHeading(18),
              title: Text(pageTitle),
            ),
            body: !widget.controller.active
                ? const Center(child: Text('Phiên đăng nhập đã thay đổi.'))
                : snapshot.connectionState != ConnectionState.done
                ? const Center(child: CircularProgressIndicator())
                : Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          learningBody(
                            'Chưa tải được hướng dẫn cho chủ đề này.',
                          ),
                          TextButton(
                            onPressed: () => setState(() {
                              topic = load();
                            }),
                            child: const Text('Thử lại'),
                          ),
                        ],
                      ),
                    ),
                  ),
          );
        }

        final data = snapshot.data!;
        final preparation = Map<String, dynamic>.from(
          data['preparation'] as Map? ?? {},
        );
        final vocabulary = speakingItems(preparation['vocabulary']);
        final phrases = speakingItems(preparation['phrases']);
        final help = speakingItems(preparation['helpPhrases']);
        final questions = data['hints'] as List? ?? [];
        final tips = preparation['tips'] as List? ?? [];
        final topicTitle =
            data['title']?.toString() ?? data['text'].toString();
        final goalText =
            preparation['goal']?.toString() ??
            'Xem câu hỏi gợi ý và chuẩn bị câu trả lời của bạn.';
        final heroImageUrl =
            (data['imageUrl'] ?? preparation['sceneImageUrl'])?.toString() ??
            topicIllustrationAsset(topicTitle);

        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light.copyWith(
            statusBarColor: Colors.transparent,
            systemNavigationBarColor: widget.activities == null
                ? Colors.white
                : AppColors.grey25,
            systemNavigationBarIconBrightness: Brightness.dark,
          ),
          child: Scaffold(
            backgroundColor: AppColors.grey25,
            body: SafeArea(
              top: false,
              child: Column(
                children: [
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final isNarrow = constraints.maxWidth < 340;
                        return SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Stage 1: Edge-to-edge Cover Photo + Scrim + Centered Title & Goal
                              Stack(
                                children: [
                                  Positioned.fill(
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        LearningMediaImage(
                                          key: const ValueKey(
                                            'conversation-prep-hero-image',
                                          ),
                                          imageUrl: heroImageUrl,
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          semanticLabel: topicTitle,
                                        ),
                                        const DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              begin: Alignment.topCenter,
                                              end: Alignment.bottomCenter,
                                              colors: [
                                                Color(0x7A0C2215),
                                                Color(0x0D0C2215),
                                                Color(0x45133620),
                                                Color(0xC21B4B2E),
                                                Color(0xF5215937),
                                                Color(0xFF245E3A),
                                              ],
                                              stops: [
                                                0.0,
                                                0.22,
                                                0.46,
                                                0.68,
                                                0.88,
                                                1.0,
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  SafeArea(
                                    bottom: false,
                                    child: Align(
                                      alignment: Alignment.topCenter,
                                      child: ConstrainedBox(
                                        constraints: const BoxConstraints(
                                          maxWidth: 560,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            _SpeakingHeroTopBar(
                                              title: pageTitle,
                                              canPop: canPop,
                                              onBack: () =>
                                                  Navigator.of(context).pop(),
                                            ),
                                            SizedBox(
                                              height: isNarrow ? 96 : 116,
                                            ),
                                            Padding(
                                              padding:
                                                  const EdgeInsets.fromLTRB(
                                                    20,
                                                    0,
                                                    20,
                                                    4,
                                                  ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.center,
                                                children: [
                                                  Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 10,
                                                          vertical: 4,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: const Color(
                                                        0x2BFFFFFF,
                                                      ),
                                                      borderRadius:
                                                          AppRadius.pill,
                                                      border: Border.all(
                                                        color: const Color(
                                                          0x47FFFFFF,
                                                        ),
                                                      ),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        const Icon(
                                                          Icons.forum_outlined,
                                                          size: 13.5,
                                                          color: Colors.white,
                                                        ),
                                                        const SizedBox(
                                                          width: 5,
                                                        ),
                                                        Flexible(
                                                          child: Text(
                                                            widget.activities ==
                                                                    null
                                                                ? 'TRƯỚC KHI BẮT ĐẦU'
                                                                : 'CHỦ ĐỀ LUYỆN NÓI',
                                                            style: designText(
                                                              11,
                                                              weight: FontWeight
                                                                  .w700,
                                                              color:
                                                                  Colors.white,
                                                              height: 1.2,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                  const SizedBox(height: 10),
                                                  Text(
                                                    topicTitle,
                                                    textAlign: TextAlign.center,
                                                    style:
                                                        designHeading(
                                                          isNarrow ? 22 : 25,
                                                          color: Colors.white,
                                                          height: 1.25,
                                                        ).copyWith(
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          shadows: const [
                                                            Shadow(
                                                              color: Color(
                                                                0x3D091A10,
                                                              ),
                                                              blurRadius: 10,
                                                              offset: Offset(
                                                                0,
                                                                2,
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                  ),
                                                  const SizedBox(height: 8),
                                                  Text(
                                                    goalText,
                                                    textAlign: TextAlign.center,
                                                    style: designText(
                                                      14.5,
                                                      weight: FontWeight.w500,
                                                      color: const Color(
                                                        0xECFFFFFF,
                                                      ),
                                                      height: 1.45,
                                                    ),
                                                  ),
                                                  if (widget.activities ==
                                                      null) ...[
                                                    const SizedBox(height: 12),
                                                    Container(
                                                      padding:
                                                          const EdgeInsets.symmetric(
                                                            horizontal: 11,
                                                            vertical: 5,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: const Color(
                                                          0x24FFFFFF,
                                                        ),
                                                        borderRadius:
                                                            AppRadius.pill,
                                                      ),
                                                      child: Row(
                                                        mainAxisSize:
                                                            MainAxisSize.min,
                                                        children: [
                                                          const Icon(
                                                            Icons
                                                                .schedule_rounded,
                                                            size: 16,
                                                            color: Colors.white,
                                                          ),
                                                          const SizedBox(
                                                            width: 6,
                                                          ),
                                                          Flexible(
                                                            child: Text(
                                                              'Tối đa 3 phút · Hỏi đáp bằng tiếng Anh',
                                                              style: designText(
                                                                12.5,
                                                                weight:
                                                                    FontWeight
                                                                        .w600,
                                                                color: Colors
                                                                    .white,
                                                              ),
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
                                    ),
                                  ),
                                ],
                              ),
                              // Stage 2: Seamless S-Curve Emerald-to-Light Dissolve + Body Content
                              Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  const Positioned(
                                    top: -1,
                                    left: 0,
                                    right: 0,
                                    height: 190,
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                          colors: [
                                            Color(0xFF245E3A),
                                            Color(0xFF337A4B),
                                            Color(0xFF53A46B),
                                            Color(0xFF8CC89E),
                                            Color(0xFFC7E6D1),
                                            Color(0xFFE7F3ED),
                                            AppColors.grey25,
                                          ],
                                          stops: [
                                            0.0,
                                            0.20,
                                            0.40,
                                            0.58,
                                            0.75,
                                            0.89,
                                            1.0,
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  Align(
                                    alignment: Alignment.topCenter,
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(
                                        maxWidth: 560,
                                      ),
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          16,
                                          16,
                                          16,
                                          24,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            if (widget.activities != null) ...[
                                              widget.activities!(data),
                                              const SizedBox(height: 20),
                                              learningHeading(
                                                'Học liệu chủ đề',
                                                size: 18,
                                              ),
                                              const SizedBox(height: 12),
                                            ],
                                            _PreparationSection(
                                              collapsible:
                                                  widget.activities != null,
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
                                                    listKey: const ValueKey(
                                                      'suggestedVocabularyList',
                                                    ),
                                                    caption:
                                                        '${vocabulary.length} từ và cụm từ',
                                                    itemCount:
                                                        vocabulary.length,
                                                    itemBuilder: (_, index) =>
                                                        _VocabularyCard(
                                                          vocabulary[index],
                                                        ),
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 12),
                                            _PreparationSection(
                                              collapsible:
                                                  widget.activities != null,
                                              title: 'Mẫu câu thông dụng',
                                              icon: Icons
                                                  .chat_bubble_outline_rounded,
                                              children: [
                                                if (phrases.isEmpty)
                                                  learningBody(
                                                    'Chưa có mẫu câu gợi ý cho chủ đề này.',
                                                    size: 14,
                                                  ),
                                                if (phrases.isNotEmpty)
                                                  _PreparationList(
                                                    listKey: const ValueKey(
                                                      'commonSentencesList',
                                                    ),
                                                    caption:
                                                        '${phrases.length} câu mẫu',
                                                    itemCount: phrases.length,
                                                    itemBuilder: (_, index) =>
                                                        _SentenceCard(
                                                          phrases[index],
                                                        ),
                                                  ),
                                              ],
                                            ),
                                            if (questions.isNotEmpty) ...[
                                              const SizedBox(height: 12),
                                              _PreparationSection(
                                                collapsible:
                                                    widget.activities != null,
                                                title: 'Câu hỏi có thể gặp',
                                                icon:
                                                    Icons.help_outline_rounded,
                                                children: [
                                                  for (
                                                    var i = 0;
                                                    i < questions.length;
                                                    i++
                                                  )
                                                    Row(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Text(
                                                          '${i + 1}.',
                                                          style: designText(
                                                            15,
                                                            color: AppColors
                                                                .primary700,
                                                            weight:
                                                                FontWeight.w600,
                                                          ),
                                                        ),
                                                        const SizedBox(
                                                          width: 12,
                                                        ),
                                                        Expanded(
                                                          child: Text(
                                                            questions[i]
                                                                .toString(),
                                                            style: designText(
                                                              15,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                ],
                                              ),
                                            ],
                                            if (help.isNotEmpty) ...[
                                              const SizedBox(height: 12),
                                              _PreparationSection(
                                                collapsible:
                                                    widget.activities != null,
                                                title: 'Khi cần hỗ trợ',
                                                icon:
                                                    Icons.support_agent_rounded,
                                                children: [
                                                  for (final item in help)
                                                    _Phrase(item),
                                                ],
                                              ),
                                            ],
                                            if (tips.isNotEmpty) ...[
                                              const SizedBox(height: 12),
                                              _PreparationSection(
                                                collapsible:
                                                    widget.activities != null,
                                                title: widget.activities == null
                                                    ? 'Cách luyện'
                                                    : 'Mẹo luyện tập',
                                                icon: Icons
                                                    .lightbulb_outline_rounded,
                                                children: [
                                                  for (final tip in tips)
                                                    Row(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        const Icon(
                                                          Icons.check_rounded,
                                                          size: 18,
                                                          color: AppColors
                                                              .primary700,
                                                        ),
                                                        const SizedBox(
                                                          width: 10,
                                                        ),
                                                        Expanded(
                                                          child: learningBody(
                                                            tip.toString(),
                                                            size: 14,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                ],
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  if (widget.activities == null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(
                          top: BorderSide(color: AppColors.grey100),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            data['enabled'] == true
                                ? 'Bạn chủ động bật và dừng micro trong cuộc gọi.'
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
            ),
          ),
        );
      },
    );
  }
}

