import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';

/// One destination order and geometry for every preview navigation bar.
class PreviewNavigationBar extends StatelessWidget {
  const PreviewNavigationBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  static const horizontalInset = 24.0;
  static const labels = [
    'Trang chủ',
    'Học',
    'Từ của tôi',
    'Luyện tập',
    'Tiến độ',
  ];
  static const icons = ['home', 'book', 'words', 'practice', 'progress'];

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: horizontalInset),
    child: Container(
      key: const Key('previewNavigationBar'),
      width: double.infinity,
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(44),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 6,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < labels.length; i++)
            SizedBox(
              width: 48,
              child: Semantics(
                key: Key('previewDestination$i'),
                selected: selectedIndex == i,
                button: true,
                label: labels[i],
                excludeSemantics: true,
                onTap: () => onSelected(i),
                child: Tooltip(
                  message: labels[i],
                  child: InkWell(
                    key: Key('previewTab$i'),
                    onTap: () => onSelected(i),
                    borderRadius: BorderRadius.circular(99),
                    child: SizedBox(
                      height: 48,
                      child: Center(
                        child: AnimatedOpacity(
                          duration: MediaQuery.disableAnimationsOf(context)
                              ? Duration.zero
                              : const Duration(milliseconds: 200),
                          opacity: selectedIndex == i ? 1 : .5,
                          child: ColorFiltered(
                            colorFilter: ColorFilter.mode(
                              selectedIndex == i
                                  ? AppColors.primary500
                                  : AppColors.grey900,
                              BlendMode.srcIn,
                            ),
                            child: FigmaAsset('nav/${icons[i]}', size: 32),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
