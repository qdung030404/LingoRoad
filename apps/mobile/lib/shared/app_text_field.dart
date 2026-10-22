import 'package:flutter/material.dart';
import 'dart:ui' as ui;
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_typography.dart';
import 'figma_widgets.dart';

class CustomAppTextField extends StatefulWidget {
  final String? label;
  final String? hintText;
  final String? errorText;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool isPassword;
  final bool enabled;
  final bool readOnly;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final int maxLines;
  final VoidCallback? onTap;

  const CustomAppTextField({
    super.key,
    this.label,
    this.hintText,
    this.errorText,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.isPassword = false,
    this.enabled = true,
    this.readOnly = false,
    this.prefixIcon,
    this.suffixIcon,
    this.onChanged,
    this.validator,
    this.maxLines = 1,
    this.onTap,
  });

  @override
  State<CustomAppTextField> createState() => _CustomAppTextFieldState();
}

class _CustomAppTextFieldState extends State<CustomAppTextField> {
  late bool _obscureText;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.isPassword;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: AppTextStyles.bodyStrong.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              letterSpacing: -.42,
              color: isDark
                  ? AppColors.textPrimaryDark
                  : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 6),
        ],
        TextFormField(
          controller: widget.controller,
          keyboardType: widget.keyboardType,
          obscureText: _obscureText,
          enabled: widget.enabled,
          readOnly: widget.readOnly,
          maxLines: widget.isPassword ? 1 : widget.maxLines,
          onChanged: widget.onChanged,
          validator: widget.validator,
          onTap: widget.onTap,
          style: AppTextStyles.body.copyWith(
            height: 1.2,
            letterSpacing: -.42,
            fontVariations: const [ui.FontVariation('wght', 400)],
            color: isDark
                ? AppColors.textPrimaryDark
                : AppColors.textPrimaryLight,
          ),
          decoration: InputDecoration(
            isDense: true,
            errorMaxLines: 3,
            hintText: widget.hintText,
            hintStyle: AppTextStyles.body.copyWith(
              color: AppColors.grey500,
              height: 1.2,
              letterSpacing: -.42,
              fontVariations: const [ui.FontVariation('wght', 400)],
            ),
            errorText: widget.errorText,
            errorStyle: AppTextStyles.caption.copyWith(
              color: AppColors.error100,
            ),
            filled: true,
            fillColor: widget.enabled
                ? (isDark ? AppColors.surfaceDark : AppColors.grey50)
                : (isDark ? AppColors.grey800 : AppColors.grey50),
            prefixIcon: Padding(
              padding: const EdgeInsets.all(12),
              child:
                  widget.prefixIcon ??
                  FigmaAsset(
                    widget.isPassword
                        ? 'login/imgVuesaxBulkLock'
                        : widget.keyboardType == TextInputType.emailAddress
                        ? 'login/imgVuesaxBulkSms'
                        : 'register/imgVuesaxBulkUserSquare',
                  ),
            ),
            prefixIconConstraints: const BoxConstraints(
              minWidth: 44,
              maxWidth: 44,
              minHeight: 48,
            ),
            suffixIcon: widget.isPassword
                ? IconButton(
                    tooltip: _obscureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                    icon: const FigmaAsset(
                      'login/imgVuesaxBulkFrame',
                      size: 20,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscureText = !_obscureText;
                      });
                    },
                  )
                : widget.suffixIcon,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: AppRadius.inputRadius,
              borderSide: BorderSide(color: Colors.transparent),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: AppRadius.inputRadius,
              borderSide: BorderSide(color: Colors.transparent),
            ),
            focusedBorder: const OutlineInputBorder(
              borderRadius: AppRadius.inputRadius,
              borderSide: BorderSide(color: AppColors.primary, width: 1.5),
            ),
            errorBorder: const OutlineInputBorder(
              borderRadius: AppRadius.inputRadius,
              borderSide: BorderSide(color: AppColors.error100, width: 1.0),
            ),
            focusedErrorBorder: const OutlineInputBorder(
              borderRadius: AppRadius.inputRadius,
              borderSide: BorderSide(color: AppColors.error100, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
