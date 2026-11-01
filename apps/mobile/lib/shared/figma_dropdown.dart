import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_colors.dart';
import 'figma_widgets.dart';

/// Components / Dropdown / Radio Button from LingoRoad2.
class FigmaDropdown extends StatelessWidget {
  const FigmaDropdown({
    super.key,
    required this.label,
    required this.items,
    required this.value,
    required this.onChanged,
    this.validator,
  });
  final String label;
  final Map<String, String> items;
  final String? value;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) => FormField<String>(
    initialValue: value,
    validator: validator,
    enabled: onChanged != null,
    builder: (field) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: designText(14, weight: FontWeight.w500, height: 1.5),
        ),
        const SizedBox(height: 6),
        Builder(
          builder: (anchorContext) => Material(
            color: AppColors.grey50,
            borderRadius: BorderRadius.circular(99),
            child: InkWell(
              borderRadius: BorderRadius.circular(99),
              onTap: onChanged == null
                  ? null
                  : () async {
                      FocusManager.instance.primaryFocus?.unfocus();
                      final box =
                          anchorContext.findRenderObject()! as RenderBox;
                      final overlay =
                          Navigator.of(
                                context,
                              ).overlay!.context.findRenderObject()!
                              as RenderBox;
                      final rect =
                          box.localToGlobal(Offset.zero, ancestor: overlay) &
                          box.size;
                      final media = MediaQuery.of(context);
                      final menuHeight =
                          16 +
                          items.length *
                              math.max(40.0, media.textScaler.scale(24));
                      final spaceBelow =
                          overlay.size.height -
                          media.padding.bottom -
                          rect.bottom -
                          16;
                      final openAbove =
                          spaceBelow < menuHeight &&
                          rect.top - media.padding.top > menuHeight + 16;
                      final chosen = await showMenu<String>(
                        context: context,
                        position: RelativeRect.fromRect(
                          Rect.fromLTWH(
                            rect.left,
                            openAbove
                                ? rect.top - menuHeight - 8
                                : rect.bottom + 8,
                            rect.width,
                            0,
                          ),
                          Offset.zero & overlay.size,
                        ),
                        constraints: BoxConstraints.tightFor(width: rect.width),
                        color: AppColors.grey0,
                        surfaceTintColor: Colors.transparent,
                        elevation: 8,
                        shadowColor: const Color(0x260D0D12),
                        menuPadding: const EdgeInsets.all(8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: AppColors.grey200),
                        ),
                        items: [
                          for (final entry in items.entries)
                            PopupMenuItem<String>(
                              value: entry.key,
                              height: 40,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                              child: Semantics(
                                selected: entry.key == field.value,
                                child: Row(
                                  children: [
                                    entry.key == field.value
                                        ? SvgPicture.asset(
                                            'assets/figma/dropdown_radio_active.svg',
                                            width: 20,
                                            height: 20,
                                          )
                                        : Container(
                                            width: 20,
                                            height: 20,
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: AppColors.grey100,
                                              ),
                                            ),
                                          ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        entry.value,
                                        style: designText(16, height: 1.5),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      );
                      if (!field.mounted || chosen == null) return;
                      field.didChange(chosen);
                      onChanged?.call(chosen);
                    },
              child: Container(
                constraints: const BoxConstraints(minHeight: 48),
                padding: const EdgeInsets.fromLTRB(12, 12, 16, 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  border: field.hasError
                      ? Border.all(color: AppColors.error100)
                      : null,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        items[field.value] ?? 'Chọn một mục',
                        style: designText(
                          16,
                          color: onChanged == null
                              ? AppColors.grey300
                              : field.value == null
                              ? AppColors.grey500
                              : AppColors.grey900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SvgPicture.asset(
                      'assets/figma/dropdown_chevron.svg',
                      width: 16,
                      height: 16,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (field.hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              field.errorText!,
              style: designText(14, color: AppColors.error100),
            ),
          ),
      ],
    ),
  );
}
