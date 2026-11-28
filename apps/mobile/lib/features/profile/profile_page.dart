import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
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
import 'profile_settings_page.dart';
import 'reminder_coordinator.dart';

export 'profile_constants.dart' show learningPurposes;

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.session,
    this.onboarding = false,
    this.reminderPlatform,
    this.onPickAvatarImage,
    this.rememberedWords,
    this.completedLessonCount,
  });

  final SessionController session;
  final bool onboarding;
  final ReminderNotificationPlatform? reminderPlatform;
  final Future<String?> Function()? onPickAvatarImage;
  final int? rememberedWords;
  final int? completedLessonCount;

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
    if (_savingAvatar) return;
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
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      enableDrag: false,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.overlayPopup,
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

  Future<void> _pickReminderTime(
    BuildContext pickerContext,
    ReminderCoordinator coordinator,
  ) async {
    final parts = coordinator.state.time.split(':');
    final initial = TimeOfDay(
      hour: parts.length == 2 ? (int.tryParse(parts[0]) ?? 19) : 19,
      minute: parts.length == 2 ? (int.tryParse(parts[1]) ?? 30) : 30,
    );
    final picked = await showTimePicker(
      context: pickerContext,
      initialTime: initial,
    );
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
                        offset: const Offset(0, 3),
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
                        offset: const Offset(0, 3),
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

    final showStatsStrip =
        widget.rememberedWords != null && widget.completedLessonCount != null;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = math.max(28.0, MediaQuery.paddingOf(context).bottom + 20);
    final canPop = Navigator.of(context).canPop();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: ProfilePalette.background,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: ProfilePalette.background,
        body: LayoutBuilder(
          builder: (context, constraints) {
            final isNarrow = constraints.maxWidth < 340;
            final heroBackdropHeight =
                topInset +
                (showStatsStrip
                    ? (isNarrow ? 398.0 : 416.0)
                    : (isNarrow ? 346.0 : 362.0));

            return SingleChildScrollView(
              child: Stack(
                children: [
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: heroBackdropHeight,
                    child: const _ProfileHeroBackdrop(),
                  ),
                  SafeArea(
                    bottom: false,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 560),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _HeroTopBar(
                              canPop: canPop,
                              onBack: () => Navigator.of(context).pop(),
                            ),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                              child: _CenteredIdentityHero(
                                displayName: displayName,
                                email: email,
                                avatarUrl: avatarUrl,
                                isGoogle: isGoogle,
                                isNarrow: isNarrow,
                                savingAvatar: _savingAvatar,
                                onChangeAvatar: _changeAvatar,
                                onStartEdit: () => _openNameEditor(displayName),
                              ),
                            ),
                            Padding(
                              padding: EdgeInsets.fromLTRB(
                                16,
                                0,
                                16,
                                bottomInset,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (showStatsStrip) ...[
                                    _ProfileStatsStrip(
                                      rememberedWords: widget.rememberedWords!,
                                      completedLessons:
                                          widget.completedLessonCount!,
                                      dailyMinutes: dailyMinutes,
                                      isNarrow: isNarrow,
                                    ),
                                    const SizedBox(height: 22),
                                  ],
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
                                  const SizedBox(height: 22),
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
                                  const SizedBox(height: 22),
                                  ProfileSettingsSection(
                                    session: widget.session,
                                    reminderCoordinator: _reminderCoordinator!,
                                    isGoogle: isGoogle,
                                    hasFirebaseIdentity:
                                        widget.session.api.identity != null,
                                    onPickTime: (ctx) => _pickReminderTime(
                                      ctx,
                                      _reminderCoordinator!,
                                    ),
                                    onOpenChangePassword: () =>
                                        Navigator.of(context).push<void>(
                                          MaterialPageRoute<void>(
                                            builder: (_) => ChangePasswordPage(
                                              session: widget.session,
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
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ProfileHeroBackdrop extends StatelessWidget {
  const _ProfileHeroBackdrop();

  @override
  Widget build(BuildContext context) => const Stack(
    fit: StackFit.expand,
    children: [
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF1B3F26),
              Color(0xFF255B37),
              Color(0xFF357D4C),
              Color(0xFF54A56C),
              Color(0xFF8EC99F),
              Color(0xFFC8E6D2),
              Color(0xFFE7F3ED),
              ProfilePalette.background,
            ],
            stops: [0.0, 0.24, 0.43, 0.57, 0.71, 0.84, 0.93, 1.0],
          ),
        ),
      ),
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.72, -0.82),
            radius: 0.72,
            colors: [Color(0x36A6F0C0), Color(0x00A6F0C0)],
          ),
        ),
      ),
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(-0.78, -0.88),
            radius: 0.68,
            colors: [Color(0x28102B19), Color(0x00102B19)],
          ),
        ),
      ),
    ],
  );
}

