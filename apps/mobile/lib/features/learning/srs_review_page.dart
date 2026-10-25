import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'sample_audio.dart';
import 'word_library.dart';

class SrsReviewPage extends StatefulWidget {
  const SrsReviewPage({
    super.key,
    required this.library,
    required this.deckId,
    this.onNavigate,
  });
  final WordLibrary library;
  final String deckId;
  final ValueChanged<int>? onNavigate;
  @override
  State<SrsReviewPage> createState() => _SrsReviewPageState();
}

class _SrsReviewPageState extends State<SrsReviewPage> {
  static const ink = Color(0xFF1B1C1C),
      brown = Color(0xFF5C403A),
      red = Color(0xFFB22300);
  late final deck = widget.library.decks.firstWhere(
    (d) => d.id == widget.deckId,
  );
  late final words = widget.library.due(deck);
  int index = 0;
  bool back = false, busy = false;
  TextStyle text(
    double size, {
    FontWeight weight = FontWeight.w400,
    Color color = ink,
    double height = 1.5,
  }) => TextStyle(
    fontFamily: 'Hanken Grotesk',
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    fontVariations: [ui.FontVariation('wght', weight.value.toDouble())],
    letterSpacing: size >= 32 ? -size * .02 : null,
  );

  Future<void> rate(String value) async {
    if (busy || index >= words.length) return;
    setState(() => busy = true);
    try {
      await widget.library.rate(words[index], value);
      if (mounted) {
        setState(() {
          index++;
          back = false;
        });
      }
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không lưu được lượt ôn. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.dark.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: Colors.white,
    ),
    child: PreviewSurface(
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Container(
                height: 64,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                decoration: const BoxDecoration(
                  color: Color(0xFFFBF9F9),
                  borderRadius: BorderRadius.vertical(
                    bottom: Radius.circular(24),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      tooltip: 'Quay lại',
                      onPressed: () => Navigator.pop(context),
                      padding: EdgeInsets.zero,
                      icon: Container(
                        width: 32,
                        height: 32,
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEDEBEB),
                          shape: BoxShape.circle,
                        ),
                        child: const FigmaAsset(
                          'srs/imgAvatarPlaceholder',
                          size: 16,
                        ),
                      ),
                    ),
                    Text(
                      'lingoRoad',
                      style: const TextStyle(
                        fontFamily: 'Madimi One',
                        fontSize: 22,
                        color: red,
                      ),
                    ),
                    Row(
                      children: [
                        const FigmaAsset('srs/imgContainer5', size: 20),
                        const SizedBox(width: 8),
                        Text(
                          '12',
                          style: text(14, weight: FontWeight.w600, color: red),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, bounds) => SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: bounds.maxHeight),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                        child: Column(
                          children: [
                            Text(
                              index < words.length
                                  ? 'Ôn tập hôm nay'
                                  : 'Hoàn thành ôn tập',
                              style: text(
                                32,
                                weight: FontWeight.w700,
                                height: 1.25,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Còn lại ${words.length - index} mục',
                              style: text(16, color: brown),
                            ),
                            const SizedBox(height: 24),
                            LinearProgressIndicator(
                              value: deck.words.isEmpty
                                  ? 1
                                  : (deck.words.length - words.length + index) /
                                        deck.words.length,
                              minHeight: 8,
                              borderRadius: BorderRadius.circular(99),
                              color: red,
                              backgroundColor: const Color(0xFFE8E8E8),
                            ),
                            if (index < words.length) ...[
                              SizedBox(
                                height: (bounds.maxHeight * .12).clamp(24, 80),
                              ),
                              Semantics(
                                button: true,
                                label: back
                                    ? 'Xem mặt trước'
                                    : 'Lật thẻ xem nghĩa',
                                child: GestureDetector(
                                  key: const Key('srsFlashcard'),
                                  onTap: busy
                                      ? null
                                      : () => setState(() => back = !back),
                                  child: TweenAnimationBuilder<double>(
                                    key: ValueKey(words[index].id),
                                    duration:
                                        MediaQuery.disableAnimationsOf(context)
                                        ? Duration.zero
                                        : const Duration(milliseconds: 320),
                                    curve: Curves.easeInOutCubic,
                                    tween: Tween(end: back ? 1 : 0),
                                    builder: (context, value, _) {
                                      final showingBack = value > .5;
                                      return Transform(
                                        alignment: Alignment.center,
                                        transform: Matrix4.identity()
                                          ..setEntry(3, 2, .001)
                                          ..rotateY(value * math.pi),
                                        child: Transform(
                                          alignment: Alignment.center,
                                          transform: Matrix4.rotationY(
                                            showingBack ? math.pi : 0,
                                          ),
                                          child: _card(
                                            context,
                                            showingBack,
                                            bounds.maxHeight,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (back)
                                Row(
                                  children: [
                                    for (final rating in [
                                      ('Nhớ', 'remember'),
                                      ('Khó', 'hard'),
                                      ('Quên', 'forgot'),
                                    ]) ...[
                                      if (rating.$2 != 'remember')
                                        const SizedBox(width: 8),
                                      Expanded(
                                        child: OutlinedButton(
                                          key: Key('srs-${rating.$2}'),
                                          onPressed: busy
                                              ? null
                                              : () => rate(rating.$2),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor:
                                                rating.$2 == 'remember'
                                                ? const Color(0xFF418A54)
                                                : red,
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 14,
                                            ),
                                            side: const BorderSide(
                                              color: Color(0xFFE5BEB5),
                                            ),
                                          ),
                                          child: Text(
                                            rating.$1,
                                            style: text(
                                              16,
                                              color: rating.$2 == 'remember'
                                                  ? const Color(0xFF418A54)
                                                  : red,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                            ] else ...[
                              const SizedBox(height: 80),
                              const Icon(
                                Icons.check_circle_outline,
                                size: 80,
                                color: Color(0xFF418A54),
                              ),
                              const SizedBox(height: 24),
                              Text(
                                words.isEmpty
                                    ? 'Bạn đã nhớ tất cả các từ trong bộ này.'
                                    : 'Đã lưu ${words.length} lượt ôn trên thiết bị.',
                                style: text(18, color: brown),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 24),
                              FilledButton(
                                onPressed: () => Navigator.pop(context),
                                style: FilledButton.styleFrom(
                                  backgroundColor: red,
                                ),
                                child: const Text('Trở về bộ từ'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF9F9),
                  borderRadius: BorderRadius.circular(24),
                  border: const Border(
                    top: BorderSide(color: Color(0xFFE5BEB5)),
                  ),
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < 5; i++)
                      Expanded(
                        child: InkWell(
                          onTap: i == 2
                              ? null
                              : () {
                                  if (widget.onNavigate != null) {
                                    widget.onNavigate!([0, 1, 2, 4, 5][i]);
                                  } else {
                                    Navigator.pop(context);
                                  }
                                },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            decoration: BoxDecoration(
                              color: i == 2
                                  ? const Color(0xFFFFDAD1)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                FigmaAsset(
                                  'srs/imgContainer${i == 0 ? '' : i}',
                                  size: 20,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  [
                                    'Học',
                                    'Lộ trình',
                                    'Ôn tập',
                                    'Tiến độ',
                                    'Hồ sơ',
                                  ][i],
                                  style: text(
                                    12,
                                    weight: FontWeight.w500,
                                    color: i == 2 ? red : brown,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _card(BuildContext context, bool showingBack, double height) {
    final word = words[index];
    final audioKey = word.word.toLowerCase();
    final hasAudio = [
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
    ].contains(audioKey);
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(minHeight: (height * .65).clamp(300, 466.67)),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE2E2E2)),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 15,
            spreadRadius: -3,
            offset: Offset(0, 10),
          ),
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 6,
            spreadRadius: -4,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        children: [
          SizedBox(
            height: (height * .65).clamp(300, 466.67) - 48,
            width: double.infinity,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0EDED),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    'TỪ VỰNG',
                    style: text(
                      12,
                      weight: FontWeight.w500,
                      color: brown,
                      height: 1.33,
                    ).copyWith(letterSpacing: 1.2),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  word.word,
                  style: text(32, weight: FontWeight.w700, height: 1.25),
                  textAlign: TextAlign.center,
                ),
                if (showingBack) ...[
                  const SizedBox(height: 16),
                  Text(
                    word.meaning,
                    style: text(20, color: brown),
                    textAlign: TextAlign.center,
                  ),
                  if (word.example.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      word.example,
                      style: text(16, color: brown),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ],
            ),
          ),
          Positioned(
            top: 0,
            right: 0,
            child: hasAudio
                ? SampleAudio(
                    key: ValueKey(word.id),
                    asset: audioKey,
                    dark: true,
                    minimal: true,
                  )
                : IconButton(
                    tooltip: 'Nghe phát âm',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    onPressed: () => previewMessage(
                      context,
                      'Từ này chưa có audio trong bản mẫu.',
                    ),
                    icon: const FigmaAsset('srs/imgContainer6', size: 20),
                  ),
          ),
        ],
      ),
    );
  }
}
