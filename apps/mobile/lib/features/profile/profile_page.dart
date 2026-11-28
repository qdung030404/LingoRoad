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

part 'profile_page_hero.dart';
part 'profile_page_skills.dart';
part 'profile_page_password.dart';


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