class _HeroTopBar extends StatelessWidget {
  const _HeroTopBar({
    required this.canPop,
    required this.onBack,
  });

  final bool canPop;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 6, 8, 4),
    child: SizedBox(
      height: 48,
      child: Row(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: canPop
                ? IconButton(
                    tooltip: 'Quay lại',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 48,
                      minHeight: 48,
                    ),
                    onPressed: onBack,
                    icon: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: ProfilePalette.heroGlassBg,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: ProfilePalette.heroGlassBorder,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const ConceptSvgIcon(
                        ConceptGlyph.back,
                        size: 21,
                        color: ProfilePalette.heroTextPrimary,
                      ),
                    ),
                  )
                : null,
          ),
          Expanded(
            child: Text(
              'Hồ sơ của tôi',
              textAlign: TextAlign.center,
              style: designText(
                20,
                weight: FontWeight.w700,
                color: ProfilePalette.heroTextPrimary,
              ).copyWith(letterSpacing: -0.4),
            ),
          ),
          const SizedBox(width: 48, height: 48),
        ],
      ),
    ),
  );
}

class _CenteredIdentityHero extends StatelessWidget {
  const _CenteredIdentityHero({
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
      style: designHeading(
        isNarrow ? 24 : 28,
        color: ProfilePalette.heroGradientStart,
      ).copyWith(fontWeight: FontWeight.w800),
    ),
  );

  Widget _avatarButton() {
    final size = isNarrow ? 72.0 : 82.0;
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
                    decoration: BoxDecoration(
                      color: ProfilePalette.avatarBg,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.grey900.withValues(alpha: 0.18),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: ClipOval(
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
                    right: -2,
                    bottom: -2,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: ProfilePalette.ink,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      alignment: Alignment.center,
                      child: const ConceptSvgIcon(
                        ConceptGlyph.camera,
                        size: 14,
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
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      _avatarButton(),
      const SizedBox(height: 12),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              displayName.isEmpty ? 'Người học LingoRoad' : displayName,
              key: const Key('profileDisplayName'),
              textAlign: TextAlign.center,
              softWrap: true,
              style: designHeading(
                isNarrow ? 22 : 25,
                color: ProfilePalette.heroTextPrimary,
                height: 1.25,
              ).copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
            ),
          ),
          IconButton(
            key: const Key('editIdentityButton'),
            tooltip: 'Sửa họ và tên',
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            padding: EdgeInsets.zero,
            onPressed: onStartEdit,
            icon: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: ProfilePalette.heroGlassBg,
                shape: BoxShape.circle,
                border: Border.all(color: ProfilePalette.heroGlassBorder),
              ),
              alignment: Alignment.center,
              child: const ConceptSvgIcon(
                ConceptGlyph.pen,
                size: 15,
                color: ProfilePalette.heroTextPrimary,
              ),
            ),
          ),
        ],
      ),
      Row(
        key: const Key('profileEmailProviderRow'),
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            label: isGoogle ? 'Tài khoản Google' : 'Tài khoản Email',
            child: KeyedSubtree(
              key: const Key('profileProviderIcon'),
              child: isGoogle
                  ? Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const FigmaAsset('google/imgLogos', size: 13),
                    )
                  : const ConceptSvgIcon(
                      ConceptGlyph.mail,
                      size: 16,
                      color: ProfilePalette.heroTextMuted,
                    ),
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              email.isEmpty ? (isGoogle ? 'Google' : 'Email') : email,
              textAlign: TextAlign.center,
              softWrap: true,
              style: designText(
                isNarrow ? 13.5 : 15,
                weight: FontWeight.w500,
                color: ProfilePalette.heroTextMuted,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    ],
  );
}

class _ProfileStatsStrip extends StatelessWidget {
  const _ProfileStatsStrip({
    required this.rememberedWords,
    required this.completedLessons,
    required this.dailyMinutes,
    required this.isNarrow,
  });

  final int rememberedWords;
  final int completedLessons;
  final int dailyMinutes;
  final bool isNarrow;

