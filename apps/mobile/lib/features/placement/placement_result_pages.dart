import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import '../learning/learning_preview.dart';
import '../profile/profile_page.dart';
import 'audio_controls.dart';

void openProfile(BuildContext context, SessionController session) =>
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ProfilePage(session: session)),
    );

Widget profileAction(BuildContext context, SessionController session) =>
    IconButton(
      tooltip: 'Hồ sơ của tôi',
      onPressed: () => openProfile(context, session),
      icon: const FigmaAsset('register/imgVuesaxBulkUserSquare', size: 20),
    );

class PassageCard extends StatelessWidget {
  const PassageCard({super.key, required this.passage});
  final String passage;
  @override
  Widget build(BuildContext context) => FigmaCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Đoạn văn', style: designText(18, weight: FontWeight.w500)),
            Text(
              '${passage.trim().split(RegExp(r'\s+')).length} từ',
              style: designText(12, color: AppColors.grey600),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text(
          passage,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: designText(14, color: AppColors.grey800, height: 1.4),
        ),
        const SizedBox(height: 16),
        InkWell(
          onTap: () => showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            showDragHandle: true,
            builder: (_) => SafeArea(
              child: FractionallySizedBox(
                heightFactor: .75,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Đoạn văn', style: designHeading(20)),
                      const SizedBox(height: 24),
                      Text(passage, style: designText(16, height: 1.6)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FigmaAsset('reading/imgVuesaxLinearMaximize4', size: 16),
              const SizedBox(width: 8),
              Text(
                'Xem toàn bộ',
                style: designText(
                  14,
                  weight: FontWeight.w500,
                  color: AppColors.primary500,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class ResultPage extends StatefulWidget {
  const ResultPage({
    super.key,
    required this.session,
    required this.sessionId,
    this.initialResult,
  });
  final SessionController session;
  final String sessionId;
  final Json? initialResult;
  @override
  State<ResultPage> createState() => _ResultPageState();
}

class _ResultPageState extends State<ResultPage> {
  late Future<Json> future = widget.initialResult != null
      ? Future.value(widget.initialResult!)
      : widget.session.api.request(
          'GET',
          '/placement/${widget.sessionId}/result',
        );
  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: future,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return FigmaPage(
          child: snapshot.hasError
              ? PageBody(
                  children: [
                    ErrorNotice(
                      errorMessage(snapshot.error!),
                      onRetry: () => setState(() {
                        future = widget.session.api.request(
                          'GET',
                          '/placement/${widget.sessionId}/result',
                        );
                      }),
                    ),
                  ],
                )
              : const Center(child: CircularProgressIndicator()),
        );
      }
      final result = snapshot.data!;
      return FigmaPage(
        bottom: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomAppButton(
              text: 'Bắt đầu học',
              onPressed: () {
                widget.session.placementResult = result;
                widget.session.placement = {
                  ...widget.session.placement,
                  'status': 'COMPLETED',
                  'currentSessionId': widget.sessionId,
                };
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute<void>(
                    settings: const RouteSettings(
                      name: LearningPreview.routeName,
                    ),
                    builder: (_) => LearningPreview(
                      account: widget.session,
                      onLogout: widget.session.logout,
                    ),
                  ),
                  (_) => false,
                );
              },
            ),
            const SizedBox(height: 12),
            CustomAppButton(
              text: 'Xem lại bài làm',
              isSecondary: true,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ReviewPage(
                    session: widget.session,
                    sessionId: widget.sessionId,
                  ),
                ),
              ),
            ),
          ],
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    'Đây là điểm\nxuất phát của bạn',
                    style: designHeading(28, height: 1),
                  ),
                ),
                profileAction(context, widget.session),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Đây là đánh giá ban đầu về năng lực tiếng Anh của bạn dựa trên bài kiểm tra vừa rồi.',
              style: designText(16, color: AppColors.grey800),
            ),
            const SizedBox(height: 32),
            for (final skill in {
              'reading': 'Đọc',
              'listening': 'Nghe',
              'speaking': 'Nói',
              'writing': 'Viết',
            }.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _SkillCard(
                  name: skill.value,
                  data:
                      ((result['skills'] as Map<Object?, Object?>? ??
                              const {})[skill.key]
                          as Map<Object?, Object?>?) ??
                      const {},
                ),
              ),
            Text(
              'CEFR ${result['estimatedCefr']} · ${result['correctCount']}/${result['totalItems']} câu đúng',
              style: designText(12, color: AppColors.grey800),
            ),
            const SizedBox(height: 8),
            Text(
              'Kết quả sơ bộ theo tỷ lệ trả lời đúng; chưa phải chứng nhận CEFR.',
              style: designText(12, color: AppColors.grey800),
            ),
          ],
        ),
      );
    },
  );
}

class _SkillCard extends StatelessWidget {
  const _SkillCard({required this.name, required this.data});
  final String name;
  final Map<Object?, Object?> data;
  @override
  Widget build(BuildContext context) {
    final level = data['estimatedCefr'] as String?;
    final assessed = level != null && data['status'] != 'NOT_ASSESSED';
    return FigmaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: designText(16, weight: FontWeight.w500),
                ),
              ),
              if (assessed)
                Expanded(
                  child: Text(
                    level,
                    textAlign: TextAlign.center,
                    style: designHeading(20, color: AppColors.primary500),
                  ),
                ),
              Expanded(
                child: Text(
                  assessed
                      ? 'Sơ bộ · ${data['correctCount']}/${data['totalItems']}'
                      : 'Chưa đánh giá',
                  style: designText(12),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          if (assessed) ...[
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final value in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: value == level
                          ? AppColors.primary25
                          : Colors.white,
                      border: Border.all(
                        color: value == level
                            ? AppColors.primary200
                            : AppColors.grey200,
                      ),
                      borderRadius: AppRadius.tagRadius,
                    ),
                    child: Text(
                      value,
                      style: designText(
                        14,
                        weight: FontWeight.w500,
                        color: value == level
                            ? AppColors.primary500
                            : AppColors.grey900,
                      ),
                    ),
                  ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 8),
            Text(
              'Đánh giá kỹ năng $name →',
              style: designText(
                14,
                color: AppColors.primary500,
              ).copyWith(decoration: TextDecoration.underline),
            ),
          ],
        ],
      ),
    );
  }
}

