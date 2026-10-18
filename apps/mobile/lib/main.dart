import 'package:flutter/material.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_spacing.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_typography.dart';
import 'shared/app_button.dart';
import 'shared/app_card.dart';
import 'shared/app_dialog.dart';
import 'shared/app_input.dart';
import 'shared/app_text_field.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ThemeMode _themeMode = ThemeMode.light;

  void _toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LingoRoad Design System',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _themeMode,
      home: DesignSystemShowcasePage(
        isDark: _themeMode == ThemeMode.dark,
        onToggleTheme: _toggleTheme,
      ),
    );
  }
}

class DesignSystemShowcasePage extends StatefulWidget {
  final bool isDark;
  final VoidCallback onToggleTheme;

  const DesignSystemShowcasePage({
    super.key,
    required this.isDark,
    required this.onToggleTheme,
  });

  @override
  State<DesignSystemShowcasePage> createState() =>
      _DesignSystemShowcasePageState();
}

class _DesignSystemShowcasePageState extends State<DesignSystemShowcasePage> {
  int _counter = 0;
  bool _isLoading = false;
  String _selectedValue = 'Tiếng Anh B1 (Intermediate)';

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LingoRoad Design System'),
        actions: [
          IconButton(
            tooltip: 'Chuyển chế độ Sáng / Tối',
            icon: Icon(
              widget.isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
            ),
            onPressed: widget.onToggleTheme,
          ),
          IconButton(
            tooltip: 'Increment',
            icon: const Icon(Icons.add),
            onPressed: _incrementCounter,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.screenPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.md),
              Text(
                'Design Tokens & Components Preview',
                style: AppTextStyles.heading1Of(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Bản xem trước màu sắc, kiểu chữ và các linh kiện dùng chung.',
                style: AppTextStyles.captionOf(context),
              ),
              const SizedBox(height: AppSpacing.lg),

              // 1. Counter Card
              CustomAppCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Bộ đếm thử nghiệm (Widget Smoke Test)',
                            style: AppTextStyles.bodyStrongOf(context),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Nhấn icon "+" trên AppBar để tăng giá trị.',
                            style: AppTextStyles.captionOf(context),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$_counter',
                        style: AppTextStyles.heading2.copyWith(
                          color: AppColors.primary700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              // 2. Form Inputs Showcase
              Text(
                'Ô nhập liệu (Text Fields & Selector)',
                style: AppTextStyles.heading2Of(context),
              ),
              const SizedBox(height: AppSpacing.md),
              const CustomAppTextField(
                label: 'Email',
                hintText: 'Nhập địa chỉ email của bạn',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              const SizedBox(height: AppSpacing.md),
              const CustomAppTextField(
                label: 'Mật khẩu',
                hintText: 'Nhập mật khẩu',
                isPassword: true,
                prefixIcon: Icon(Icons.lock_outline_rounded),
              ),
              const SizedBox(height: AppSpacing.md),
              CustomAppInputContainer(
                label: 'Trình độ CEFR mục tiêu',
                value: _selectedValue,
                prefixIcon: const Icon(Icons.school_outlined),
                onTap: () {
                  setState(() {
                    _selectedValue = _selectedValue.contains('B1')
                        ? 'Tiếng Anh B2 (Upper-Intermediate)'
                        : 'Tiếng Anh B1 (Intermediate)';
                  });
                },
              ),

              const SizedBox(height: AppSpacing.lg),

              // 3. Button Showcase
              Text(
                'Nút bấm (App Buttons)',
                style: AppTextStyles.heading2Of(context),
              ),
              const SizedBox(height: AppSpacing.md),
              CustomAppButton(
                text: 'Nút Chính (Primary Button)',
                icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
                onPressed: () {
                  CustomAppDialog.show(
                    context,
                    title: 'Thông báo',
                    message: 'Bạn vừa nhấn nút chính của LingoRoad Design System.',
                    type: DialogType.success,
                    confirmText: 'Đã hiểu',
                    onConfirm: () {},
                  );
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              CustomAppButton(
                text: 'Nút Phụ (Secondary Button)',
                isSecondary: true,
                onPressed: () {
                  setState(() {
                    _isLoading = !_isLoading;
                  });
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              CustomAppButton(
                text: 'Trạng thái Đang tải (Loading State)',
                isLoading: _isLoading,
                onPressed: () {
                  setState(() {
                    _isLoading = !_isLoading;
                  });
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              const CustomAppButton(
                text: 'Nút bị vô hiệu hoá (Disabled)',
                onPressed: null,
              ),

              const SizedBox(height: AppSpacing.lg),

              // 4. Dialog Triggers
              Text(
                'Hộp thoại tương tác (Custom App Dialog)',
                style: AppTextStyles.heading2Of(context),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: CustomAppButton(
                      text: 'Cảnh báo',
                      isSecondary: true,
                      onPressed: () {
                        CustomAppDialog.show(
                          context,
                          title: 'Xác nhận thay đổi',
                          message: 'Bạn có chắc chắn muốn cập nhật lộ trình học?',
                          type: DialogType.warning,
                          confirmText: 'Đồng ý',
                          cancelText: 'Huỷ bỏ',
                          onConfirm: () {},
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: CustomAppButton(
                      text: 'Báo lỗi',
                      isSecondary: true,
                      onPressed: () {
                        CustomAppDialog.show(
                          context,
                          title: 'Lỗi kết nối',
                          message: 'Không thể kết nối đến máy chủ API LingoRoad.',
                          type: DialogType.error,
                          confirmText: 'Thử lại',
                          onConfirm: () {},
                        );
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}