  Widget _statCell({
    required String value,
    required String label,
    Color valueColor = ProfilePalette.ink,
  }) => Expanded(
    child: Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isNarrow ? 4 : 8,
        vertical: 4,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style:
                  designHeading(
                    isNarrow ? 20 : 23,
                    color: valueColor,
                    height: 1.15,
                  ).copyWith(
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
            ),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: designText(
                isNarrow ? 12 : 13.5,
                weight: FontWeight.w600,
                color: ProfilePalette.muted,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('profileStatsStrip'),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
    decoration: BoxDecoration(
      color: ProfilePalette.paper,
      borderRadius: AppRadius.cardRadius,
      border: Border.all(color: ProfilePalette.heroBorder),
      boxShadow: [
        BoxShadow(
          color: ProfilePalette.heroShadow,
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ],
    ),
    child: IntrinsicHeight(
      child: Row(
        children: [
          _statCell(value: '$rememberedWords', label: 'Từ đã nhớ'),
          const VerticalDivider(width: 1, thickness: 1, color: ProfilePalette.line),
          _statCell(
            value: '$completedLessons',
            label: 'Bài hoàn thành',
            valueColor: ProfilePalette.accent,
          ),
          const VerticalDivider(width: 1, thickness: 1, color: ProfilePalette.line),
          _statCell(value: '${dailyMinutes}p', label: 'Mục tiêu/ngày'),
        ],
      ),
    ),
  );
}

class ProfileSectionHeader extends StatelessWidget {
  const ProfileSectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        child: Text(
          title,
          style: designHeading(21, color: ProfilePalette.ink).copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
          ),
        ),
      ),
      if (trailing != null) ...[
        const SizedBox(width: 8),
        trailing!,
      ],
    ],
  );
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

  String _gapPillLabel() {
    if (!hasPlacement || placementCefr == null) {
      return 'Mục tiêu $targetCefr';
    }
    final inIdx = allCefrLevels.indexOf(placementCefr!.trim().toUpperCase());
    final tgtIdx = allCefrLevels.indexOf(targetCefr.trim().toUpperCase());
    if (inIdx >= 0 && tgtIdx > inIdx) {
      return '$placementCefr → $targetCefr · +${tgtIdx - inIdx} bậc';
    }
    return 'Đạt mốc $targetCefr';
  }

  Widget _gapPill() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: hasPlacement
          ? ProfilePalette.cefrGapBg
          : ProfilePalette.cefrChipBg,
      borderRadius: AppRadius.tagRadius,
      border: hasPlacement
          ? Border.all(color: ProfilePalette.cefrGapBorder)
          : null,
    ),
    child: Text(
      _gapPillLabel(),
      style:
          designText(
            13,
            weight: FontWeight.w700,
            color: hasPlacement
                ? ProfilePalette.accent
                : ProfilePalette.cefrChipFg,
            height: 1.15,
          ).copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
    ),
  );

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ProfileSectionHeader(
        title: 'Lộ trình tiếng Anh',
        trailing: _gapPill(),
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        decoration: BoxDecoration(
          color: ProfilePalette.paper,
          borderRadius: AppRadius.cardRadius,
          border: Border.all(color: ProfilePalette.heroBorder),
          boxShadow: [
            BoxShadow(
              color: ProfilePalette.heroShadow,
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CefrRoadChart(
              hasPlacement: hasPlacement,
              inputLevel: placementCefr,
              targetLevel: targetCefr,
            ),
            if (!hasPlacement) ...[
              const SizedBox(height: 12),
              Text(
                'Chưa có kết quả đầu vào',
                key: const Key('cefrPlacementSummary'),
                style: designText(
                  15,
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
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  foregroundColor: ProfilePalette.routeGreen,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: onViewPlacement,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'Xem kết quả',
                        style: designText(
                          15.5,
                          weight: FontWeight.w700,
                          color: ProfilePalette.routeGreen,
                        ),
                      ),
                    ),
                    const ConceptSvgIcon(
                      ConceptGlyph.arrow,
                      size: 20,
                      color: ProfilePalette.routeGreen,
                    ),
                  ],
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(0, 12, 0, 8),
                child: SizedBox(
                  height: 50,
                  width: double.infinity,
                  child: ElevatedButton(
                    key: const Key('startPlacementButton'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ProfilePalette.unassessedCta,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
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
                              15.5,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const ConceptSvgIcon(
                          ConceptGlyph.arrow,
                          size: 20,
                          color: Colors.white,
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
        ProfileSectionHeader(
          title: 'Kỹ năng',
          trailing: Text(
            '4 trụ cột CEFR',
            style: designText(
              13.5,
              weight: FontWeight.w600,
              color: ProfilePalette.muted,
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (isNarrow)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < skills.length; i++) ...[
                if (i > 0) const SizedBox(height: 12),
                _SkillTileCard(skill: skills[i], compactRow: true),
              ],
            ],
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < skills.length; i += 2) ...[
                if (i > 0) const SizedBox(height: 12),
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _SkillTileCard(
                          skill: skills[i],
                          compactRow: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: i + 1 < skills.length
                            ? _SkillTileCard(
                                skill: skills[i + 1],
                                compactRow: false,
                              )
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
      ],
    );
  }
}

class _SkillTileCard extends StatelessWidget {
  const _SkillTileCard({required this.skill, required this.compactRow});

  final _SkillDisplay skill;
  final bool compactRow;

  Widget _badge(SkillPillarPalette palette) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
    decoration: BoxDecoration(
      color: palette.badgeBg,
      borderRadius: AppRadius.tagRadius,
      border: Border.all(color: palette.badgeBorder),
    ),
    child: Text(
      skill.level,
      style:
          designText(
            14.5,
            weight: FontWeight.w800,
            color: palette.accent,
            height: 1.15,
          ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    ),
  );

  Widget _iconBox(SkillPillarPalette palette) => Container(
    width: 42,
    height: 42,
    decoration: BoxDecoration(
      color: palette.iconBg,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: palette.badgeBorder.withValues(alpha: 0.7)),
    ),
    alignment: Alignment.center,
    child: ConceptSvgIcon(
      skill.glyph,
      size: 21,
      color: palette.accent,
    ),
  );

  Widget _sourceLine(SkillPillarPalette palette) => Row(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: skill.isAdaptive
              ? palette.stripe
              : palette.stripe.withValues(alpha: 0.45),
          shape: BoxShape.circle,
        ),
      ),
      const SizedBox(width: 6),
      Flexible(
        child: Text(
          skill.sourceText,
          softWrap: true,
          style: designText(
            13.5,
            weight: skill.isAdaptive ? FontWeight.w600 : FontWeight.w500,
            color: skill.isAdaptive ? palette.accent : ProfilePalette.muted,
            height: 1.3,
          ),
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final adaptive = skill.isAdaptive;
    final palette = skillPillarPalette(skill.kind);
    return Container(
      key: ValueKey('skillTile-${skill.kind}'),
      constraints: const BoxConstraints(minHeight: 60),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            palette.cardTint,
            ProfilePalette.paper,
          ],
        ),
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: adaptive
              ? palette.stripe.withValues(alpha: 0.55)
              : palette.badgeBorder.withValues(alpha: 0.8),
          width: adaptive ? 1.3 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: ProfilePalette.cardShadow,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: compactRow
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _iconBox(palette),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        skill.title,
                        style: designText(
                          17,
                          weight: FontWeight.w700,
                          color: ProfilePalette.ink,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 4),
                      _sourceLine(palette),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _badge(palette),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [_iconBox(palette), _badge(palette)],
                ),
                const SizedBox(height: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      skill.title,
                      style: designText(
                        17,
                        weight: FontWeight.w700,
                        color: ProfilePalette.ink,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _sourceLine(palette),
                  ],
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

  Widget _bentoTile({
    required ConceptGlyph glyph,
    required String label,
    required String value,
    Key? valueKey,
  }) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 13),
    decoration: const BoxDecoration(
      color: ProfilePalette.bentoSurface,
      borderRadius: AppRadius.cardSm,
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: ProfilePalette.paper,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: ProfilePalette.line),
          ),
          alignment: Alignment.center,
          child: ConceptSvgIcon(glyph, size: 19, color: ProfilePalette.accent),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: designText(
                  13,
                  weight: FontWeight.w500,
                  color: ProfilePalette.muted,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                key: valueKey,
                softWrap: true,
                style:
                    designText(
                      15.5,
                      weight: FontWeight.w700,
                      color: ProfilePalette.ink,
                      height: 1.25,
                    ).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _skillPillarBadge(String kind, int rank) {
    final isPrimary = rank == 1;
    return Container(
      key: ValueKey('goalSkillBadge-$kind'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: isPrimary ? AppColors.primary25 : AppColors.grey5,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPrimary ? AppColors.primary100 : ProfilePalette.line,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: isPrimary ? AppColors.primary : AppColors.primary50,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '#$rank',
              style: designText(
                11,
                weight: FontWeight.w800,
                color: isPrimary ? Colors.white : ProfilePalette.accent,
                height: 1.1,
              ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
          const SizedBox(width: 8),
          ConceptSvgIcon(
            learningKindGlyph(kind),
            size: 17,
            color: ProfilePalette.accent,
          ),
          const SizedBox(width: 7),
          Expanded(
            child: FittedBox(
              alignment: Alignment.centerLeft,
              fit: BoxFit.scaleDown,
              child: Text(
                learningKindLabelVi(kind),
                maxLines: 1,
                style: designText(
                  14.5,
                  weight: isPrimary ? FontWeight.w700 : FontWeight.w600,
                  color: ProfilePalette.ink,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKindsGrid(List<String> orderedKinds) {
    if (orderedKinds.length == 1) {
      return Align(
        alignment: Alignment.centerLeft,
        child: IntrinsicWidth(child: _skillPillarBadge(orderedKinds.first, 1)),
      );
    }
    final rows = <Widget>[];
    for (var i = 0; i < orderedKinds.length; i += 2) {
      final left = orderedKinds[i];
      final right = i + 1 < orderedKinds.length ? orderedKinds[i + 1] : null;
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 10));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _skillPillarBadge(left, i + 1)),
              const SizedBox(width: 10),
              Expanded(
                child: right != null
                    ? _skillPillarBadge(right, i + 2)
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }

  @override
  Widget build(BuildContext context) {
    final seenKinds = <String>{};
    final orderedKinds = [
      for (final kind in preferredKinds)
        if (allPreferredLearningKinds.contains(kind) && seenKinds.add(kind))
          kind,
    ];
    final horizontalPad = isNarrow ? 14.0 : 16.0;
    final purposeTile = _bentoTile(
      glyph: learningPurposeGlyph(purpose ?? 'WORK'),
      label: 'Mục đích',
      value: learningPurposeLabelVi(purpose),
      valueKey: const Key('summaryPurposeValue'),
    );
    final durationTile = _bentoTile(
      glyph: ConceptGlyph.clock,
      label: 'Thời lượng',
      value: '$dailyMinutes phút/ngày',
      valueKey: const Key('summaryDurationValue'),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileSectionHeader(
          title: 'Mục tiêu học tập',
          trailing: InkWell(
            onTap: onEditGoals,
            borderRadius: AppRadius.tagRadius,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Chỉnh sửa',
                    style: designText(
                      15,
                      weight: FontWeight.w700,
                      color: ProfilePalette.accent,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const ConceptSvgIcon(
                    ConceptGlyph.arrow,
                    size: 18,
                    color: ProfilePalette.accent,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.cardRadius,
            boxShadow: [
              BoxShadow(
                color: ProfilePalette.heroShadow,
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: ProfilePalette.paper,
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.cardRadius,
              side: const BorderSide(color: ProfilePalette.heroBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const Key('editLearningGoalsButton'),
              hoverColor: ProfilePalette.hoverTint,
              onTap: onEditGoals,
              child: Padding(
                padding: EdgeInsets.all(horizontalPad),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (isNarrow) ...[
                      purposeTile,
                      const SizedBox(height: 10),
                      durationTile,
                    ] else
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(child: purposeTile),
                            const SizedBox(width: 10),
                            Expanded(child: durationTile),
                          ],
                        ),
                      ),
                    const SizedBox(height: 14),
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: ProfilePalette.line,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Kỹ năng ưu tiên',
                            style: designText(
                              14,
                              weight: FontWeight.w600,
                              color: ProfilePalette.muted,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${orderedKinds.length}/${allPreferredLearningKinds.length} đã chọn',
                          style:
                              designText(
                                13.5,
                                weight: FontWeight.w600,
                                color: ProfilePalette.muted,
                              ).copyWith(
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (orderedKinds.isEmpty)
                      Text(
                        'Không đặt ưu tiên',
                        style: designText(14.5, color: ProfilePalette.muted),
                      )
                    else
                      _buildKindsGrid(orderedKinds),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
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
                    offset: const Offset(0, 3),
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
