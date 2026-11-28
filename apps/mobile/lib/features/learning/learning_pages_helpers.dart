part of 'learning_pages.dart';

extension _LearningAttemptPageHelpers on _LearningAttemptPageState {
  Widget _result(LearningAttempt attempt) => LearningAttemptResultView(
    owner: widget.owner,
    controller: controller,
    attempt: attempt,
    audio: _audio,
    onLeave: leave,
    onRetryStandard: () async {
      final lessonId = attempt.lesson.id;
      await _audio?.pause();
      if (!mounted) return;
      await controller.load(lessonId: lessonId);
    },
  );

  Widget _passageCard(String passage, {String? highlightText}) {
    return PassageCard(
      passage: passage,
      highlightText: highlightText,
      practice: true,
      onExpandedChanged: (expanded) => _viewingPassage = expanded,
      onInteraction: () => activity?.touch(),
    );
  }

  Future<void> _chooseQuestion(LearningAttempt attempt, int current) async {
    final questions = attempt.questions;
    final firstUnchecked = questions.indexWhere(
      (question) =>
          attempt.answer(question['id'] as String)?['checked'] != true,
    );
    final index = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Danh sách câu hỏi', style: designHeading(20)),
              for (final (i, question) in questions.indexed)
                ListTile(
                  title: Text('Câu ${i + 1}'),
                  selected: i == current,
                  subtitle: Text(
                    attempt.answer(question['id'] as String)?['checked'] == true
                        ? 'Đã kiểm tra'
                        : 'Chưa kiểm tra',
                  ),
                  enabled: firstUnchecked < 0 || i <= firstUnchecked,
                  onTap: () => Navigator.pop(sheetContext, i),
                ),
            ],
          ),
        ),
      ),
    );
    if (mounted && index != null && index != current) {
      await controller.move('QUIZ', index);
    }
  }
}
