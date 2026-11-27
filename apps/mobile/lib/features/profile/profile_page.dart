import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/app_text_field.dart';
import '../../shared/figma_dropdown.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import '../placement/placement_pages.dart';
import 'cefr_road_chart.dart';
import 'learning_goals_edit_page.dart';
import 'profile_constants.dart';
import 'profile_edit_dialog.dart';
import 'reminder_coordinator.dart';

export 'profile_constants.dart' show learningPurposes;

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.session,
    this.onboarding = false,
    this.reminderPlatform,
    this.onPickAvatarImage,
  });

  final SessionController session;
  final bool onboarding;
  final ReminderNotificationPlatform? reminderPlatform;
  final Future<String?> Function()? onPickAvatarImage;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with WidgetsBindingObserver {
  final _onboardingForm = GlobalKey<FormState>();
  late final TextEditingController _nameController = TextEditingController(
    text: widget.session.user?['name'] as String? ?? '',
  );

  // Onboarding state
  late String? _onboardingPurpose =
      widget.session.profile['learningPurpose'] as String?;
  late int _onboardingMinutes =
      widget.session.profile['dailyGoalMinutes'] as int? ?? 10;
  late String _onboardingLevel =
      widget.session.profile['selfAssessedCefr'] as String? ?? 'UNKNOWN';
  bool _onboardingBusy = false;
  String? _onboardingError;
  String? _onboardingNotice;

  // Profile overview state
  ReminderCoordinator? _reminderCoordinator;
  Json? _preferencesSnapshot;
  bool _savingAvatar = false;
  bool _busyAction = false;

  @override
  void initState() {
    super.initState();
    if (!widget.onboarding) {
      WidgetsBinding.instance.addObserver(this);
      _reminderCoordinator = ReminderCoordinator(
        session: widget.session,
        platform: widget.reminderPlatform,
      )..initialize();
      _loadPreferences();
    }
  }

  @override
  void didUpdateWidget(covariant ProfilePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.onboarding != widget.onboarding) {
      if (widget.onboarding) {
        WidgetsBinding.instance.removeObserver(this);
      } else {
        WidgetsBinding.instance.addObserver(this);
      }
    }
    if (oldWidget.session != widget.session ||
        oldWidget.reminderPlatform != widget.reminderPlatform ||
        oldWidget.onboarding != widget.onboarding) {
      _reminderCoordinator?.dispose();
      _reminderCoordinator = null;
      _preferencesSnapshot = null;
      _savingAvatar = false;
      _busyAction = false;
      _nameController.text = widget.session.user?['name'] as String? ?? '';
      if (!widget.onboarding) {
        _reminderCoordinator = ReminderCoordinator(
          session: widget.session,
          platform: widget.reminderPlatform,
        )..initialize();
        _loadPreferences();
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!widget.onboarding && state == AppLifecycleState.resumed) {
      _reminderCoordinator?.recheckPermission();
    }
  }

  @override
  void dispose() {
    if (!widget.onboarding) {
      WidgetsBinding.instance.removeObserver(this);
    }
    _reminderCoordinator?.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    try {
      final prefs = await widget.session.api.request(
        'GET',
        '/learning/preferences',
      );
      if (!mounted) return;
      setState(() => _preferencesSnapshot = prefs);
    } catch (_) {
      // Fallback gracefully to cached session profile data.
    }
  }

  Future<void> _saveOnboarding() async {
    if (!_onboardingForm.currentState!.validate()) return;
    setState(() {
      _onboardingBusy = true;
      _onboardingError = null;
      _onboardingNotice = null;
    });
    try {
      await widget.session.saveProfile({
        'name': _nameController.text.trim(),
        'learningPurpose': _onboardingPurpose,
        'dailyGoalMinutes': _onboardingMinutes,
        'selfAssessedCefr': _onboardingLevel == 'UNKNOWN'
            ? null
            : _onboardingLevel,
      });
      if (mounted) setState(() => _onboardingNotice = 'Đã lưu hồ sơ.');
    } catch (e) {
      if (mounted) setState(() => _onboardingError = errorMessage(e));
    } finally {
      if (mounted) setState(() => _onboardingBusy = false);
    }
  }

  Future<void> _openNameEditor(String displayName) => showDialog<void>(
    context: context,
    barrierColor: AppColors.overlayPopup,
    barrierDismissible: false,
    builder: (_) => ProfileNameEditDialog(
      initialName: displayName,
      onSave: (name) => widget.session.saveProfile({'name': name}),
    ),
  );

  Future<void> _changeAvatar() async {
    if (_savingAvatar || _busyAction) return;
    setState(() => _savingAvatar = true);
    try {
      final url = await _pickAndUploadAvatar();
      if (!mounted) return;
      if (url == null || url.trim().isEmpty) {
        setState(() => _savingAvatar = false);
        return;
      }
      await widget.session.saveProfile({'avatarUrl': url.trim()});
      if (!mounted) return;
      setState(() => _savingAvatar = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _savingAvatar = false);
      _showFloatingFeedback(errorMessage(e), isError: true);
    }
  }

  Future<String?> _pickAndUploadAvatar() async {
    if (widget.onPickAvatarImage != null) {
      return widget.onPickAvatarImage!();
    }
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (picked == null) return null;
    final uploaded = await widget.session.api.multipartRequest(
      'POST',
      '/vocabulary/upload-image',
      factory: () async => FormData.fromMap({
        'file': await MultipartFile.fromFile(picked.path),
      }),
    );
    return uploaded['url'] as String?;
  }

  Future<void> _openGoalsEditor() async {
    final p = widget.session.profile;
    final snap = _preferencesSnapshot;
    final saved = await showDialog<bool>(
      context: context,
      barrierColor: AppColors.overlayPopup,
      barrierDismissible: false,
      builder: (_) => LearningGoalsEditDialog(
        session: widget.session,
        initialVersion:
            (snap?['version'] as num?)?.toInt() ??
            (p['preferencesVersion'] as num?)?.toInt(),
        initialPurpose:
            (snap?['learningPurpose'] as String?) ??
            (p['learningPurpose'] as String?),
        initialTargetCefr:
            (snap?['targetCefr'] as String?) ?? (p['targetCefr'] as String?),
        initialMinutes:
            (snap?['dailyGoalMinutes'] as num?)?.toInt() ??
            (p['dailyGoalMinutes'] as num?)?.toInt(),
        initialKinds:
            ((snap?['preferredKinds'] as List?) ??
                    (p['preferredKinds'] as List?))
                ?.cast<String>(),
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      await _loadPreferences();
    }
  }

  Future<void> _openPlacementAssessment() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => QuestionPage(session: widget.session),
      ),
    );
    if (!mounted) return;
    try {
      await widget.session.refreshPlacement();
      await _loadPreferences();
    } catch (_) {
      // Keep screen stable if refresh fails.
    }
  }

  Future<void> _pickReminderTime(ReminderCoordinator coordinator) async {
    final parts = coordinator.state.time.split(':');
    final initial = TimeOfDay(
      hour: parts.length == 2 ? (int.tryParse(parts[0]) ?? 19) : 19,
      minute: parts.length == 2 ? (int.tryParse(parts[1]) ?? 30) : 30,
    );
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (!mounted || picked == null) return;
    final hh = picked.hour.toString().padLeft(2, '0');
    final mm = picked.minute.toString().padLeft(2, '0');
    await coordinator.setTime('$hh:$mm');
  }

  void _showFloatingFeedback(String message, {bool isError = false}) {
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
    setState(() => _busyAction = true);
    try {
      await widget.session.resetPassword(
        widget.session.user!['email'] as String,
      );
      if (mounted) {
        _showFloatingFeedback('Kiểm tra email để đặt lại mật khẩu.');
      }
    } catch (e) {
      if (mounted) {
        _showFloatingFeedback(errorMessage(e), isError: true);
      }
    } finally {
      if (mounted) setState(() => _busyAction = false);
    }
  }

  @override
  Widget build(BuildContext context) => widget.onboarding
      ? _buildOnboardingScaffold()
      : ListenableBuilder(
          listenable: Listenable.merge([
            widget.session,
            ?_reminderCoordinator,
          ]),
          builder: (context, _) => _buildOverviewScaffold(context),
        );

  Widget _buildOnboardingScaffold() => FigmaPage(
    title: 'Mục tiêu của bạn',
    color: ProfilePalette.background,
    titleStyle: designText(
      19,
      weight: FontWeight.w700,
      color: ProfilePalette.ink,
    ).copyWith(letterSpacing: -0.6),
    child: Form(
      key: _onboardingForm,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: ProfilePalette.paper,
                    borderRadius: AppRadius.cardRadius,
                    border: Border.all(color: ProfilePalette.heroBorder),
                    boxShadow: [
                      BoxShadow(
                        color: ProfilePalette.heroShadow,
                        blurRadius: 12,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const BrandHeading(
                    title: 'Học theo cách của bạn',
                    description:
                        'Một vài thông tin để bắt đầu hành trình phù hợp.',
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: ProfilePalette.paper,
                    borderRadius: AppRadius.cardRadius,
                    border: Border.all(color: ProfilePalette.heroBorder),
                    boxShadow: [
                      BoxShadow(
                        color: ProfilePalette.heroShadow,
                        blurRadius: 12,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CustomAppTextField(
                        label: 'Họ tên',
                        controller: _nameController,
                        validator: requiredName,
                        enabled: !_onboardingBusy,
                      ),
                      const SizedBox(height: 14),
                      FigmaDropdown(
                        key: const Key('learningPurpose'),
                        label: 'Bạn học tiếng Anh để làm gì?',
                        value: _onboardingPurpose,
                        items: learningPurposes,
                        onChanged: _onboardingBusy
                            ? null
                            : (value) =>
                                  setState(() => _onboardingPurpose = value),
                        validator: (value) =>
                            value == null ? 'Chọn mục đích học.' : null,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Thời gian học mỗi ngày',
                        style: designText(
                          14,
                          weight: FontWeight.w600,
                          color: ProfilePalette.ink,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          for (final value in [5, 10, 20])
                            ChoiceChip(
                              label: Text('$value phút'),
                              selected: _onboardingMinutes == value,
                              selectedColor: ProfilePalette.skillAdaptiveBg,
                              onSelected: _onboardingBusy
                                  ? null
                                  : (_) => setState(
                                      () => _onboardingMinutes = value,
                                    ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      FigmaDropdown(
                        label: 'Trình độ tự đánh giá',
                        value: _onboardingLevel,
                        items: {
                          for (final value in ['UNKNOWN', 'A1', 'A2', 'B1', 'B2'])
                            value: value == 'UNKNOWN' ? 'Chưa biết' : value,
                        },
                        onChanged: _onboardingBusy
                            ? null
                            : (value) =>
                                  setState(() => _onboardingLevel = value),
                      ),
                    ],
                  ),
                ),
                if (_onboardingError != null) ...[
                  const SizedBox(height: 12),
                  ErrorNotice(_onboardingError!),
                ],
                if (_onboardingNotice != null) ...[
                  const SizedBox(height: 12),
                  Text(_onboardingNotice!, semanticsLabel: _onboardingNotice),
                ],
                const SizedBox(height: 16),
                SizedBox(
                  height: 48,
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ProfilePalette.ink,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                    onPressed: _onboardingBusy ? null : _saveOnboarding,
                    child: _onboardingBusy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'Lưu và tiếp tục',
                            style: designText(
                              15,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget _buildOverviewScaffold(BuildContext context) {
    final user = widget.session.user ?? const {};
    final profile = widget.session.profile;
    final snap = _preferencesSnapshot;
    final displayName = (user['name'] as String? ?? '').trim();
    final email = user['email'] as String? ?? '';
    final avatarUrl = user['avatarUrl'] as String?;
    final isGoogle = user['provider'] == 'GOOGLE';

    final hasPlacement =
        widget.session.placement['status'] == 'COMPLETED' &&
        widget.session.placementCefr != null;
    final placementCefr = widget.session.placementCefr;
    final placementSkills =
        ((widget.session.placementResult?['skills'] ??
                    widget.session.placement['skillResults'])
                as Map?)
            ?.cast<String, dynamic>();
    final placementSessionId =
        (widget.session.placement['currentSessionId'] ??
                widget.session.placementResult?['sessionId'])
            as String?;

    final readingSnap =
        (snap?['readingLevel'] as Map?)?.cast<String, dynamic>();
    final targetCefr =
        (snap?['targetCefr'] as String?) ??
        (profile['targetCefr'] as String?) ??
        'B1';
    final learningPurpose =
        (snap?['learningPurpose'] as String?) ??
        (profile['learningPurpose'] as String?);
    final dailyMinutes =
        (snap?['dailyGoalMinutes'] as num?)?.toInt() ??
        (profile['dailyGoalMinutes'] as num?)?.toInt() ??
        10;
    final preferredKinds =
        ((snap?['preferredKinds'] as List?) ??
                (profile['preferredKinds'] as List?) ??
                allPreferredLearningKinds)
            .cast<String>();

    return FigmaPage(
      title: 'Hồ sơ của tôi',
      color: ProfilePalette.background,
      minimumTopInset: 0,
      titleStyle: designText(
        17,
        weight: FontWeight.w700,
        color: ProfilePalette.ink,
      ).copyWith(letterSpacing: -0.75),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 340;
          final rem = _reminderCoordinator!.state;

          return Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _IdentityHeader(
                      displayName: displayName,
                      email: email,
                      avatarUrl: avatarUrl,
                      isGoogle: isGoogle,
                      isNarrow: isNarrow,
                      savingAvatar: _savingAvatar,
                      onChangeAvatar: _changeAvatar,
                      onStartEdit: () => _openNameEditor(displayName),
                    ),
                    const SizedBox(height: 22),
                    _CefrOverviewCard(
                      hasPlacement: hasPlacement,
                      placementCefr: placementCefr,
                      targetCefr: targetCefr,
                      onViewPlacement: placementSessionId == null
                          ? null
                          : () => Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) => ResultPage(
                                  session: widget.session,
                                  sessionId: placementSessionId,
                                ),
                              ),
                            ),
                      onStartPlacement: _openPlacementAssessment,
                    ),
                    const SizedBox(height: 24),
                    _SkillsSection(
                      hasPlacement: hasPlacement,
                      placementCefr: placementCefr,
                      placementSkills: placementSkills,
                      readingSnap: readingSnap,
                      isNarrow: isNarrow,
                    ),
                    const SizedBox(height: 22),
                    _GoalsSummaryCard(
                      purpose: learningPurpose,
                      dailyMinutes: dailyMinutes,
                      preferredKinds: preferredKinds,
                      isNarrow: isNarrow,
                      onEditGoals: _openGoalsEditor,
                    ),
                    const SizedBox(height: 24),
                    _SettingsSection(
                      reminder: rem,
                      isGoogle: isGoogle,
                      hasFirebaseIdentity: widget.session.api.identity != null,
                      busy: _busyAction,
                      onToggleReminder: (val) =>
                          _reminderCoordinator!.setEnabled(val),
                      onOpenSystemSettings:
                          _reminderCoordinator!.refreshPermissionAndSchedule,
                      onPickTime: () =>
                          _pickReminderTime(_reminderCoordinator!),
                      onRetryReminder: _reminderCoordinator!.retryLastFailed,
                      onResetPassword: _resetPasswordViaEmail,
                      onOpenChangePassword: () => Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ChangePasswordPage(session: widget.session),
                        ),
                      ),
                      onLogout: () async {
                        setState(() => _busyAction = true);
                        await widget.session.logout();
                        if (mounted) setState(() => _busyAction = false);
                      },
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _IdentityHeader extends StatelessWidget {
  const _IdentityHeader({
    required this.displayName,
    required this.email,
    required this.avatarUrl,
    required this.isGoogle,
    required this.isNarrow,
    required this.savingAvatar,
    required this.onChangeAvatar,
    required this.onStartEdit,
  });

  final String displayName;
  final String email;
  final String? avatarUrl;
  final bool isGoogle;
  final bool isNarrow;
  final bool savingAvatar;
  final VoidCallback onChangeAvatar;
  final VoidCallback onStartEdit;

  Widget _initialAvatar(double size) => Container(
    width: size,
    height: size,
    decoration: const BoxDecoration(
      color: ProfilePalette.avatarBg,
      shape: BoxShape.circle,
    ),
    alignment: Alignment.center,
    child: Text(
      displayName.isNotEmpty ? displayName[0].toUpperCase() : 'L',
      style: designHeading(isNarrow ? 21 : 24, color: ProfilePalette.accent),
    ),
  );

  Widget _avatarButton() {
    final size = isNarrow ? 56.0 : 64.0;
    final trimmed = avatarUrl?.trim() ?? '';
    return Semantics(
      button: true,
      label: 'Đổi ảnh đại diện',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: const Key('changeAvatarButton'),
          customBorder: const CircleBorder(),
          onTap: savingAvatar ? null : onChangeAvatar,
          child: Tooltip(
            message: 'Đổi ảnh đại diện',
            child: SizedBox(
              width: size,
              height: size,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: size,
                    height: size,
                    decoration: const BoxDecoration(
                      color: ProfilePalette.avatarBg,
                      shape: BoxShape.circle,
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: trimmed.isNotEmpty
                        ? Image.network(
                            trimmed,
                            width: size,
                            height: size,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => _initialAvatar(size),
                          )
                        : _initialAvatar(size),
                  ),
                  if (savingAvatar)
                    Container(
                      width: size,
                      height: size,
                      decoration: const BoxDecoration(
                        color: AppColors.overlayPopup,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  Positioned(
                    right: -3,
                    bottom: -2,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: ProfilePalette.ink,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: ProfilePalette.background,
                          width: 2,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const ConceptSvgIcon(
                        ConceptGlyph.camera,
                        size: 13,
                        color: Colors.white,
                      ),
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

  @override
  Widget build(BuildContext context) {
    final gap = isNarrow ? 10.0 : 14.0;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _avatarButton(),
              SizedBox(width: gap),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      displayName.isEmpty ? 'Người học LingoRoad' : displayName,
                      key: const Key('profileDisplayName'),
                      softWrap: true,
                      style: designHeading(
                        isNarrow ? 20 : 22,
                        color: ProfilePalette.ink,
                        height: 1.25,
                      ).copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -(isNarrow ? 0.6 : 0.7),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      email,
                      softWrap: true,
                      style: designText(
                        isNarrow ? 13 : 14,
                        color: ProfilePalette.muted,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        isGoogle
                            ? const FigmaAsset('google/imgLogos', size: 15)
                            : const ConceptSvgIcon(
                                ConceptGlyph.mail,
                                size: 15,
                                color: ProfilePalette.providerText,
                              ),
                        const SizedBox(width: 6),
                        Text(
                          isGoogle ? 'Google' : 'Email',
                          style: designText(
                            13,
                            weight: FontWeight.w600,
                            color: ProfilePalette.providerText,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              IconButton(
                key: const Key('editIdentityButton'),
                tooltip: 'Sửa họ và tên',
                constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                padding: EdgeInsets.zero,
                onPressed: onStartEdit,
                icon: const ConceptSvgIcon(
                  ConceptGlyph.pen,
                  size: 22,
                  color: ProfilePalette.ink,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CefrOverviewCard extends StatelessWidget {
  const _CefrOverviewCard({
    required this.hasPlacement,
    required this.placementCefr,
    required this.targetCefr,
    required this.onViewPlacement,
    required this.onStartPlacement,
  });

  final bool hasPlacement;
  final String? placementCefr;
  final String targetCefr;
  final VoidCallback? onViewPlacement;
  final VoidCallback onStartPlacement;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
    decoration: BoxDecoration(
      color: ProfilePalette.paper,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: ProfilePalette.heroBorder),
      boxShadow: [
        BoxShadow(
          color: ProfilePalette.heroShadow,
          blurRadius: 12,
          offset: Offset(0, 3),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Trình độ tiếng Anh',
                style: designHeading(18, color: ProfilePalette.ink).copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: ProfilePalette.cefrChipBg,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'CEFR',
                style: designText(
                  11.5,
                  weight: FontWeight.w700,
                  color: ProfilePalette.cefrChipFg,
                  height: 1.15,
                ).copyWith(letterSpacing: 0.4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        CefrRoadChart(
          hasPlacement: hasPlacement,
          inputLevel: placementCefr,
          targetLevel: targetCefr,
        ),
        if (!hasPlacement) ...[
          const SizedBox(height: 10),
          Text(
            'Chưa có kết quả đầu vào',
            key: const Key('cefrPlacementSummary'),
            style: designText(
              13.5,
              weight: FontWeight.w600,
              color: ProfilePalette.muted,
            ),
          ),
        ],
        if (hasPlacement)
          TextButton(
            key: const Key('viewPlacementResultButton'),
            style: TextButton.styleFrom(
              minimumSize: const Size(double.infinity, 50),
              padding: const EdgeInsets.symmetric(horizontal: 2),
              foregroundColor: ProfilePalette.routeGreen,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: onViewPlacement,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Xem kết quả',
                  style: designText(
                    15,
                    weight: FontWeight.w700,
                    color: ProfilePalette.routeGreen,
                  ),
                ),
                const ConceptSvgIcon(
                  ConceptGlyph.arrow,
                  size: 19,
                  color: ProfilePalette.routeGreen,
                ),
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 10, 0, 12),
            child: SizedBox(
              height: 50,
              width: double.infinity,
              child: ElevatedButton(
                key: const Key('startPlacementButton'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ProfilePalette.unassessedCta,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: onStartPlacement,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'Kiểm tra đầu vào',
                        style: designText(
                          15,
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const ConceptSvgIcon(
                      ConceptGlyph.arrow,
                      size: 19,
                      color: Colors.white,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class _SkillDisplay {
  const _SkillDisplay({
    required this.kind,
    required this.glyph,
    required this.title,
    required this.level,
    required this.sourceText,
    required this.isAdaptive,
  });
  final String kind;
  final ConceptGlyph glyph;
  final String title;
  final String level;
  final String sourceText;
  final bool isAdaptive;
}

class _SkillsSection extends StatelessWidget {
  const _SkillsSection({
    required this.hasPlacement,
    required this.placementCefr,
    required this.placementSkills,
    required this.readingSnap,
    required this.isNarrow,
  });

  final bool hasPlacement;
  final String? placementCefr;
  final Json? placementSkills;
  final Json? readingSnap;
  final bool isNarrow;

  List<_SkillDisplay> _buildSkills() {
    final readSrc = readingSnap?['source'] as String?;
    final readLvl = readingSnap?['cefrLevel'] as String?;
    final placeRead =
        (placementSkills?['reading'] as Map?)?['estimatedCefr'] as String?;
    final placeListen =
        (placementSkills?['listening'] as Map?)?['estimatedCefr'] as String?;

    final readingAdaptive = readSrc == 'ADAPTIVE' && readLvl != null;
    final readingLevel = readingAdaptive
        ? readLvl
        : (placeRead ?? (readSrc == 'PLACEMENT' ? readLvl : null) ?? 'A1');
    final readingSource = readingAdaptive
        ? 'Cập nhật từ bài học'
        : hasPlacement
        ? 'Kết quả đầu vào'
        : 'Mức khởi đầu';

    final listeningLevel =
        placeListen ?? (hasPlacement ? placementCefr! : 'A1');
    final listeningSource = hasPlacement ? 'Kết quả đầu vào' : 'Mức khởi đầu';

    final grammarLevel = hasPlacement ? placementCefr! : 'A1';
    final grammarSource = hasPlacement ? 'Theo đầu vào' : 'Mức khởi đầu';

    final vocabLevel = hasPlacement ? placementCefr! : 'A1';
    final vocabSource = hasPlacement ? 'Theo đầu vào' : 'Mức khởi đầu';

    return [
      _SkillDisplay(
        kind: 'READING',
        glyph: ConceptGlyph.book,
        title: 'Đọc hiểu',
        level: readingLevel,
        sourceText: readingSource,
        isAdaptive: readingAdaptive,
      ),
      _SkillDisplay(
        kind: 'LISTENING',
        glyph: ConceptGlyph.headphones,
        title: 'Nghe hiểu',
        level: listeningLevel,
        sourceText: listeningSource,
        isAdaptive: false,
      ),
      _SkillDisplay(
        kind: 'GRAMMAR',
        glyph: ConceptGlyph.grammar,
        title: 'Ngữ pháp',
        level: grammarLevel,
        sourceText: grammarSource,
        isAdaptive: false,
      ),
      _SkillDisplay(
        kind: 'VOCABULARY',
        glyph: ConceptGlyph.cards,
        title: 'Từ vựng',
        level: vocabLevel,
        sourceText: vocabSource,
        isAdaptive: false,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final skills = _buildSkills();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Kỹ năng',
          style: designHeading(17, color: ProfilePalette.ink).copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        for (final skill in skills)
          _ConceptSkillRow(skill: skill, isNarrow: isNarrow),
      ],
    );
  }
}

class _ConceptSkillRow extends StatelessWidget {
  const _ConceptSkillRow({required this.skill, required this.isNarrow});

  final _SkillDisplay skill;
  final bool isNarrow;

  @override
  Widget build(BuildContext context) {
    final adaptive = skill.isAdaptive;
    return Container(
      key: ValueKey('skillTile-${skill.kind}'),
      constraints: const BoxConstraints(minHeight: 52),
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: ProfilePalette.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: adaptive
                  ? ProfilePalette.skillAdaptiveBg
                  : ProfilePalette.skillIconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: ConceptSvgIcon(
              skill.glyph,
              size: 18,
              color: adaptive
                  ? ProfilePalette.skillAdaptiveFg
                  : ProfilePalette.skillIconFg,
            ),
          ),
          SizedBox(width: isNarrow ? 10 : 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  skill.title,
                  style: designText(
                    15.5,
                    weight: FontWeight.w600,
                    color: ProfilePalette.ink,
                    height: 1.25,
                  ).copyWith(letterSpacing: -0.25),
                ),
                const SizedBox(height: 3),
                Text(
                  skill.sourceText,
                  style: designText(
                    13,
                    color: adaptive
                        ? ProfilePalette.accent
                        : ProfilePalette.muted,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: isNarrow ? 10 : 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: adaptive
                  ? ProfilePalette.badgeAdaptiveBg
                  : ProfilePalette.badgeBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: adaptive
                    ? ProfilePalette.badgeAdaptiveBorder
                    : ProfilePalette.badgeBorder,
              ),
            ),
            child: Text(
              skill.level,
              style:
                  designText(
                    13.5,
                    weight: FontWeight.w700,
                    color: adaptive
                        ? ProfilePalette.badgeAdaptiveFg
                        : ProfilePalette.accent,
                    height: 1.15,
                  ).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GoalsSummaryCard extends StatelessWidget {
  const _GoalsSummaryCard({
    required this.purpose,
    required this.dailyMinutes,
    required this.preferredKinds,
    required this.isNarrow,
    required this.onEditGoals,
  });

  final String? purpose;
  final int dailyMinutes;
  final List<String> preferredKinds;
  final bool isNarrow;
  final VoidCallback onEditGoals;

  @override
  Widget build(BuildContext context) {
    final orderedKinds = [
      for (final kind in allPreferredLearningKinds)
        if (preferredKinds.contains(kind)) kind,
    ];
    final horizontalPad = isNarrow ? 12.0 : 16.0;
    return Material(
      color: ProfilePalette.paper,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: ProfilePalette.goalsBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: const Key('editLearningGoalsButton'),
        hoverColor: ProfilePalette.hoverTint,
        onTap: onEditGoals,
        child: Padding(
          padding: EdgeInsets.fromLTRB(horizontalPad, 15, horizontalPad, 15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Mục tiêu học tập',
                      style: designHeading(17, color: ProfilePalette.ink)
                          .copyWith(
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                          ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Chỉnh sửa',
                        style: designText(
                          14,
                          weight: FontWeight.w700,
                          color: ProfilePalette.accent,
                        ),
                      ),
                      const SizedBox(width: 3),
                      const ConceptSvgIcon(
                        ConceptGlyph.arrow,
                        size: 18,
                        color: ProfilePalette.accent,
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${learningPurposeLabelVi(purpose)} · $dailyMinutes phút/ngày',
                key: const Key('summaryDurationValue'),
                softWrap: true,
                style: designText(
                  14.5,
                  weight: FontWeight.w500,
                  color: ProfilePalette.ink,
                ),
              ),
              const SizedBox(height: 11),
              if (orderedKinds.isEmpty)
                Text(
                  'Không đặt ưu tiên',
                  style: designText(13.5, color: ProfilePalette.muted),
                )
              else
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    for (final kind in orderedKinds)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: ProfilePalette.tagSurface,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          learningKindLabelVi(kind),
                          style: designText(
                            13,
                            weight: FontWeight.w600,
                            color: ProfilePalette.tagText,
                            height: 1.2,
                          ),
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
}

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({
    required this.reminder,
    required this.isGoogle,
    required this.hasFirebaseIdentity,
    required this.busy,
    required this.onToggleReminder,
    required this.onOpenSystemSettings,
    required this.onPickTime,
    required this.onRetryReminder,
    required this.onResetPassword,
    required this.onOpenChangePassword,
    required this.onLogout,
  });

  final ReminderUiState reminder;
  final bool isGoogle;
  final bool hasFirebaseIdentity;
  final bool busy;
  final ValueChanged<bool> onToggleReminder;
  final VoidCallback onOpenSystemSettings;
  final VoidCallback onPickTime;
  final VoidCallback onRetryReminder;
  final VoidCallback onResetPassword;
  final VoidCallback onOpenChangePassword;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'Cài đặt',
        style: designHeading(17, color: ProfilePalette.ink).copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
      ),
      const SizedBox(height: 6),
      Semantics(
        toggled: reminder.enabled,
        label: 'Nhắc học hằng ngày',
        child: InkWell(
          key: const Key('reminderToggleSwitch'),
          onTap: () => onToggleReminder(!reminder.enabled),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: ProfilePalette.line)),
            ),
            child: Row(
              children: [
                const ConceptSvgIcon(
                  ConceptGlyph.bell,
                  size: 21,
                  color: ProfilePalette.accent,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Nhắc học hằng ngày',
                        style: designText(
                          15.5,
                          weight: FontWeight.w500,
                          color: ProfilePalette.ink,
                        ),
                      ),
                      if (!reminder.enabled) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Đang tắt',
                          key: const Key('reminderToggleSubtitle'),
                          style: designText(
                            13,
                            color: ProfilePalette.muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                _ConceptSwitchPill(checked: reminder.enabled),
              ],
            ),
          ),
        ),
      ),
      if (reminder.needsPermissionBanner)
        Padding(
          padding: const EdgeInsets.fromLTRB(0, 10, 0, 6),
          child: Container(
            key: const Key('notificationPermissionBox'),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            decoration: BoxDecoration(
              color: ProfilePalette.permissionBg,
              borderRadius: BorderRadius.circular(12),
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
                    border: Border.all(
                      color: ProfilePalette.permissionIconBorder,
                    ),
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
                        key: const Key('reminderToggleSubtitle'),
                        style: designText(
                          14.5,
                          weight: FontWeight.w700,
                          color: ProfilePalette.ink,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Cấp quyền để nhận nhắc học lúc ${reminder.time}.',
                        style: designText(
                          13,
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
                                  14,
                                  weight: FontWeight.w700,
                                  color: ProfilePalette.accent,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const ConceptSvgIcon(
                                ConceptGlyph.arrow,
                                size: 16,
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
        ),
      if (reminder.enabled)
        InkWell(
          key: const Key('reminderTimeRow'),
          borderRadius: BorderRadius.circular(8),
          onTap: onPickTime,
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: ProfilePalette.line)),
            ),
            child: Row(
              children: [
                const ConceptSvgIcon(
                  ConceptGlyph.clock,
                  size: 21,
                  color: ProfilePalette.accent,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Giờ nhắc',
                        style: designText(
                          15.5,
                          weight: FontWeight.w500,
                          color: ProfilePalette.ink,
                        ),
                      ),
                      if (reminder.failedTime != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Đang giữ ${reminder.serverTime} · Chưa lưu được ${reminder.failedTime}',
                          style: designText(
                            13,
                            color: ProfilePalette.danger,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  reminder.time,
                  key: const Key('reminderTimeValue'),
                  style:
                      designText(
                        15,
                        weight: FontWeight.w600,
                        color: ProfilePalette.ink,
                      ).copyWith(
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                ),
                const SizedBox(width: 6),
                const ConceptSvgIcon(
                  ConceptGlyph.arrow,
                  size: 19,
                  color: ProfilePalette.accent,
                ),
              ],
            ),
          ),
        ),
      if (reminder.errorMessage != null) ...[
        const SizedBox(height: 10),
        Container(
          key: const Key('reminderErrorBanner'),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.error0,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.error25),
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
                      reminder.errorMessage!,
                      style: designText(
                        14,
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
                borderRadius: BorderRadius.circular(9),
                onPressed: reminder.saving ? null : onRetryReminder,
              ),
            ],
          ),
        ),
      ],
      if (!isGoogle)
        InkWell(
          key: const Key('accountPasswordActionRow'),
          borderRadius: BorderRadius.circular(8),
          onTap: busy
              ? null
              : (hasFirebaseIdentity ? onResetPassword : onOpenChangePassword),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: ProfilePalette.line)),
            ),
            child: Row(
              children: [
                const ConceptSvgIcon(
                  ConceptGlyph.lock,
                  size: 21,
                  color: ProfilePalette.accent,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    hasFirebaseIdentity ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu',
                    style: designText(
                      15.5,
                      weight: FontWeight.w500,
                      color: ProfilePalette.ink,
                    ),
                  ),
                ),
                const ConceptSvgIcon(
                  ConceptGlyph.arrow,
                  size: 19,
                  color: ProfilePalette.accent,
                ),
              ],
            ),
          ),
        ),
      Padding(
        padding: const EdgeInsets.only(top: 10),
        child: InkWell(
          key: const Key('logoutButton'),
          borderRadius: BorderRadius.circular(10),
          onTap: busy ? null : onLogout,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  if (busy)
                    const SizedBox(
                      width: 21,
                      height: 21,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: ProfilePalette.danger,
                      ),
                    )
                  else
                    const ConceptSvgIcon(
                      ConceptGlyph.exit,
                      size: 21,
                      color: ProfilePalette.danger,
                    ),
                  const SizedBox(width: 12),
                  Text(
                    'Đăng xuất',
                    style: designText(
                      15.5,
                      weight: FontWeight.w500,
                      color: ProfilePalette.danger,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _ConceptSwitchPill extends StatelessWidget {
  const _ConceptSwitchPill({required this.checked});

  final bool checked;

  @override
  Widget build(BuildContext context) {
    final disableAnim = MediaQuery.disableAnimationsOf(context);
    return AnimatedContainer(
      duration: disableAnim ? Duration.zero : const Duration(milliseconds: 180),
      width: 44,
      height: 26,
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
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key, required this.session});
  final SessionController session;
  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final form = GlobalKey<FormState>();
  final oldPassword = TextEditingController();
  final newPassword = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    oldPassword.dispose();
    newPassword.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.api.request(
        'POST',
        '/auth/change-password',
        data: {
          'oldPassword': oldPassword.text,
          'newPassword': newPassword.text,
        },
      );
      await widget.session.logout();
    } catch (e) {
      if (mounted) setState(() => error = errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: 'Đổi mật khẩu',
    color: ProfilePalette.background,
    titleStyle: designText(
      19,
      weight: FontWeight.w700,
      color: ProfilePalette.ink,
    ).copyWith(letterSpacing: -0.6),
    child: Form(
      key: form,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ProfilePalette.paper,
                borderRadius: AppRadius.cardRadius,
                border: Border.all(color: ProfilePalette.heroBorder),
                boxShadow: [
                  BoxShadow(
                    color: ProfilePalette.heroShadow,
                    blurRadius: 12,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: ProfilePalette.skillAdaptiveBg,
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        alignment: Alignment.center,
                        child: const ConceptSvgIcon(
                          ConceptGlyph.lock,
                          size: 18,
                          color: ProfilePalette.accent,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Cập nhật mật khẩu',
                              style: designHeading(16, color: ProfilePalette.ink),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Sau khi đổi mật khẩu, hãy đăng nhập lại bằng mật khẩu mới.',
                              style: designText(
                                13.5,
                                color: ProfilePalette.muted,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  CustomAppTextField(
                    label: 'Mật khẩu hiện tại',
                    controller: oldPassword,
                    isPassword: true,
                    enabled: !busy,
                    validator: (value) => value == null || value.isEmpty
                        ? 'Nhập mật khẩu hiện tại.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  CustomAppTextField(
                    label: 'Mật khẩu mới',
                    controller: newPassword,
                    isPassword: true,
                    enabled: !busy,
                    validator: validPassword,
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    ErrorNotice(error!),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ProfilePalette.ink,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9),
                        ),
                      ),
                      onPressed: busy ? null : submit,
                      child: busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'Đổi mật khẩu',
                              style: designText(
                                15,
                                weight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