class ReviewPage extends StatefulWidget {
  const ReviewPage({
    super.key,
    required this.session,
    required this.sessionId,
    this.initialIndex = 0,
  });
  final SessionController session;
  final String sessionId;
  final int initialIndex;
  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  late Future<Json> future = widget.session.api.request(
    'GET',
    '/placement/${widget.sessionId}/review',
  );
  late int position = widget.initialIndex;
  bool mistakesOnly = false;
  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: future,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return FigmaPage(
          title: 'Xem lại bài làm',
          child: snapshot.hasError
              ? PageBody(
                  children: [
                    ErrorNotice(
                      errorMessage(snapshot.error!),
                      onRetry: () => setState(() {
                        future = widget.session.api.request(
                          'GET',
                          '/placement/${widget.sessionId}/review',
                        );
                      }),
                    ),
                  ],
                )
              : const Center(child: CircularProgressIndicator()),
        );
      }
      final data = snapshot.data!, completed = data['status'] == 'COMPLETED';
      final all = (data['items'] as List).cast<Map<Object?, Object?>>();
      final wrong = all.where((e) => e['isCorrect'] == false).toList();
      final items = mistakesOnly ? wrong : all;
      if (items.isEmpty) {
        return FigmaPage(
          title: 'Xem lại bài làm',
          child: PageBody(
            children: [
              Text(
                mistakesOnly
                    ? 'Không có câu sai.'
                    : 'Bạn chưa nộp câu trả lời nào.',
              ),
              if (mistakesOnly)
                TextButton(
                  onPressed: () => setState(() => mistakesOnly = false),
                  child: const Text('Tất cả'),
                ),
            ],
          ),
        );
      }
      final current = position.clamp(0, items.length - 1);
      final item = items[current];
      final options = (item['options'] as List).cast<String>();
      return FigmaPage(
        title: 'Xem lại câu ${(item['index'] as int) + 1}/${all.length}',
        bottom: Row(
          children: [
            SizedBox(
              width: 48,
              child: CustomAppButton(
                text: '',
                isSecondary: true,
                borderRadius: AppRadius.tagRadius,
                icon: const FigmaAsset(
                  'review/imgVuesaxLinearArrowLeft1',
                  size: 20,
                ),
                onPressed: () => setState(
                  () => position = (current - 1 + items.length) % items.length,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CustomAppButton(
                key: const Key('nextReview'),
                text: mistakesOnly ? 'Câu sai tiếp theo' : 'Câu tiếp theo',
                borderRadius: AppRadius.tagRadius,
                onPressed: () =>
                    setState(() => position = (current + 1) % items.length),
              ),
            ),
          ],
        ),
        child: ListView(
          key: ValueKey('review-${item['index']}'),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          children: [
            Row(
              children: [
                _filter(
                  'Tất cả',
                  !mistakesOnly,
                  () => setState(() {
                    mistakesOnly = false;
                    position = 0;
                  }),
                ),
                if (completed) ...[
                  const SizedBox(width: 12),
                  _filter(
                    'Câu sai (${wrong.length})',
                    mistakesOnly,
                    () => setState(() {
                      mistakesOnly = true;
                      position = 0;
                    }),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            if (item['passage'] is String &&
                (item['passage'] as String).isNotEmpty)
              PassageCard(passage: item['passage'] as String),
            if (item['mediaUrl'] is String)
              AudioControls(
                key: ValueKey('review-audio-${item['index']}'),
                url: Uri.parse(
                  widget.session.api.config.apiBaseUrl,
                ).resolve(item['mediaUrl'] as String).toString(),
              ),
            const SizedBox(height: 32),
            Text(
              item['prompt'] as String,
              style: designText(18, weight: FontWeight.w600),
            ),
            const SizedBox(height: 24),
            for (var i = 0; i < options.length; i++)
              if (options[i] == item['selectedOption'] ||
                  completed && options[i] == item['correctOption'])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AnswerOption(
                    index: i,
                    text: options[i],
                    chosen: item['selectedOption'] == options[i],
                    selected: item['selectedOption'] == options[i],
                    correct: completed
                        ? item['correctOption'] == options[i]
                        : null,
                  ),
                ),
            if (completed && item['explanation'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: FigmaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lời giải',
                        style: designText(18, weight: FontWeight.w500),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        item['explanation'] as String,
                        style: designText(
                          14,
                          color: AppColors.grey800,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(
              completed
                  ? 'Đáp án đã nộp được khóa.'
                  : 'Các câu đã nộp được khóa. Đáp án và giải thích sẽ mở sau khi hoàn tất toàn bài.',
              style: designText(12, color: AppColors.grey800),
            ),
          ],
        ),
      );
    },
  );
  Widget _filter(String text, bool selected, VoidCallback onPressed) =>
      OutlinedButton(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 40),
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          backgroundColor: selected ? AppColors.primary25 : Colors.white,
          side: BorderSide(
            color: selected ? AppColors.primary500 : AppColors.grey200,
          ),
        ),
        onPressed: onPressed,
        child: Text(
          text,
          style: designText(
            14,
            color: selected ? AppColors.primary500 : AppColors.grey900,
          ),
        ),
      );
}
