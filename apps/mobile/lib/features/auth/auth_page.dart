import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/app_text_field.dart';
import '../../shared/figma_widgets.dart';
import '../common.dart';
import 'session_controller.dart';
import 'welcome_page.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key, required this.session});
  final SessionController session;
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  bool emailOpen = false;

  Future<void> openEmail() async {
    if (emailOpen) return;
    emailOpen = true;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    try {
      await Navigator.of(context).push<void>(
        PageRouteBuilder<void>(
          opaque: false,
          barrierColor: const Color(0x66000000),
          barrierDismissible: false,
          transitionDuration: reduceMotion
              ? Duration.zero
              : const Duration(milliseconds: 340),
          reverseTransitionDuration: reduceMotion
              ? Duration.zero
              : const Duration(milliseconds: 260),
          pageBuilder: (context, animation, secondaryAnimation) => Padding(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 12,
            ),
            child: ClipRRect(
              key: const Key('authSheet'),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
              child: MediaQuery.removePadding(
                context: context,
                removeTop: true,
                child: _EmailAuthPage(session: widget.session),
              ),
            ),
          ),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curve = CurveTween(
              curve: animation.status == AnimationStatus.reverse
                  ? Curves.easeInCubic
                  : Curves.easeOutCubic,
            );
            return SlideTransition(
              position: animation.drive(
                Tween(begin: const Offset(0, 1), end: Offset.zero).chain(curve),
              ),
              child: child,
            );
          },
        ),
      );
    } finally {
      emailOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) =>
      WelcomePage(onEmail: openEmail, onLogout: widget.session.logout);
}

class _EmailAuthPage extends StatefulWidget {
  const _EmailAuthPage({required this.session});
  final SessionController session;

  @override
  State<_EmailAuthPage> createState() => _EmailAuthPageState();
}

class _EmailAuthPageState extends State<_EmailAuthPage> {
  bool register = false;
  bool busy = false;
  String? error;
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final confirmation = TextEditingController();
  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    confirmation.dispose();
    super.dispose();
  }

  void switchMode(bool next) => setState(() {
    register = next;
    error = null;
    password.clear();
    confirmation.clear();
  });
  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.authenticate(
        email: email.text,
        password: password.text,
        name: register ? name.text : null,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => error = errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final overlayStyle = SystemUiOverlayStyle.dark.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: AppColors.grey5,
      systemNavigationBarDividerColor: AppColors.grey5,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemStatusBarContrastEnforced: false,
      systemNavigationBarContrastEnforced: false,
    );
    return PopScope(
      canPop: !busy,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: overlayStyle,
        child: Scaffold(
          backgroundColor: AppColors.grey5,
          appBar: AppBar(
            automaticallyImplyLeading: false,
            backgroundColor: AppColors.grey5,
            foregroundColor: AppColors.grey900,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            scrolledUnderElevation: 0,
            systemOverlayStyle: overlayStyle,
            toolbarHeight: 56,
            centerTitle: true,
            title: Text(
              register ? 'Đăng ký' : 'Đăng nhập',
              style: designText(18, weight: FontWeight.w600),
            ),
            leadingWidth: 112,
            leading: TextButton(
              onPressed: busy ? null : () => Navigator.of(context).maybePop(),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.grey900,
                padding: const EdgeInsets.only(left: 12, right: 4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const FigmaAsset('login/imgVuesaxLinearArrowLeft', size: 16),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'Quay lại',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: designText(12, weight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ),
          body: SafeArea(
            top: false,
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: LayoutBuilder(
                  builder: (context, bounds) {
                    final padding = EdgeInsets.fromLTRB(
                      16,
                      32,
                      16,
                      math.max(
                        register ? 32 : 48,
                        MediaQuery.paddingOf(context).bottom + 24,
                      ),
                    );
                    return SingleChildScrollView(
                      padding: padding,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: math.max(
                            0,
                            bounds.maxHeight - padding.vertical,
                          ),
                        ),
                        child: IntrinsicHeight(
                          child: Form(
                            key: form,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  register
                                      ? 'Bắt đầu hành trình học tiếng Anh của bạn.'
                                      : 'Tiếp tục hành trình học tiếng Anh của bạn.',
                                  style: designText(
                                    32,
                                    weight: FontWeight.w600,
                                    height: 1,
                                  ),
                                ),
                                const SizedBox(height: 32),
                                if (register) ...[
                                  CustomAppTextField(
                                    key: const Key('name'),
                                    label: 'Họ và tên',
                                    hintText: 'Nguyễn Văn An',
                                    controller: name,
                                    validator: requiredName,
                                    enabled: !busy,
                                  ),
                                  const SizedBox(height: 12),
                                ],
                                CustomAppTextField(
                                  key: const Key('email'),
                                  label: 'Địa chỉ email',
                                  hintText: '@email.com',
                                  controller: email,
                                  keyboardType: TextInputType.emailAddress,
                                  validator: validEmail,
                                  enabled: !busy,
                                ),
                                const SizedBox(height: 12),
                                CustomAppTextField(
                                  key: const Key('password'),
                                  label: 'Mật khẩu',
                                  hintText: 'Nhập mật khẩu',
                                  controller: password,
                                  isPassword: true,
                                  enabled: !busy,
                                  validator: register
                                      ? validPassword
                                      : (value) =>
                                            value == null || value.isEmpty
                                            ? 'Nhập mật khẩu.'
                                            : null,
                                ),
                                if (register) ...[
                                  const SizedBox(height: 12),
                                  CustomAppTextField(
                                    key: const Key('confirmPassword'),
                                    label: 'Xác nhận mật khẩu',
                                    hintText: 'Nhập mật khẩu',
                                    controller: confirmation,
                                    isPassword: true,
                                    enabled: !busy,
                                    validator: (value) =>
                                        value != password.text ||
                                            value == null ||
                                            value.isEmpty
                                        ? 'Không khớp với mật khẩu đã nhập'
                                        : null,
                                  ),
                                ] else
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: TextButton(
                                      style: TextButton.styleFrom(
                                        padding: EdgeInsets.zero,
                                      ),
                                      onPressed: () =>
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            const SnackBar(
                                              content: Text(
                                                'Khôi phục mật khẩu chưa có trong bản demo.',
                                              ),
                                            ),
                                          ),
                                      child: Text(
                                        'Quên mật khẩu?',
                                        style: designText(
                                          12,
                                          weight: FontWeight.w500,
                                          color: AppColors.primary600,
                                        ),
                                      ),
                                    ),
                                  ),
                                if (error != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: ErrorNotice(error!),
                                  ),
                                const SizedBox(height: 24),
                                const Spacer(),
                                CustomAppButton(
                                  key: const Key('authSubmit'),
                                  text: register ? 'Đăng ký' : 'Đăng nhập',
                                  onPressed: submit,
                                  isLoading: busy,
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  children: [
                                    const Expanded(
                                      child: Divider(color: AppColors.grey100),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                      ),
                                      child: Text(
                                        'Hoặc',
                                        style: designText(14),
                                      ),
                                    ),
                                    const Expanded(
                                      child: Divider(color: AppColors.grey100),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                CustomAppButton(
                                  key: const Key('authSwitch'),
                                  text: register
                                      ? 'Đăng nhập bằng Email'
                                      : 'Đăng ký bằng Email',
                                  isSecondary: true,
                                  onPressed: busy
                                      ? null
                                      : () => switchMode(!register),
                                ),
                                if (register) ...[
                                  const SizedBox(height: 16),
                                  const TermsCaption(),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
