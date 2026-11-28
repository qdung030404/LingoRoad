import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
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
        widget.session.hasCompletedPlacement &&
        widget.session.placementCefr != null;
    final placementCefr = widget.session.placementCefr;
    final placementSkills =
        ((widget.session.placementResult?['skills'] ??
                    widget.session.placement['skillResults'])
                as Map?)
            ?.cast<String, dynamic>();
    final placementSessionId =
        (widget.session.placement['completedSessionId'] ??
                (widget.session.placement['status'] == 'COMPLETED'
                    ? widget.session.placement['currentSessionId']
                    : null) ??
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
                                    targetCefr: targetCefr,
                                    isNarrow: isNarrow,
                                    onRetakePlacement: _openPlacementAssessment,
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
    required this.title,
    required this.level,
    required this.sourceText,
    required this.isAdaptive,
  });
  final String kind;
  final String title;
  final String? level;
  final String sourceText;
  final bool isAdaptive;
}

class _SkillsSection extends StatelessWidget {
  const _SkillsSection({
    required this.hasPlacement,
    required this.placementCefr,
    required this.placementSkills,
    required this.readingSnap,
    required this.targetCefr,
    required this.isNarrow,
    required this.onRetakePlacement,
  });

  final bool hasPlacement;
  final String? placementCefr;
  final Json? placementSkills;
  final Json? readingSnap;
  final String targetCefr;
  final bool isNarrow;
  final VoidCallback onRetakePlacement;

