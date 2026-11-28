import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import 'cefr_road_chart.dart';
import 'profile_constants.dart';
import 'profile_page.dart';
import 'reminder_coordinator.dart';

class ProfileSettingsSection extends StatefulWidget {
  const ProfileSettingsSection({
    super.key,
    required this.session,
    required this.reminderCoordinator,
    required this.isGoogle,
    required this.hasFirebaseIdentity,
    required this.onPickTime,
    required this.onOpenChangePassword,
  });

  final SessionController session;
  final ReminderCoordinator reminderCoordinator;
  final bool isGoogle;
  final bool hasFirebaseIdentity;
  final Future<void> Function(BuildContext context) onPickTime;
  final VoidCallback onOpenChangePassword;

  @override
  State<ProfileSettingsSection> createState() => _ProfileSettingsSectionState();
}

class _ProfileSettingsSectionState extends State<ProfileSettingsSection> {
  bool _busy = false;

  void _showFeedback(String message, {bool isError = false}) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            message,
            style: designText(
              14,
              weight: FontWeight.w500,
              color: AppColors.grey0,
            ),
          ),
          backgroundColor: isError ? ProfilePalette.danger : ProfilePalette.ink,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(milliseconds: 2500),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadius.cardRadius,
          ),
        ),
      );
  }

  Future<void> _resetPasswordViaEmail() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.session.resetPassword(
        widget.session.user!['email'] as String,
      );
      if (mounted) {
        _showFeedback('Kiểm tra email để đặt lại mật khẩu.');
      }
    } catch (e) {
      if (mounted) {
        _showFeedback(errorMessage(e), isError: true);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.session.logout();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rem = widget.reminderCoordinator.state;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ProfileSectionHeader(title: 'Cài đặt & Tài khoản'),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: ProfilePalette.paper,
            borderRadius: AppRadius.cardRadius,
            border: Border.all(color: ProfilePalette.heroBorder),
            boxShadow: [
              BoxShadow(
                color: ProfilePalette.cardShadow,
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ReminderToggleTile(
                reminder: rem,
                onToggle: (val) => widget.reminderCoordinator.setEnabled(val),
              ),
              if (rem.needsPermissionBanner)
                _PermissionWarningCard(
                  reminderTime: rem.time,
                  onOpenSystemSettings: widget
                      .reminderCoordinator
                      .refreshPermissionAndSchedule,
                ),
              if (rem.enabled) ...[
                const Divider(
                  height: 1,
                  indent: 14,
                  endIndent: 14,
                  color: ProfilePalette.line,
                ),
                _ReminderTimeTile(
                  reminder: rem,
                  onTap: () => widget.onPickTime(context),
                ),
              ],
              if (!widget.isGoogle) ...[
                const Divider(
                  height: 1,
                  indent: 14,
                  endIndent: 14,
                  color: ProfilePalette.line,
                ),
                _PasswordActionTile(
                  hasFirebaseIdentity: widget.hasFirebaseIdentity,
                  busy: _busy,
                  onTap: widget.hasFirebaseIdentity
                      ? _resetPasswordViaEmail
                      : widget.onOpenChangePassword,
                ),
              ],
            ],
          ),
        ),
        if (rem.errorMessage != null) ...[
          const SizedBox(height: 12),
          _ReminderErrorCard(
            message: rem.errorMessage!,
            saving: rem.saving,
            onRetry: widget.reminderCoordinator.retryLastFailed,
          ),
        ],
        const SizedBox(height: 12),
        _LogoutCard(busy: _busy, onTap: _logout),
      ],
    );
  }
}

class _ReminderToggleTile extends StatelessWidget {
  const _ReminderToggleTile({required this.reminder, required this.onToggle});

