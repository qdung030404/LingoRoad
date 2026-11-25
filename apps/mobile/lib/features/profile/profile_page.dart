import 'package:flutter/material.dart';
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
import 'learning_goals_edit_page.dart';
import 'profile_constants.dart';
import 'reminder_coordinator.dart';

export 'profile_constants.dart' show learningPurposes;

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.session,
    this.onboarding = false,
    this.reminderPlatform,
  });

  final SessionController session;
  final bool onboarding;
  final ReminderNotificationPlatform? reminderPlatform;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _onboardingForm = GlobalKey<FormState>();
  final _nameEditForm = GlobalKey<FormState>();
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
  bool _editingName = false;
  bool _savingName = false;
  String? _nameError;
  String? _toastMessage;
  bool _busyAction = false;

  @override
  void initState() {
    super.initState();
    if (!widget.onboarding) {
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
    if (oldWidget.session != widget.session ||
        oldWidget.reminderPlatform != widget.reminderPlatform ||
        oldWidget.onboarding != widget.onboarding) {
      _reminderCoordinator?.dispose();
      _reminderCoordinator = null;
      _preferencesSnapshot = null;
      _editingName = false;
      _savingName = false;
      _nameError = null;
      _toastMessage = null;
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
  void dispose() {
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

  Future<void> _saveDisplayName() async {
    if (!_nameEditForm.currentState!.validate()) return;
    setState(() {
      _savingName = true;
      _nameError = null;
      _toastMessage = null;
    });
    try {
      await widget.session.saveProfile({'name': _nameController.text.trim()});
      if (!mounted) return;
      setState(() {
        _savingName = false;
        _editingName = false;
        _toastMessage = 'Đã lưu họ và tên';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _savingName = false;
        _nameError = errorMessage(e);
      });
    }
  }

  Future<void> _openGoalsEditor() async {
    final p = widget.session.profile;
    final snap = _preferencesSnapshot;
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => LearningGoalsEditPage(
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
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      setState(() => _toastMessage = 'Đã lưu mục tiêu học tập');
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

  Future<void> _resetPasswordViaEmail() async {
    setState(() {
      _busyAction = true;
      _toastMessage = null;
    });
    try {
      await widget.session.resetPassword(
        widget.session.user!['email'] as String,
      );
      if (mounted) {
        setState(
          () => _toastMessage = 'Kiểm tra email để đặt lại mật khẩu.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _toastMessage = errorMessage(e));
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
    child: Form(
      key: _onboardingForm,
      child: PageBody(
        children: [
          const BrandHeading(
            title: 'Học theo cách của bạn',
            description: 'Một vài thông tin để bắt đầu hành trình phù hợp.',
          ),
          CustomAppTextField(
            label: 'Họ tên',
            controller: _nameController,
            validator: requiredName,
            enabled: !_onboardingBusy,
          ),
          FigmaDropdown(
            key: const Key('learningPurpose'),
            label: 'Bạn học tiếng Anh để làm gì?',
            value: _onboardingPurpose,
            items: learningPurposes,
            onChanged: _onboardingBusy
                ? null
                : (value) => setState(() => _onboardingPurpose = value),
            validator: (value) => value == null ? 'Chọn mục đích học.' : null,
          ),
          const Text('Thời gian học mỗi ngày'),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              for (final value in [5, 10, 20])
                ChoiceChip(
                  label: Text('$value phút'),
                  selected: _onboardingMinutes == value,
                  onSelected: _onboardingBusy
                      ? null
                      : (_) => setState(() => _onboardingMinutes = value),
                ),
            ],
          ),
          FigmaDropdown(
            label: 'Trình độ tự đánh giá',
            value: _onboardingLevel,
            items: {
              for (final value in ['UNKNOWN', 'A1', 'A2', 'B1', 'B2'])
                value: value == 'UNKNOWN' ? 'Chưa biết' : value,
            },
            onChanged: _onboardingBusy
                ? null
                : (value) => setState(() => _onboardingLevel = value),
          ),
          if (_onboardingError != null) ErrorNotice(_onboardingError!),
          if (_onboardingNotice != null)
            Text(_onboardingNotice!, semanticsLabel: _onboardingNotice),
          primary('Lưu và tiếp tục', _saveOnboarding, busy: _onboardingBusy),
        ],
      ),
    ),
  );

  Widget _buildOverviewScaffold(BuildContext context) {
    final user = widget.session.user ?? const {};
    final profile = widget.session.profile;
    final snap = _preferencesSnapshot;
    final displayName = (user['name'] as String? ?? '').trim();
    final email = user['email'] as String? ?? '';
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
      color: AppColors.grey25,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 360;
          final rem = _reminderCoordinator!.state;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              if (_toastMessage != null) ...[
                _ProfileSuccessToast(
                  message: _toastMessage!,
                  onDismiss: () => setState(() => _toastMessage = null),
                ),
                const SizedBox(height: 16),
              ],
              _IdentityCard(
                displayName: displayName,
                email: email,
                isGoogle: isGoogle,
                isNarrow: isNarrow,
                editingName: _editingName,
                savingName: _savingName,
                nameError: _nameError,
                nameFormKey: _nameEditForm,
                nameController: _nameController,
                onStartEdit: () => setState(() {
                  _nameController.text = displayName;
                  _editingName = true;
                  _nameError = null;
                  _toastMessage = null;
                }),
                onCancelEdit: () => setState(() {
                  _nameController.text = displayName;
                  _editingName = false;
                  _nameError = null;
                }),
                onSaveName: _saveDisplayName,
              ),
              const SizedBox(height: 16),
              _CefrOverviewCard(
                hasPlacement: hasPlacement,
                placementCefr: placementCefr,
                targetCefr: targetCefr,
                placementSkills: placementSkills,
                readingSnap: readingSnap,
                isNarrow: isNarrow,
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
              const SizedBox(height: 16),
              _GoalsSummaryCard(
                purpose: learningPurpose,
                dailyMinutes: dailyMinutes,
                preferredKinds: preferredKinds,
                onEditGoals: _openGoalsEditor,
              ),
              const SizedBox(height: 16),
              _AccountReminderCard(
                reminder: rem,
                isGoogle: isGoogle,
                hasFirebaseIdentity: widget.session.api.identity != null,
                busy: _busyAction,
                onToggleReminder: (val) =>
                    _reminderCoordinator!.setEnabled(val),
                onOpenSystemSettings:
                    _reminderCoordinator!.refreshPermissionAndSchedule,
                onPickTime: () => _pickReminderTime(_reminderCoordinator!),
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
                },
              ),
            ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileSuccessToast extends StatelessWidget {
  const _ProfileSuccessToast({
    required this.message,
    required this.onDismiss,
  });
  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      key: const Key('profileSuccessToast'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.primary200),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            size: 20,
            color: AppColors.primary700,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: designText(
                14,
                weight: FontWeight.w500,
                color: AppColors.primary700,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Đóng thông báo',
            onPressed: onDismiss,
            icon: const Icon(
              Icons.close_rounded,
              size: 18,
              color: AppColors.primary700,
            ),
          ),
        ],
      ),
    ),
  );
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({
    required this.displayName,
    required this.email,
    required this.isGoogle,
    required this.isNarrow,
    required this.editingName,
    required this.savingName,
    required this.nameError,
    required this.nameFormKey,
    required this.nameController,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveName,
  });

  final String displayName;
  final String email;
  final bool isGoogle;
  final bool isNarrow;
  final bool editingName;
  final bool savingName;
  final String? nameError;
  final GlobalKey<FormState> nameFormKey;
  final TextEditingController nameController;
  final VoidCallback onStartEdit;
  final VoidCallback onCancelEdit;
  final VoidCallback onSaveName;

  Widget _avatar(double size) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: AppColors.primary50,
      shape: BoxShape.circle,
      border: Border.all(color: AppColors.primary200),
    ),
    alignment: Alignment.center,
    child: Text(
      displayName.isNotEmpty ? displayName[0].toUpperCase() : 'L',
      style: designHeading(size * 0.4, color: AppColors.primary700),
    ),
  );

  Widget _providerBadge() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: AppColors.grey50,
      borderRadius: AppRadius.pill,
      border: Border.all(color: AppColors.grey200),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        isGoogle
            ? const FigmaAsset('google/imgLogos', size: 14)
            : const Icon(
                Icons.mail_outline_rounded,
                size: 14,
                color: AppColors.grey800,
              ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            isGoogle ? 'Đã liên kết Google' : 'Tài khoản Email',
            style: designText(
              12,
              weight: FontWeight.w500,
              color: AppColors.grey800,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => FigmaCard(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _avatar(isNarrow ? 56 : 64),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName.isEmpty ? 'Người học LingoRoad' : displayName,
                    key: const Key('profileDisplayName'),
                    style: designHeading(18),
                  ),
                  if (!isNarrow) ...[
                    const SizedBox(height: 4),
                    Text(
                      email,
                      style: designText(14, color: AppColors.grey800),
                    ),
                    const SizedBox(height: 6),
                    _providerBadge(),
                  ],
                ],
              ),
            ),
            if (!editingName) ...[
              const SizedBox(width: 8),
              SizedBox(
                width: 48,
                height: 48,
                child: OutlinedButton(
                  key: const Key('editIdentityButton'),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    side: const BorderSide(color: AppColors.grey200),
                    shape: const CircleBorder(),
                    backgroundColor: AppColors.grey0,
                  ),
                  onPressed: onStartEdit,
                  child: const Tooltip(
                    message: 'Chỉnh sửa họ và tên',
                    child: Icon(
                      Icons.edit_outlined,
                      size: 20,
                      color: AppColors.grey900,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
        if (isNarrow) ...[
          const SizedBox(height: 12),
          Text(email, style: designText(14, color: AppColors.grey800)),
          const SizedBox(height: 6),
          _providerBadge(),
        ],
        if (editingName) ...[
          const SizedBox(height: 14),
          Form(
            key: nameFormKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CustomAppTextField(
                  key: const Key('inlineNameInput'),
                  label: 'Họ và tên',
                  controller: nameController,
                  validator: requiredName,
                  enabled: !savingName,
                ),
                if (nameError != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    nameError!,
                    style: designText(14, color: AppColors.error200),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomAppButton(
                        key: const Key('cancelEditNameButton'),
                        text: 'Hủy',
                        isSecondary: true,
                        onPressed: savingName ? null : onCancelEdit,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomAppButton(
                        key: const Key('saveEditNameButton'),
                        text: 'Lưu tên',
                        isLoading: savingName,
                        onPressed: savingName ? null : onSaveName,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}

class _SkillDisplay {
  const _SkillDisplay({
    required this.kind,
    required this.title,
    required this.level,
    required this.sourceText,
    required this.isMeasured,
  });
  final String kind;
  final String title;
  final String level;
  final String sourceText;
  final bool isMeasured;
}

class _CefrOverviewCard extends StatelessWidget {
  const _CefrOverviewCard({
    required this.hasPlacement,
    required this.placementCefr,
    required this.targetCefr,
    required this.placementSkills,
    required this.readingSnap,
    required this.isNarrow,
    required this.onViewPlacement,
    required this.onStartPlacement,
  });

  final bool hasPlacement;
  final String? placementCefr;
  final String targetCefr;
  final Json? placementSkills;
  final Json? readingSnap;
  final bool isNarrow;
  final VoidCallback? onViewPlacement;
  final VoidCallback onStartPlacement;

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

    final listeningLevel = placeListen ?? (hasPlacement ? placementCefr! : 'A1');
    final listeningSource = hasPlacement ? 'Kết quả đầu vào' : 'Mức khởi đầu';

    final grammarLevel = hasPlacement ? placementCefr! : 'A1';
    final grammarSource = hasPlacement ? 'Theo mức đầu vào' : 'Mức khởi đầu';

    final vocabLevel = hasPlacement ? placementCefr! : 'A1';
    final vocabSource = hasPlacement ? 'Theo mức đầu vào' : 'Mức khởi đầu';

    return [
      _SkillDisplay(
        kind: 'READING',
        title: 'Đọc hiểu',
        level: readingLevel,
        sourceText: readingSource,
        isMeasured: hasPlacement || readingAdaptive,
      ),
      _SkillDisplay(
        kind: 'LISTENING',
        title: 'Nghe hiểu',
        level: listeningLevel,
        sourceText: listeningSource,
        isMeasured: hasPlacement,
      ),
      _SkillDisplay(
        kind: 'GRAMMAR',
        title: 'Ngữ pháp',
        level: grammarLevel,
        sourceText: grammarSource,
        isMeasured: hasPlacement,
      ),
      _SkillDisplay(
        kind: 'VOCABULARY',
        title: 'Từ vựng',
        level: vocabLevel,
        sourceText: vocabSource,
        isMeasured: hasPlacement,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final skills = _buildSkills();
    return FigmaCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Trình độ & Đánh giá', style: designHeading(18)),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary25,
              borderRadius: AppRadius.cardSm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary50,
                        borderRadius: AppRadius.cardSm,
                      ),
                      alignment: Alignment.center,
                      child: const FigmaAsset('home-v3/cup', size: 22),
                    ),
                    const SizedBox(width: 12),
                    if (isNarrow)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Trình độ đầu vào',
                              style: designText(12, color: AppColors.grey800),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              hasPlacement && placementCefr != null
                                  ? cefrLabelWithDescriptor(placementCefr!)
                                  : 'Chưa đánh giá',
                              key: const Key('cefrPlacementSummary'),
                              style: designText(
                                15,
                                weight: FontWeight.w600,
                                color: hasPlacement
                                    ? AppColors.grey900
                                    : AppColors.grey800,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Mục tiêu',
                              style: designText(12, color: AppColors.grey800),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              cefrLabelWithDescriptor(targetCefr),
                              key: const Key('cefrTargetSummary'),
                              style: designText(
                                15,
                                weight: FontWeight.w600,
                                color: AppColors.primary700,
                              ),
                            ),
                          ],
                        ),
                      )
                    else ...[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Trình độ đầu vào',
                              style: designText(12, color: AppColors.grey800),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              hasPlacement && placementCefr != null
                                  ? cefrLabelWithDescriptor(placementCefr!)
                                  : 'Chưa đánh giá',
                              key: const Key('cefrPlacementSummary'),
                              style: designText(
                                16,
                                weight: FontWeight.w600,
                                color: hasPlacement
                                    ? AppColors.grey900
                                    : AppColors.grey800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 36,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                        color: AppColors.grey200,
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Mục tiêu',
                              style: designText(12, color: AppColors.grey800),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              cefrLabelWithDescriptor(targetCefr),
                              key: const Key('cefrTargetSummary'),
                              style: designText(
                                16,
                                weight: FontWeight.w600,
                                color: AppColors.primary700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                if (!hasPlacement) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Làm bài đánh giá 5 phút để lộ trình khớp chính xác năng lực hiện tại.',
                    style: designText(
                      14,
                      color: AppColors.grey800,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                if (hasPlacement)
                  CustomAppButton(
                    key: const Key('viewPlacementResultButton'),
                    text: 'Xem kết quả đầu vào',
                    isSecondary: true,
                    onPressed: onViewPlacement,
                  )
                else
                  CustomAppButton(
                    key: const Key('startPlacementButton'),
                    text: 'Làm bài kiểm tra đầu vào',
                    onPressed: onStartPlacement,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _SkillTile(skill: skills[0])),
                const SizedBox(width: 12),
                Expanded(child: _SkillTile(skill: skills[1])),
              ],
            ),
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _SkillTile(skill: skills[2])),
                const SizedBox(width: 12),
                Expanded(child: _SkillTile(skill: skills[3])),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SkillTile extends StatelessWidget {
  const _SkillTile({required this.skill});
  final _SkillDisplay skill;

  @override
  Widget build(BuildContext context) => Container(
    key: ValueKey('skillTile-${skill.kind}'),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.grey25,
      borderRadius: AppRadius.cardSm,
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(
              learningKindIcon(skill.kind),
              size: 20,
              color: AppColors.grey900,
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: skill.isMeasured
                    ? AppColors.primary50
                    : AppColors.grey100,
                borderRadius: AppRadius.pill,
              ),
              child: Text(
                skill.level,
                style: designText(
                  12,
                  weight: FontWeight.w600,
                  color: skill.isMeasured
                      ? AppColors.primary700
                      : AppColors.grey800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              skill.title,
              style: designText(14, weight: FontWeight.w600),
            ),
            const SizedBox(height: 2),
            Text(
              skill.sourceText,
              style: designText(
                12,
                color: AppColors.grey800,
                height: 1.35,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _GoalsSummaryCard extends StatelessWidget {
  const _GoalsSummaryCard({
    required this.purpose,
    required this.dailyMinutes,
    required this.preferredKinds,
    required this.onEditGoals,
  });

  final String? purpose;
  final int dailyMinutes;
  final List<String> preferredKinds;
  final VoidCallback onEditGoals;

  @override
  Widget build(BuildContext context) => FigmaCard(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Mục tiêu học tập', style: designHeading(18))),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: OutlinedButton.icon(
                key: const Key('editLearningGoalsButton'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.grey900,
                  backgroundColor: AppColors.grey0,
                  side: const BorderSide(color: AppColors.grey200),
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadius.pill,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
                onPressed: onEditGoals,
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: Text(
                  'Chỉnh sửa',
                  style: designText(14, weight: FontWeight.w500),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _SummaryRow(
          label: 'Mục đích học',
          value: learningPurposeLabelVi(purpose),
        ),
        const SizedBox(height: 10),
        _SummaryRow(
          label: 'Thời lượng mỗi ngày',
          value: '$dailyMinutes phút / ngày',
          valueKey: const Key('summaryDurationValue'),
        ),
        const SizedBox(height: 10),
        Text(
          'Nhóm bài ưu tiên',
          style: designText(14, color: AppColors.grey800),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final kind in preferredKinds)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: AppRadius.tagRadius,
                  border: Border.all(color: AppColors.grey200),
                ),
                child: Text(
                  learningKindLabelVi(kind),
                  style: designText(
                    12,
                    weight: FontWeight.w500,
                    color: AppColors.grey900,
                  ),
                ),
              ),
          ],
        ),
      ],
    ),
  );
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueKey,
  });
  final String label;
  final String value;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Flexible(
        child: Text(label, style: designText(14, color: AppColors.grey800)),
      ),
      const SizedBox(width: 12),
      Flexible(
        child: Text(
          value,
          key: valueKey,
          textAlign: TextAlign.end,
          style: designText(14, weight: FontWeight.w600),
        ),
      ),
    ],
  );
}

class _AccountReminderCard extends StatelessWidget {
  const _AccountReminderCard({
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

  String get _toggleSubtitle {
    if (!reminder.enabled) {
      return 'Đang tắt · Bật để nhận nhắc học mỗi tối';
    }
    if (reminder.needsPermissionBanner) {
      return 'Chưa thể nhắc học — cần cấp quyền thông báo';
    }
    return 'Tự động lưu ngay khi bật hoặc tắt';
  }

  String get _timeSubtitle {
    if (reminder.failedTime != null) {
      return 'Đang giữ ${reminder.serverTime} · Chưa lưu được ${reminder.failedTime}';
    }
    return 'Chạm để đổi khung giờ nhắc mỗi ngày';
  }

  @override
  Widget build(BuildContext context) => FigmaCard(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Tài khoản & Nhắc học', style: designHeading(18)),
        const SizedBox(height: 12),
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Row(
            children: [
              _iconBox(Icons.notifications_none_rounded),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nhắc nhở học hằng ngày',
                      style: designText(15, weight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _toggleSubtitle,
                      key: const Key('reminderToggleSubtitle'),
                      style: designText(13, color: AppColors.grey800),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                child: Center(
                  child: Switch.adaptive(
                    key: const Key('reminderToggleSwitch'),
                    value: reminder.enabled,
                    activeTrackColor: AppColors.primary500,
                    onChanged: onToggleReminder,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (reminder.needsPermissionBanner) ...[
          const SizedBox(height: 12),
          Container(
            key: const Key('notificationPermissionBox'),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey50,
              borderRadius: AppRadius.cardSm,
              border: Border.all(color: AppColors.grey200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.notifications_off_outlined,
                      size: 20,
                      color: AppColors.grey800,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Thiết bị đang chặn thông báo của LingoRoad. Cấp quyền để nhận nhắc học lúc ${reminder.time}.',
                        style: designText(
                          13,
                          color: AppColors.grey800,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                CustomAppButton(
                  key: const Key('openNotificationSettingsButton'),
                  text: 'Mở cài đặt thiết bị',
                  isSecondary: true,
                  onPressed: onOpenSystemSettings,
                ),
              ],
            ),
          ),
        ],
        if (reminder.enabled) ...[
          const SizedBox(height: 12),
          InkWell(
            key: const Key('reminderTimeRow'),
            borderRadius: AppRadius.cardSm,
            onTap: onPickTime,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    _iconBox(Icons.access_time_rounded),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Giờ nhắc học',
                            style: designText(15, weight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _timeSubtitle,
                            style: designText(13, color: AppColors.grey800),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      reminder.time,
                      key: const Key('reminderTimeValue'),
                      style: designText(14, weight: FontWeight.w600),
                    ),
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 20,
                      color: AppColors.grey700,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
        if (reminder.errorMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            key: const Key('reminderErrorBanner'),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.error0,
              borderRadius: AppRadius.cardSm,
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
                      color: AppColors.error200,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        reminder.errorMessage!,
                        style: designText(
                          14,
                          color: AppColors.error200,
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
                  onPressed: reminder.saving ? null : onRetryReminder,
                ),
              ],
            ),
          ),
        ],
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Divider(height: 1, color: AppColors.grey100),
        ),
        if (isGoogle)
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: AppRadius.cardSm,
                ),
                alignment: Alignment.center,
                child: const FigmaAsset('google/imgLogos', size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đăng nhập qua Google',
                      style: designText(15, weight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Mật khẩu được quản lý trực tiếp bởi Google',
                      style: designText(13, color: AppColors.grey800),
                    ),
                  ],
                ),
              ),
            ],
          )
        else
          InkWell(
            key: const Key('accountPasswordActionRow'),
            borderRadius: AppRadius.cardSm,
            onTap: busy
                ? null
                : (hasFirebaseIdentity
                      ? onResetPassword
                      : onOpenChangePassword),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Row(
                children: [
                  _iconBox(Icons.lock_outline_rounded),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          hasFirebaseIdentity
                              ? 'Đặt lại mật khẩu qua email'
                              : 'Đổi mật khẩu',
                          style: designText(15, weight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          hasFirebaseIdentity
                              ? 'Gửi liên kết đặt lại mật khẩu tới email của bạn'
                              : 'Cập nhật mật khẩu đăng nhập hiện tại',
                          style: designText(13, color: AppColors.grey800),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: AppColors.grey700,
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 14),
        CustomAppButton(
          key: const Key('logoutButton'),
          text: 'Đăng xuất',
          isSecondary: true,
          isLoading: busy,
          onPressed: busy ? null : onLogout,
        ),
      ],
    ),
  );

  Widget _iconBox(IconData icon) => Container(
    width: 40,
    height: 40,
    decoration: BoxDecoration(
      color: AppColors.grey50,
      borderRadius: AppRadius.cardSm,
    ),
    alignment: Alignment.center,
    child: Icon(icon, size: 20, color: AppColors.grey800),
  );
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
    child: Form(
      key: form,
      child: PageBody(
        children: [
          const Text(
            'Sau khi đổi mật khẩu, hãy đăng nhập lại bằng mật khẩu mới.',
          ),
          CustomAppTextField(
            label: 'Mật khẩu hiện tại',
            controller: oldPassword,
            isPassword: true,
            validator: (value) => value == null || value.isEmpty
                ? 'Nhập mật khẩu hiện tại.'
                : null,
          ),
          CustomAppTextField(
            label: 'Mật khẩu mới',
            controller: newPassword,
            isPassword: true,
            validator: validPassword,
          ),
          if (error != null) ErrorNotice(error!),
          primary('Đổi mật khẩu', submit, busy: busy),
        ],
      ),
    ),
  );
}