  List<_SkillDisplay> _buildSkills() {
    final readSrc = readingSnap?['source'] as String?;
    final readLvl = readingSnap?['cefrLevel'] as String?;
    final placeRead =
        (placementSkills?['reading'] as Map?)?['estimatedCefr'] as String?;
    final placeListen =
        (placementSkills?['listening'] as Map?)?['estimatedCefr'] as String?;

    final readingAdaptive = readSrc == 'ADAPTIVE' && readLvl != null;
    final String? readingLevel = readingAdaptive
        ? readLvl
        : hasPlacement
        ? (placeRead ?? (readSrc == 'PLACEMENT' ? readLvl : null) ?? placementCefr!)
        : null;
    final readingSource = readingAdaptive
        ? 'Cập nhật từ bài học'
        : hasPlacement
        ? 'Từ kết quả đầu vào'
        : 'Chưa đánh giá';

    final String? listeningLevel =
        hasPlacement ? (placeListen ?? placementCefr!) : null;
    final listeningSource =
        hasPlacement ? 'Từ kết quả đầu vào' : 'Chưa đánh giá';

    final String? grammarLevel = hasPlacement ? placementCefr! : null;
    final grammarSource =
        hasPlacement ? 'Từ kết quả đầu vào' : 'Chưa đánh giá';

    final String? vocabLevel = hasPlacement ? placementCefr! : null;
    final vocabSource =
        hasPlacement ? 'Từ kết quả đầu vào' : 'Chưa đánh giá';

    return [
      _SkillDisplay(
        kind: 'READING',
        title: 'Đọc hiểu',
        level: readingLevel,
        sourceText: readingSource,
        isAdaptive: readingAdaptive,
      ),
      _SkillDisplay(
        kind: 'LISTENING',
        title: 'Nghe hiểu',
        level: listeningLevel,
        sourceText: listeningSource,
        isAdaptive: false,
      ),
      _SkillDisplay(
        kind: 'GRAMMAR',
        title: 'Ngữ pháp',
        level: grammarLevel,
        sourceText: grammarSource,
        isAdaptive: false,
      ),
      _SkillDisplay(
        kind: 'VOCABULARY',
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
    return Container(
      key: const Key('profileSkillsCard'),
      padding: EdgeInsets.all(isNarrow ? 14 : 16),
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
          Text(
            'Theo kỹ năng',
            style: designHeading(
              17,
              color: ProfilePalette.ink,
            ).copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.35),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < skills.length; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            _FigmaSkillRow(
              skill: skills[i],
              targetCefr: targetCefr,
              isNarrow: isNarrow,
            ),
          ],
          if (hasPlacement) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              width: double.infinity,
              child: OutlinedButton(
                key: const Key('retakePlacementButton'),
                style: OutlinedButton.styleFrom(
                  backgroundColor: ProfilePalette.paper,
                  foregroundColor: ProfilePalette.ink,
                  side: const BorderSide(
                    color: ProfilePalette.retakeButtonBorder,
                  ),
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                ),
                onPressed: onRetakePlacement,
                child: Text(
                  'Đánh giá lại',
                  style: designText(
                    14.5,
                    weight: FontWeight.w600,
                    color: ProfilePalette.ink,
                    height: 1.2,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FigmaSkillRow extends StatelessWidget {
  const _FigmaSkillRow({
    required this.skill,
    required this.targetCefr,
    required this.isNarrow,
  });

  final _SkillDisplay skill;
  final String targetCefr;
  final bool isNarrow;

  @override
  Widget build(BuildContext context) {
    final adaptive = skill.isAdaptive;
    final assessed = skill.level != null;
    final iconColor = adaptive
        ? ProfilePalette.skillRowAdaptiveColor
        : ProfilePalette.skillRowInactiveIconColor;
    final iconBg = adaptive
        ? ProfilePalette.skillRowAdaptiveBg
        : ProfilePalette.skillRowInactiveIconBg;

    return ConstrainedBox(
      key: ValueKey('skillTile-${skill.kind}'),
      constraints: const BoxConstraints(minHeight: 49),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: _FigmaBulkSkillIcon(
              kind: skill.kind,
              color: iconColor,
              size: 20,
            ),
          ),
          SizedBox(width: isNarrow ? 8 : 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  skill.title,
                  style: designText(
                    14.5,
                    weight: FontWeight.w600,
                    color: ProfilePalette.ink,
                    height: 1.25,
                  ),
                ),
                if (assessed) ...[
                  const SizedBox(height: 3),
                  if (adaptive)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const _FigmaAdaptiveArrowBadge(
                          size: 15,
                          color: ProfilePalette.skillRowAdaptiveColor,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            skill.sourceText,
                            softWrap: true,
                            style: designText(
                              12.5,
                              weight: FontWeight.w500,
                              color: ProfilePalette.skillRowAdaptiveColor,
                              height: 1.25,
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    Text(
                      skill.sourceText,
                      softWrap: true,
                      style: designText(
                        12.5,
                        weight: FontWeight.w400,
                        color: ProfilePalette.skillRowInactiveIconColor,
                        height: 1.25,
                      ),
                    ),
                ],
              ],
            ),
          ),
          SizedBox(width: isNarrow ? 6 : 8),
          if (!assessed)
            Text(
              skill.sourceText,
              style: designText(
                12.5,
                weight: FontWeight.w400,
                color: ProfilePalette.skillRowInactiveIconColor,
                height: 1.25,
              ),
            )
          else
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _SkillCefrMiniBar(
                  skillLevel: skill.level!,
                  targetLevel: targetCefr,
                  compact: isNarrow,
                ),
                SizedBox(width: isNarrow ? 6 : 8),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: adaptive
                        ? ProfilePalette.skillRowAdaptiveColor
                        : ProfilePalette.skillRowAdaptiveBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.grey50),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0D1A2029),
                        blurRadius: 1.5,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    skill.level!,
                    style:
                        designText(
                          12.5,
                          weight: FontWeight.w600,
                          color: adaptive
                              ? Colors.white
                              : ProfilePalette.skillRowAdaptiveColor,
                          height: 1.1,
                        ).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _SkillCefrMiniBar extends StatelessWidget {
  const _SkillCefrMiniBar({
    required this.skillLevel,
    required this.targetLevel,
    required this.compact,
  });

  final String skillLevel;
  final String targetLevel;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final skillIdx = allCefrLevels.indexOf(skillLevel.trim().toUpperCase());
    final targetIdx = allCefrLevels.indexOf(targetLevel.trim().toUpperCase());
    final segWidth = compact ? 10.0 : 12.0;

    return ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < allCefrLevels.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            if (i <= skillIdx)
              Container(
                width: segWidth,
                height: 6,
                decoration: BoxDecoration(
                  color: ProfilePalette.skillRowAdaptiveColor,
                  borderRadius: BorderRadius.circular(64),
                ),
              )
            else if (i <= targetIdx)
              SizedBox(
                width: segWidth,
                height: 6,
                child: const CustomPaint(painter: _DashedStadiumPainter()),
              )
            else
              Container(
                width: segWidth,
                height: 6,
                decoration: BoxDecoration(
                  color: ProfilePalette.skillSegmentFuture,
                  borderRadius: BorderRadius.circular(64),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DashedStadiumPainter extends CustomPainter {
  const _DashedStadiumPainter();

  @override
  void paint(Canvas canvas, Size size) {
    const strokeWidth = 0.85;
    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      math.max(0, size.width - strokeWidth),
      math.max(0, size.height - strokeWidth),
    );
    final rrect = RRect.fromRectAndRadius(
      rect,
      Radius.circular(rect.height / 2),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = ProfilePalette.skillRowAdaptiveColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    const dashLength = 2.2;
    const gapLength = 1.7;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = math.min(distance + dashLength, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance += dashLength + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _FigmaBulkSkillIcon extends StatelessWidget {
  const _FigmaBulkSkillIcon({
    required this.kind,
    required this.color,
    this.size = 20,
  });

  final String kind;
  final Color color;
  final double size;

  String _paths(String hex) => switch (kind) {
    'READING' =>
      '<path opacity="0.4" d="M10 4.41667V17.775C9.85833 17.775 9.70833 17.75 9.59167 17.6833L9.55833 17.6667C7.95833 16.7917 5.16667 15.875 3.35833 15.6333L3.11667 15.6C2.31667 15.5 1.66667 14.75 1.66667 13.95V3.88333C1.66667 2.89167 2.475 2.14167 3.46667 2.225C5.21667 2.36667 7.86667 3.25 9.35 4.175L9.55833 4.3C9.68333 4.375 9.84167 4.41667 10 4.41667Z" fill="#$hex"/>'
          '<path d="M18.3333 3.89167V13.95C18.3333 14.75 17.6833 15.5 16.8833 15.6L16.6083 15.6333C14.7917 15.875 11.9917 16.8 10.3917 17.6833C10.2833 17.75 10.15 17.775 10 17.775V4.41667C10.1583 4.41667 10.3167 4.375 10.4417 4.3L10.5833 4.20833C12.0667 3.275 14.725 2.38333 16.475 2.23333H16.525C17.5167 2.15 18.3333 2.89167 18.3333 3.89167Z" fill="#$hex"/>'
          '<path d="M6.45833 7.7H4.58333C4.24167 7.7 3.95833 7.41667 3.95833 7.075C3.95833 6.73333 4.24167 6.45 4.58333 6.45H6.45833C6.8 6.45 7.08333 6.73333 7.08333 7.075C7.08333 7.41667 6.8 7.7 6.45833 7.7Z" fill="#$hex"/>'
          '<path d="M7.08333 10.2H4.58333C4.24167 10.2 3.95833 9.91667 3.95833 9.575C3.95833 9.23333 4.24167 8.95 4.58333 8.95H7.08333C7.425 8.95 7.70833 9.23333 7.70833 9.575C7.70833 9.91667 7.425 10.2 7.08333 10.2Z" fill="#$hex"/>',
    'LISTENING' =>
      '<path opacity="0.4" d="M2.29167 15.5417C1.95 15.5417 1.66667 15.2583 1.66667 14.9167V10.1667C1.625 7.90833 2.46667 5.775 4.03333 4.175C5.6 2.58333 7.7 1.70833 9.95833 1.70833C14.575 1.70833 18.3333 5.46667 18.3333 10.0833V14.8333C18.3333 15.175 18.05 15.4583 17.7083 15.4583C17.3667 15.4583 17.0833 15.175 17.0833 14.8333V10.0833C17.0833 6.15833 13.8917 2.95833 9.95833 2.95833C8.03333 2.95833 6.25 3.7 4.925 5.05C3.59167 6.40833 2.88333 8.21667 2.91667 10.15V14.9083C2.91667 15.2583 2.64167 15.5417 2.29167 15.5417Z" fill="#$hex"/>'
          '<path d="M4.95 10.375H4.84167C3.09167 10.375 1.66667 11.8 1.66667 13.55V15.1167C1.66667 16.8667 3.09167 18.2917 4.84167 18.2917H4.95C6.7 18.2917 8.125 16.8667 8.125 15.1167V13.55C8.125 11.8 6.7 10.375 4.95 10.375Z" fill="#$hex"/>'
          '<path d="M15.1583 10.375H15.05C13.3 10.375 11.875 11.8 11.875 13.55V15.1167C11.875 16.8667 13.3 18.2917 15.05 18.2917H15.1583C16.9083 18.2917 18.3333 16.8667 18.3333 15.1167V13.55C18.3333 11.8 16.9083 10.375 15.1583 10.375Z" fill="#$hex"/>',
    'GRAMMAR' =>
      '<path opacity="0.4" d="M13.3333 1.66667H6.66667C3.33333 1.66667 1.66667 3.33333 1.66667 6.66667V17.5C1.66667 17.9583 2.04167 18.3333 2.5 18.3333H13.3333C16.6667 18.3333 18.3333 16.6667 18.3333 13.3333V6.66667C18.3333 3.33333 16.6667 1.66667 13.3333 1.66667Z" fill="#$hex"/>'
          '<path d="M14.1667 7.29167H5.83333C5.49167 7.29167 5.20833 7.575 5.20833 7.91667C5.20833 8.25833 5.49167 8.54167 5.83333 8.54167H14.1667C14.5083 8.54167 14.7917 8.25833 14.7917 7.91667C14.7917 7.575 14.5083 7.29167 14.1667 7.29167Z" fill="#$hex"/>'
          '<path d="M11.6667 11.4583H5.83333C5.49167 11.4583 5.20833 11.7417 5.20833 12.0833C5.20833 12.425 5.49167 12.7083 5.83333 12.7083H11.6667C12.0083 12.7083 12.2917 12.425 12.2917 12.0833C12.2917 11.7417 12.0083 11.4583 11.6667 11.4583Z" fill="#$hex"/>',
    _ =>
      '<path opacity="0.4" d="M18.3333 6.50833V13.4917C18.3333 16.525 16.525 18.3333 13.4917 18.3333H6.50833C6.34167 18.3333 6.175 18.325 6.01667 18.3167C4.99167 18.25 4.125 17.9583 3.44167 17.4583C3.09167 17.2167 2.78333 16.9083 2.54167 16.5583C1.96667 15.7667 1.66667 14.7333 1.66667 13.4917V6.50833C1.66667 3.64167 3.28333 1.86667 6.01667 1.69167C6.175 1.675 6.34167 1.66667 6.50833 1.66667H13.4917C14.7333 1.66667 15.7667 1.96667 16.5583 2.54167C16.9083 2.78333 17.2167 3.09167 17.4583 3.44167C18.0333 4.23333 18.3333 5.26667 18.3333 6.50833Z" fill="#$hex"/>'
          '<path d="M13.8917 4.7H6.10833C5.15 4.7 4.375 5.475 4.375 6.43333V7.41667C4.375 7.75833 4.65833 8.04167 5 8.04167C5.34167 8.04167 5.625 7.75833 5.625 7.41667V6.43333C5.625 6.16667 5.84167 5.95 6.10833 5.95H9.375V14.05H7.89167C7.55 14.05 7.26667 14.3333 7.26667 14.675C7.26667 15.0167 7.55 15.3 7.89167 15.3H12.1167C12.4583 15.3 12.7417 15.0167 12.7417 14.675C12.7417 14.3333 12.4583 14.05 12.1167 14.05H10.6333V5.95H13.9C14.1667 5.95 14.3833 6.16667 14.3833 6.43333V7.41667C14.3833 7.75833 14.6667 8.04167 15.0083 8.04167C15.35 8.04167 15.6333 7.75833 15.6333 7.41667V6.43333C15.625 5.48333 14.85 4.7 13.8917 4.7Z" fill="#$hex"/>',
  };

  @override
  Widget build(BuildContext context) {
    final hex = color
        .toARGB32()
        .toRadixString(16)
        .padLeft(8, '0')
        .substring(2);
    final svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">${_paths(hex)}</svg>';
    return ExcludeSemantics(
      child: SvgPicture.string(svg, width: size, height: size),
    );
  }
}

class _FigmaAdaptiveArrowBadge extends StatelessWidget {
  const _FigmaAdaptiveArrowBadge({required this.color, this.size = 15});

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
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none">'
        '<path opacity="0.4" d="M13.75 4.88125V10.1125C13.75 12.3875 12.3938 13.7437 10.1188 13.7437H4.88125C2.60625 13.75 1.25 12.3938 1.25 10.1188V4.88125C1.25 2.60625 2.60625 1.25 4.88125 1.25H10.1125C12.3938 1.25 13.75 2.60625 13.75 4.88125Z" fill="#$hex"/>'
        '<path d="M7.83125 3.41875L10.5125 6.1C10.6937 6.28125 10.6937 6.58125 10.5125 6.7625C10.3312 6.94375 10.0312 6.94375 9.85 6.7625L7.96875 4.88125V11.25C7.96875 11.5063 7.75625 11.7188 7.5 11.7188C7.24375 11.7188 7.03125 11.5063 7.03125 11.25V4.88125L5.15 6.7625C4.96875 6.94375 4.66875 6.94375 4.4875 6.7625C4.39375 6.66875 4.35 6.55 4.35 6.43125C4.35 6.3125 4.4 6.1875 4.4875 6.1L7.16875 3.41875C7.25625 3.33125 7.375 3.28125 7.5 3.28125C7.625 3.28125 7.74375 3.33125 7.83125 3.41875Z" fill="#$hex"/>'
        '</svg>';
    return ExcludeSemantics(
      child: SvgPicture.string(svg, width: size, height: size),
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