  final ReminderUiState reminder;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) => Semantics(
    toggled: reminder.enabled,
    label: 'Nhắc học hằng ngày',
    child: InkWell(
      key: const Key('reminderToggleSwitch'),
      onTap: () => onToggle(!reminder.enabled),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primary25,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: const ConceptSvgIcon(
                  ConceptGlyph.bell,
                  size: 20,
                  color: ProfilePalette.accent,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Nhắc học hằng ngày',
                      style: designText(
                        16.5,
                        weight: FontWeight.w600,
                        color: ProfilePalette.ink,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      reminder.enabled
                          ? 'Đang bật lúc ${reminder.time}'
                          : 'Đang tắt',
                      key: const Key('reminderToggleSubtitle'),
                      style: designText(
                        14,
                        color: ProfilePalette.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              ConceptSwitchPill(checked: reminder.enabled),
            ],
          ),
        ),
      ),
    ),
  );
}

class _PermissionWarningCard extends StatelessWidget {
  const _PermissionWarningCard({
    required this.reminderTime,
    required this.onOpenSystemSettings,
  });

  final String reminderTime;
  final VoidCallback onOpenSystemSettings;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
    child: Container(
      key: const Key('notificationPermissionBox'),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      decoration: BoxDecoration(
        color: ProfilePalette.permissionBg,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: ProfilePalette.permissionBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: ProfilePalette.permissionIconBg,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: ProfilePalette.permissionIconBorder),
            ),
            alignment: Alignment.center,
            child: const ConceptSvgIcon(
              ConceptGlyph.bellOff,
              size: 18,
              color: ProfilePalette.permissionIconFg,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Chưa có quyền thông báo',
                  style: designText(
                    14,
                    weight: FontWeight.w700,
                    color: ProfilePalette.ink,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Cấp quyền để nhận nhắc học lúc $reminderTime.',
                  style: designText(
                    12.5,
                    color: ProfilePalette.muted,
                    height: 1.4,
                  ),
                ),
                InkWell(
                  key: const Key('openNotificationSettingsButton'),
                  borderRadius: BorderRadius.circular(6),
                  onTap: onOpenSystemSettings,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Bật quyền thông báo',
                          style: designText(
                            13.5,
                            weight: FontWeight.w700,
                            color: ProfilePalette.accent,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const ConceptSvgIcon(
                          ConceptGlyph.arrow,
                          size: 15,
                          color: ProfilePalette.accent,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _ReminderTimeTile extends StatelessWidget {
  const _ReminderTimeTile({required this.reminder, required this.onTap});

  final ReminderUiState reminder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    key: const Key('reminderTimeRow'),
    onTap: onTap,
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 62),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ProfilePalette.skillIconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: const ConceptSvgIcon(
                ConceptGlyph.clock,
                size: 20,
                color: ProfilePalette.skillIconFg,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Giờ nhắc',
                    style: designText(
                      16.5,
                      weight: FontWeight.w600,
                      color: ProfilePalette.ink,
                    ),
                  ),
                  if (reminder.failedTime != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      'Đang giữ ${reminder.serverTime} · Chưa lưu được ${reminder.failedTime}',
                      style: designText(
                        13.5,
                        color: ProfilePalette.danger,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primary25,
                borderRadius: AppRadius.tagRadius,
              ),
              child: Text(
                reminder.time,
                key: const Key('reminderTimeValue'),
                style:
                    designText(
                      15,
                      weight: FontWeight.w700,
                      color: ProfilePalette.accent,
                    ).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
              ),
            ),
            const SizedBox(width: 8),
            const ConceptSvgIcon(
              ConceptGlyph.chevron,
              size: 19,
              color: AppColors.grey600,
            ),
          ],
        ),
      ),
    ),
  );
}

class _PasswordActionTile extends StatelessWidget {
  const _PasswordActionTile({
    required this.hasFirebaseIdentity,
    required this.busy,
    required this.onTap,
  });

