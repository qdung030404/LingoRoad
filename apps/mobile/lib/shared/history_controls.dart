import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_colors.dart';
import 'figma_widgets.dart';

TextStyle historyHeading(double size) =>
    designHeading(size).copyWith(fontWeight: FontWeight.w500);

TextStyle historyText(
  double size, {
  Color color = AppColors.grey900,
  FontWeight weight = FontWeight.w400,
}) => designText(
  size,
  color: color,
  weight: weight,
).copyWith(fontFamily: 'Inter');

ButtonStyle historyButtonStyle(Color color) => FilledButton.styleFrom(
  minimumSize: const Size(0, 48),
  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
  backgroundColor: color,
  foregroundColor: AppColors.grey0,
  textStyle: historyText(16, weight: FontWeight.w500),
);

class _HistoryConfirmSheet extends StatelessWidget {
  const _HistoryConfirmSheet({
    required this.count,
    required this.preview,
    required this.retentionMessage,
  });

  final int count;
  final List<({String title, String date})> preview;
  final String retentionMessage;

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: const EdgeInsets.fromLTRB(8, 0, 8, 8),
    child: Material(
      color: AppColors.grey0,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.error0,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const HistoryIcon(HistoryIcon.trash),
              ),
            ),
            const SizedBox(height: 8),
            Semantics(
              header: true,
              child: Text(
                'Xóa $count lượt khỏi lịch sử?',
                style: historyHeading(24),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              retentionMessage,
              style: historyText(14, color: AppColors.grey800),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              decoration: BoxDecoration(
                color: AppColors.grey25,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, item) in preview.indexed)
                    Padding(
                      padding: EdgeInsets.only(top: index == 0 ? 0 : 9),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: historyText(14, weight: FontWeight.w600),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            item.date,
                            style: historyText(12, color: AppColors.grey800),
                          ),
                        ],
                      ),
                    ),
                  if (count > preview.length)
                    Padding(
                      padding: const EdgeInsets.only(top: 9),
                      child: Text(
                        'Và ${count - preview.length} lượt khác',
                        style: historyText(12, color: AppColors.grey800),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 48),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      foregroundColor: AppColors.grey900,
                      side: const BorderSide(color: AppColors.grey100),
                      textStyle: historyText(16, weight: FontWeight.w500),
                    ),
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Hủy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    style: historyButtonStyle(AppColors.error200),
                    onPressed: () => Navigator.of(context).pop(true),
                    child: Text('Xóa $count lượt', textAlign: TextAlign.center),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class HistoryIcon extends StatelessWidget {
  const HistoryIcon(this.paths, {super.key, this.color});

  static const back =
      '<path d="m14.75 5.5-5.7 5.7a1.13 1.13 0 0 0 0 1.6l5.7 5.7"/>';
  static const next = '<path d="m10 7 4.45 4.45a.78.78 0 0 1 0 1.1L10 17"/>';
  static const close = '<path d="m7 7 10 10m0-10L7 17"/>';
  static const trash =
      '<path d="M5 7.5h14M9 7.5V6.3a1.6 1.6 0 0 1 1.6-1.6h2.8'
      'A1.6 1.6 0 0 1 15 6.3v1.2M6.7 7.5l.65 9.57a2 2 0 0 0 2 1.87h5.3'
      'a2 2 0 0 0 2-1.87l.65-9.57M10.3 10.8v4.9m3.4-4.9v4.9"/>';

  final String paths;
  final Color? color;

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
    'stroke="black" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">'
    '$paths</svg>',
    width: 24,
    height: 24,
    colorFilter: ColorFilter.mode(
      color ?? IconTheme.of(context).color ?? AppColors.grey900,
      BlendMode.srcIn,
    ),
  );
}

class HistorySelectionAction extends StatelessWidget {
  const HistorySelectionAction({
    super.key,
    required this.selecting,
    required this.onPressed,
  });

  final bool selecting;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Center(
    child: IconButton(
      tooltip: selecting ? 'Thoát chế độ chọn' : 'Chọn lượt để xóa',
      onPressed: onPressed,
      style: IconButton.styleFrom(
        fixedSize: Size.square(selecting ? 44 : 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        backgroundColor: selecting ? AppColors.error0 : AppColors.grey0,
        foregroundColor: selecting ? AppColors.error300 : AppColors.grey900,
        side: BorderSide(
          color: selecting ? AppColors.error25 : AppColors.grey100,
        ),
      ),
      icon: HistoryIcon(selecting ? HistoryIcon.close : HistoryIcon.trash),
    ),
  );
}

class HistorySelectionMark extends StatelessWidget {
  const HistorySelectionMark({
    super.key,
    required this.title,
    required this.selected,
    this.onTap,
  });

  final String title;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: 'Chọn lượt $title',
    checked: selected,
    enabled: onTap != null,
    onTap: onTap,
    child: selected
        ? const FigmaAsset('review/imgVuesaxLinearTickCircle')
        : Icon(
            Icons.radio_button_unchecked,
            size: 22,
            color: onTap != null ? AppColors.grey700 : AppColors.grey400,
          ),
  );
}

class HistorySelectionBar extends StatelessWidget {
  const HistorySelectionBar({
    super.key,
    required this.count,
    required this.saving,
    required this.duration,
    required this.onDelete,
  });

  final int count;
  final bool saving;
  final Duration duration;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    duration: duration,
    curve: Curves.easeOutCubic,
    tween: Tween(begin: 0, end: 1),
    builder: (context, value, child) => Opacity(
      opacity: value,
      child: Transform.translate(
        offset: Offset(0, 8 * (1 - value)),
        child: child,
      ),
    ),
    child: Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.fromLTRB(16, 9, 10, 9),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.grey100),
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                count == 0 ? 'Chưa chọn lượt nào' : 'Đã chọn $count lượt',
                style: historyText(
                  14,
                  color: count == 0 ? AppColors.grey800 : AppColors.grey900,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          FilledButton(
            style: historyButtonStyle(
              AppColors.grey900,
            ).copyWith(minimumSize: const WidgetStatePropertyAll(Size(96, 48))),
            onPressed: saving || count == 0 ? null : onDelete,
            child: saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Xóa'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> confirmHistoryHide(
  BuildContext context, {
  required int count,
  required List<({String title, String date})> preview,
  String retentionMessage = 'Điểm và tiến độ học đã ghi nhận vẫn được giữ.',
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: Colors.transparent,
  barrierColor: AppColors.grey900.withValues(alpha: .36),
  sheetAnimationStyle: MediaQuery.disableAnimationsOf(context)
      ? AnimationStyle.noAnimation
      : const AnimationStyle(
          duration: Duration(milliseconds: 220),
          reverseDuration: Duration(milliseconds: 180),
        ),
  builder: (context) => _HistoryConfirmSheet(
    count: count,
    preview: preview,
    retentionMessage: retentionMessage,
  ),
);

SnackBar historyHiddenMessage(int count) => SnackBar(
  content: Text(
    'Đã xóa $count lượt khỏi lịch sử',
    style: historyText(14, color: AppColors.grey0),
  ),
  backgroundColor: AppColors.primary900,
  behavior: SnackBarBehavior.floating,
  margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
);
