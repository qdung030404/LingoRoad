part of 'srs_review_page.dart';

extension _SrsReviewCards on _SrsReviewPageState {
  Widget _ratingTransition(Widget child) => AnimatedBuilder(
    animation: ratingMotion,
    child: child,
    builder: (context, child) {
      final progress = Curves.easeInOutCubic.transform(ratingMotion.value);
      return Opacity(
        key: const Key('ratingCardFade'),
        opacity: 1 - progress,
        child: Transform.translate(
          offset: Offset((enteringCard ? 1 : -1) * progress * 48, 0),
          child: child,
        ),
      );
    },
  );

  Widget _swipeFeedback(double width) {
    final skipWord = dragOffset < 0;
    final color = skipWord ? const Color(0xFFDC2626) : const Color(0xFF16A34A);
    final progress = (dragOffset.abs() / (width * .25)).clamp(0.0, 1.0);
    return Positioned.fill(
      child: IgnorePointer(
        child: ExcludeSemantics(
          child: Opacity(
            key: const Key('flashcardSwipeFeedback'),
            opacity: progress,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: color.withValues(alpha: .14),
                border: Border.all(color: color, width: 2),
                borderRadius: AppRadius.cardRadius,
              ),
              alignment: skipWord ? Alignment.topRight : Alignment.topLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .95),
                  border: Border.all(color: color, width: 2),
                  borderRadius: AppRadius.tagRadius,
                ),
                child: Text(
                  skipWord ? '← Bỏ qua' : 'Ôn lại sau →',
                  key: const Key('flashcardSwipeLabel'),
                  style: designText(18, weight: FontWeight.w600, color: color),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  PreviewWord? get fixture => sampleWordDecks
      .expand((d) => d.words)
      .where((w) => w.id == word.id)
      .firstOrNull;
  String get phonetic {
    // Only recover known fixture metadata for older saved decks, not custom words.
    final part = word.partOfSpeech.isNotEmpty
        ? word.partOfSpeech
        : fixture?.partOfSpeech ?? '';
    return [word.phonetic, part].where((s) => s.isNotEmpty).join(' · ');
  }

  String get translation => word.translation.isNotEmpty
      ? word.translation
      : fixture?.example == word.example
      ? fixture?.translation ?? ''
      : '';

  Widget _frontCard() => Container(
    height: 400,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.grey5,
      border: Border.all(color: AppColors.grey100),
      borderRadius: AppRadius.cardRadius,
      boxShadow: AppShadows.level1,
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          word.word,
          textAlign: TextAlign.center,
          style: designHeading(36, height: 1),
        ),
        if (phonetic.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            phonetic,
            textAlign: TextAlign.center,
            style: designText(
              18,
              weight: FontWeight.w500,
              color: AppColors.grey800,
            ),
          ),
        ],
        const SizedBox(height: 16),
        _audio(),
      ],
    ),
  );

  Widget _meaningCard() => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 400),
    child: Center(
      child: FigmaCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (word.word.toLowerCase() == 'mother') ...[
              ClipRRect(
                borderRadius: AppRadius.tagRadius,
                child: SizedBox(
                  height: 180,
                  width: double.infinity,
                  child: LayoutBuilder(
                    builder: (context, bounds) => OverflowBox(
                      alignment: Alignment.topCenter,
                      maxHeight: 329,
                      child: FigmaAsset(
                        'vocabulary-word/imgImage59',
                        width: bounds.maxWidth,
                        height: 329,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(word.word, style: designHeading(36, height: 1)),
                      if (phonetic.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          phonetic,
                          style: designText(
                            18,
                            weight: FontWeight.w500,
                            color: AppColors.grey800,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        'Định nghĩa : ${word.meaning}',
                        style: designText(18, weight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _audio(),
              ],
            ),
            if (word.example.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(height: 1, color: AppColors.grey100),
              ),
              _example(),
              if (translation.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  translation,
                  style: designText(
                    18,
                    weight: FontWeight.w500,
                    color: AppColors.grey800,
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    ),
  );

  Widget _example() {
    final offset = word.example.toLowerCase().indexOf(word.word.toLowerCase());
    return Text.rich(
      TextSpan(
        style: designText(18, weight: FontWeight.w500),
        children: offset < 0
            ? [TextSpan(text: word.example)]
            : [
                TextSpan(
                  text: word.example.substring(0, offset + word.word.length),
                  style: const TextStyle(
                    color: AppColors.primary500,
                    decoration: TextDecoration.underline,
                  ),
                ),
                TextSpan(
                  text: word.example.substring(offset + word.word.length),
                ),
              ],
      ),
    );
  }

  Widget _audio() {
    final key = word.word.toLowerCase();
    if (const [
      'mother',
      'father',
      'sister',
      'brother',
      'parents',
      'grandmother',
      'grandfather',
      'daughter',
      'son',
      'family',
    ].contains(key)) {
      return SampleAudio(
        key: ValueKey('review-audio-${word.id}-$stage'),
        asset: key,
        label: 'Nghe ${word.word}',
        dark: true,
      );
    }
    return IconButton(
      tooltip: 'Nghe ${word.word}',
      onPressed: () =>
          previewMessage(context, 'Từ này chưa có audio trong bản mẫu.'),
      style: IconButton.styleFrom(
        backgroundColor: AppColors.grey900,
        fixedSize: const Size(48, 48),
      ),
      icon: const FigmaAsset(
        'vocabulary-word/imgVuesaxLinearVolumeHigh',
        size: 20,
      ),
    );
  }

  Widget _difficultyChoices() => Wrap(
    alignment: WrapAlignment.center,
    spacing: 12,
    runSpacing: 8,
    children: [
      for (final item in [
        (
          'Dễ',
          'remember',
          const Color(0xFF0A5D21),
          const Color(0xFFEDFAF0),
          const Color(0xFF93F3AA),
        ),
        (
          'Trung bình',
          'hard',
          const Color(0xFFCA8A04),
          const Color(0xFFFFF7EA),
          const Color(0xFFF4DFB2),
        ),
        (
          'Khó',
          'forgot',
          const Color(0xFF861C13),
          const Color(0xFFFDF4F3),
          const Color(0xFFFCD0CC),
        ),
      ])
        Semantics(
          selected: selectedRating == item.$2,
          child: OutlinedButton(
            key: Key('srs-${item.$2}'),
            onPressed: busy ? null : () => rateAndAdvance(item.$2, quick: true),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              backgroundColor: selectedRating == item.$2 ? item.$3 : item.$4,
              disabledBackgroundColor: selectedRating == item.$2
                  ? item.$3
                  : item.$4,
              foregroundColor: item.$3,
              disabledForegroundColor: selectedRating == item.$2
                  ? Colors.white
                  : item.$3,
              side: BorderSide(
                color: selectedRating == item.$2 ? item.$3 : item.$5,
                width: selectedRating == item.$2 ? 2 : 1,
              ),
            ),
            child: Text(
              item.$1,
              style: designText(
                14,
                weight: selectedRating == item.$2
                    ? FontWeight.w700
                    : FontWeight.w500,
                color: selectedRating == item.$2 ? Colors.white : item.$3,
              ),
            ),
          ),
        ),
    ],
  );

  Widget _recall() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      FigmaCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _audio(),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (phonetic.isNotEmpty)
                    Text(
                      phonetic,
                      style: designText(
                        18,
                        weight: FontWeight.w500,
                        color: AppColors.grey800,
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    'Định nghĩa : ${word.meaning}',
                    style: designText(18, weight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 32),
      Text('Viết lại từ', style: designHeading(18)),
      const SizedBox(height: 24),
      TextField(
        key: const Key('wordRecallAnswer'),
        controller: answer,
        enabled: !busy,
        autocorrect: false,
        enableSuggestions: false,
        textInputAction: TextInputAction.done,
        minLines: 4,
        maxLines: 4,
        style: designText(14),
        onChanged: (_) => updateState(() {
          checked = false;
          inputError = null;
        }),
        onSubmitted: (_) => next(),
        decoration: InputDecoration(
          hintText: 'Đáp án của bạn....',
          hintStyle: designText(14, color: AppColors.grey800),
          errorText: inputError,
          filled: true,
          fillColor: const Color(0xFFEDF1F6),
          contentPadding: const EdgeInsets.all(12),
          enabledBorder: const OutlineInputBorder(
            borderRadius: AppRadius.tagRadius,
            borderSide: BorderSide(color: AppColors.primary500),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: AppRadius.tagRadius,
            borderSide: BorderSide(color: AppColors.primary500),
          ),
        ),
      ),
      if (checked) ...[
        const SizedBox(height: 16),
        Semantics(
          liveRegion: true,
          child: Text(
            correct ? 'Chính xác!' : 'Chưa đúng. Đáp án: ${word.word}',
            style: designText(
              16,
              weight: FontWeight.w500,
              color: correct ? AppColors.primary600 : const Color(0xFF861C13),
            ),
          ),
        ),
      ],
    ],
  );

  Widget _toolbar() => Row(
    children: [
      SizedBox(
        width: 48,
        height: 48,
        child: OutlinedButton(
          key: const Key('wordPracticeBack'),
          onPressed: busy || (index == 0 && stage == 0) ? null : previous,
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            shape: const RoundedRectangleBorder(
              borderRadius: AppRadius.tagRadius,
            ),
            backgroundColor: Colors.white,
          ),
          child: const FigmaAsset('intro/imgVuesaxLinearArrowLeft', size: 20),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _action(
          'Bỏ từ này',
          skip,
          secondary: true,
          key: const Key('skipPracticeWord'),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _action('Tiếp theo', next, key: const Key('wordPracticeNext')),
      ),
    ],
  );

  Widget _action(
    String text,
    VoidCallback onTap, {
    bool secondary = false,
    Key? key,
  }) => SizedBox(
    height: 48,
    child: FilledButton(
      key: key,
      onPressed: busy ? null : onTap,
      style: FilledButton.styleFrom(
        backgroundColor: secondary ? Colors.white : AppColors.grey900,
        foregroundColor: secondary ? AppColors.grey900 : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        side: secondary ? const BorderSide(color: AppColors.grey200) : null,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.tagRadius),
      ),
      child: Text(
        text,
        style: designText(
          18,
          weight: FontWeight.w500,
          color: secondary ? AppColors.grey900 : Colors.white,
        ),
      ),
    ),
  );

  Widget _completion() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      FigmaCard(
        key: const Key('wordReviewCompletion'),
        child: Column(
          children: [
            Text(
              deck.words.isEmpty ? 'Bộ từ chưa có từ vựng' : 'Bạn đã ôn hết từ',
              textAlign: TextAlign.center,
              style: designHeading(28, height: 1),
            ),
            const SizedBox(height: 12),
            Text(
              deck.words.isEmpty
                  ? 'Thêm từ vào bộ từ để bắt đầu ôn tập.'
                  : 'Không còn từ vựng mới để ôn tập nữa',
              textAlign: TextAlign.center,
              style: designText(
                18,
                weight: FontWeight.w500,
                color: AppColors.grey800,
              ),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _completionActions() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      CustomAppButton(
        key: const Key('replayWordDeck'),
        text: 'Ôn lại tiếp',
        onPressed: busy || deck.words.isEmpty ? null : replay,
      ),
      const SizedBox(height: 16),
      CustomAppButton(
        key: const Key('returnToMyWords'),
        text: 'Quay về trang từ vựng',
        isSecondary: true,
        onPressed: busy ? null : returnToWords,
      ),
    ],
  );
}