  final bool hasFirebaseIdentity;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    key: const Key('accountPasswordActionRow'),
    onTap: busy ? null : onTap,
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 62),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ProfilePalette.skillIconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: const ConceptSvgIcon(
                ConceptGlyph.lock,
                size: 20,
                color: ProfilePalette.skillIconFg,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Text(
                hasFirebaseIdentity ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu',
                style: designText(
                  16.5,
                  weight: FontWeight.w600,
                  color: ProfilePalette.ink,
                ),
              ),
            ),
            const ConceptSvgIcon(
              ConceptGlyph.chevron,
              size: 19,
              color: AppColors.grey600,
            ),
          ],
        ),
      ),
    ),
  );
}

class _ReminderErrorCard extends StatelessWidget {
  const _ReminderErrorCard({
    required this.message,
    required this.saving,
    required this.onRetry,
  });

  final String message;
  final bool saving;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('reminderErrorBanner'),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: ProfilePalette.dangerBg,
      borderRadius: AppRadius.cardSm,
      border: Border.all(color: ProfilePalette.dangerBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: ProfilePalette.danger,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: designText(
                  13.5,
                  color: ProfilePalette.danger,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        CustomAppButton(
          key: const Key('retryReminderSaveButton'),
          text: 'Thử lại lưu giờ nhắc',
          isSecondary: true,
          borderRadius: BorderRadius.circular(10),
          onPressed: saving ? null : onRetry,
        ),
      ],
    ),
  );
}

class _LogoutCard extends StatelessWidget {
  const _LogoutCard({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: AppRadius.pill,
      boxShadow: [
        BoxShadow(
          color: ProfilePalette.cardShadow,
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: Material(
      color: ProfilePalette.paper,
      shape: const StadiumBorder(
        side: BorderSide(color: ProfilePalette.logoutBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: const Key('logoutButton'),
        customBorder: const StadiumBorder(),
        hoverColor: ProfilePalette.dangerBg,
        splashColor: ProfilePalette.dangerBg,
        onTap: busy ? null : onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (busy)
                  const SizedBox(
                    width: 17,
                    height: 17,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.8,
                      color: ProfilePalette.danger,
                    ),
                  )
                else
                  const _FigmaLogoutIcon(
                    size: 17,
                    color: ProfilePalette.danger,
                  ),
                const SizedBox(width: 8),
                Text(
                  'Đăng xuất',
                  style: designText(
                    14.5,
                    weight: FontWeight.w500,
                    color: ProfilePalette.danger,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _FigmaLogoutIcon extends StatelessWidget {
  const _FigmaLogoutIcon({required this.color, this.size = 17});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final hex = color
        .toARGB32()
        .toRadixString(16)
        .padLeft(8, '0')
        .substring(2);
    final svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 17" fill="none">'
        '<path d="M6.30417 5.355C6.52375 2.805 7.83417 1.76375 10.7029 1.76375H10.795C13.9612 1.76375 15.2292 3.03167 15.2292 6.19792V10.8163C15.2292 13.9825 13.9612 15.2504 10.795 15.2504H10.7029C7.85542 15.2504 6.545 14.2233 6.31125 11.7158" stroke="#$hex" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M10.625 8.5H2.56417" stroke="#$hex" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M4.14375 6.12708L1.77083 8.5L4.14375 10.8729" stroke="#$hex" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '</svg>';
    return ExcludeSemantics(
      child: SvgPicture.string(svg, width: size, height: size),
    );
  }
}

class ConceptSwitchPill extends StatelessWidget {
  const ConceptSwitchPill({super.key, required this.checked});

  final bool checked;

  @override
  Widget build(BuildContext context) {
    final disableAnim = MediaQuery.disableAnimationsOf(context);
    return AnimatedContainer(
      duration: disableAnim ? Duration.zero : const Duration(milliseconds: 180),
      width: 48,
      height: 28,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: checked ? ProfilePalette.toggleOn : ProfilePalette.toggleOff,
        borderRadius: AppRadius.pill,
      ),
      child: AnimatedAlign(
        duration:
            disableAnim ? Duration.zero : const Duration(milliseconds: 180),
        alignment: checked ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
