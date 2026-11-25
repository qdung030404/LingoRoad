import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_dropdown.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import 'profile_constants.dart';

class _GoalDiffEntry {
  const _GoalDiffEntry({
    required this.label,
    required this.draftValue,
    required this.serverValue,
  });
  final String label;
  final String draftValue;
  final String serverValue;
}

class _GoalConflictSnapshot {
  const _GoalConflictSnapshot({
    required this.serverVersion,
    required this.serverPurpose,
    required this.serverCefr,
    required this.serverMinutes,
    required this.serverKinds,
    required this.diffs,
    required this.rawSnapshot,
  });

  final int serverVersion;
  final String? serverPurpose;
  final String serverCefr;
  final int serverMinutes;
  final List<String> serverKinds;
  final List<_GoalDiffEntry> diffs;
  final Json rawSnapshot;
}

enum _LeaveDecision { stay, saveAndLeave, discard }

class LearningGoalsEditPage extends StatefulWidget {
  const LearningGoalsEditPage({
    super.key,
    required this.session,
    this.initialVersion,
    this.initialPurpose,
    this.initialTargetCefr,
    this.initialMinutes,
    this.initialKinds,
  });

  final SessionController session;
  final int? initialVersion;
  final String? initialPurpose;
  final String? initialTargetCefr;
  final int? initialMinutes;
  final List<String>? initialKinds;

  @override
  State<LearningGoalsEditPage> createState() => _LearningGoalsEditPageState();
}

class _LearningGoalsEditPageState extends State<LearningGoalsEditPage> {
  late int _expectedVersion;
  late String _savedPurpose;
  late String _savedCefr;
  late int _savedMinutes;
  late Set<String> _savedKinds;

  late String _draftPurpose;
  late String _draftCefr;
  late int _draftMinutes;
  late Set<String> _draftKinds;

  bool _saving = false;
  String? _saveError;
  _GoalConflictSnapshot? _conflict;

  @override
  void initState() {
    super.initState();
    final prof = widget.session.profile;
    _expectedVersion =
        widget.initialVersion ??
        (prof['preferencesVersion'] as num?)?.toInt() ??
        0;
    _savedPurpose =
        widget.initialPurpose ??
        (prof['learningPurpose'] as String?) ??
        'WORK';
    _savedCefr =
        widget.initialTargetCefr ?? (prof['targetCefr'] as String?) ?? 'B1';
    _savedMinutes =
        widget.initialMinutes ??
        (prof['dailyGoalMinutes'] as num?)?.toInt() ??
        10;
    final rawKinds =
        widget.initialKinds ??
        (prof['preferredKinds'] as List?)?.cast<String>() ??
        allPreferredLearningKinds;
    _savedKinds = rawKinds.toSet();
    if (_savedKinds.isEmpty) _savedKinds = allPreferredLearningKinds.toSet();

    _draftPurpose = _savedPurpose;
    _draftCefr = _savedCefr;
    _draftMinutes = _savedMinutes;
    _draftKinds = Set<String>.from(_savedKinds);
  }

  bool get _isDirty =>
      _draftPurpose != _savedPurpose ||
      _draftCefr != _savedCefr ||
      _draftMinutes != _savedMinutes ||
      !setEquals(_draftKinds, _savedKinds);

  List<String> get _orderedDraftKinds => [
    for (final k in allPreferredLearningKinds)
      if (_draftKinds.contains(k)) k,
  ];

  List<String> get _cefrOptions => [
    if (!selectableTargetCefrLevels.contains(_savedCefr)) _savedCefr,
    ...selectableTargetCefrLevels,
  ];

  List<int> get _minuteOptions =>
      {...dailyGoalMinuteOptions, _savedMinutes}.toList()..sort();

  Future<bool> _save() async {
    if (_saving || _draftKinds.isEmpty) return false;
    setState(() {
      _saving = true;
      _saveError = null;
      _conflict = null;
    });
    try {
      await widget.session.saveLearningGoals(
        expectedVersion: _expectedVersion,
        learningPurpose: _draftPurpose,
        targetCefr: _draftCefr,
        dailyGoalMinutes: _draftMinutes,
        preferredKinds: _orderedDraftKinds,
      );
      if (!mounted) return true;
      Navigator.of(context).pop(true);
      return true;
    } on ApiFailure catch (e) {
      if (!mounted) return false;
      if (e.status == 409) {
        return _handleConflict();
      }
      setState(() {
        _saving = false;
        _saveError = e.message;
      });
      return false;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        _saving = false;
        _saveError = errorMessage(e);
      });
      return false;
    }
  }

  Future<bool> _handleConflict() async {
    try {
      final srv = await widget.session.api.request(
        'GET',
        '/learning/preferences',
      );
      if (!mounted) return false;
      final srvVersion = (srv['version'] as num?)?.toInt() ?? _expectedVersion;
      final srvPurpose =
          (srv['learningPurpose'] as String?) ??
          (widget.session.profile['learningPurpose'] as String?);
      final srvCefr =
          (srv['targetCefr'] as String?) ??
          (widget.session.profile['targetCefr'] as String?) ??
          _savedCefr;
      final srvMinutes =
          (srv['dailyGoalMinutes'] as num?)?.toInt() ?? _savedMinutes;
      final srvKinds = ((srv['preferredKinds'] as List?) ?? const [])
          .cast<String>()
          .toList();
      final srvKindSet = srvKinds.toSet();

      final matchesDraft =
          (srvPurpose == null || srvPurpose == _draftPurpose) &&
          srvCefr == _draftCefr &&
          srvMinutes == _draftMinutes &&
          setEquals(srvKindSet, _draftKinds);
      if (matchesDraft) {
        widget.session.applyGoalSnapshot(srv);
        Navigator.of(context).pop(true);
        return true;
      }

      final diffs = <_GoalDiffEntry>[
        if (srvPurpose != null && srvPurpose != _draftPurpose)
          _GoalDiffEntry(
            label: 'Mục đích học',
            draftValue: learningPurposeLabelVi(_draftPurpose),
            serverValue: learningPurposeLabelVi(srvPurpose),
          ),
        if (srvCefr != _draftCefr)
          _GoalDiffEntry(
            label: 'Mục tiêu CEFR',
            draftValue: _draftCefr,
            serverValue: srvCefr,
          ),
        if (srvMinutes != _draftMinutes)
          _GoalDiffEntry(
            label: 'Thời lượng mỗi ngày',
            draftValue: '$_draftMinutes phút',
            serverValue: '$srvMinutes phút',
          ),
        if (!setEquals(srvKindSet, _draftKinds))
          _GoalDiffEntry(
            label: 'Nhóm bài ưu tiên',
            draftValue: formatKindsSummary(_draftKinds),
            serverValue: formatKindsSummary(srvKindSet),
          ),
      ];

      setState(() {
        _saving = false;
        _expectedVersion = srvVersion;
        _conflict = _GoalConflictSnapshot(
          serverVersion: srvVersion,
          serverPurpose: srvPurpose,
          serverCefr: srvCefr,
          serverMinutes: srvMinutes,
          serverKinds: srvKinds,
          diffs: diffs,
          rawSnapshot: srv,
        );
      });
      return false;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        _saving = false;
        _saveError =
            'Thiết lập vừa thay đổi trên thiết bị khác nhưng chưa tải được bản mới: ${errorMessage(e)}';
      });
      return false;
    }
  }

  void _applyServerVersion(_GoalConflictSnapshot conflict) {
    widget.session.applyGoalSnapshot(conflict.rawSnapshot);
    setState(() {
      _expectedVersion = conflict.serverVersion;
      if (conflict.serverPurpose != null) {
        _savedPurpose = conflict.serverPurpose!;
        _draftPurpose = conflict.serverPurpose!;
      }
      _savedCefr = conflict.serverCefr;
      _draftCefr = conflict.serverCefr;
      _savedMinutes = conflict.serverMinutes;
      _draftMinutes = conflict.serverMinutes;
      _savedKinds = conflict.serverKinds.toSet();
      _draftKinds = Set<String>.from(_savedKinds);
      _conflict = null;
      _saveError = null;
    });
  }

  Future<void> _handleBackPressed() async {
    if (_saving) return;
    if (!_isDirty) {
      Navigator.of(context).pop(false);
      return;
    }
    final decision = await showDialog<_LeaveDecision>(
      context: context,
      barrierColor: AppColors.overlayPopup,
      builder: (dialogContext) => Dialog(
        backgroundColor: AppColors.grey0,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.dialogRadius),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Chưa lưu thay đổi', style: designHeading(20)),
              const SizedBox(height: 10),
              Text(
                'Bạn có thay đổi mục tiêu học tập chưa lưu. Bạn muốn tiếp tục chỉnh sửa hay rời trang?',
                style: designText(14, color: AppColors.grey800, height: 1.5),
              ),
              const SizedBox(height: 20),
              CustomAppButton(
                key: const Key('leaveDialogContinueButton'),
                text: 'Tiếp tục chỉnh sửa',
                onPressed: () =>
                    Navigator.of(dialogContext).pop(_LeaveDecision.stay),
              ),
              const SizedBox(height: 10),
              CustomAppButton(
                key: const Key('leaveDialogSaveAndLeaveButton'),
                text: 'Lưu và rời trang',
                isSecondary: true,
                onPressed: () => Navigator.of(
                  dialogContext,
                ).pop(_LeaveDecision.saveAndLeave),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 48,
                width: double.infinity,
                child: OutlinedButton(
                  key: const Key('leaveDialogDiscardButton'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.error0,
                    foregroundColor: AppColors.error200,
                    side: const BorderSide(color: AppColors.error25),
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
                    ),
                  ),
                  onPressed: () =>
                      Navigator.of(dialogContext).pop(_LeaveDecision.discard),
                  child: Text(
                    'Bỏ thay đổi',
                    style: designText(
                      16,
                      weight: FontWeight.w600,
                      color: AppColors.error200,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || decision == null || decision == _LeaveDecision.stay) {
      return;
    }
    if (decision == _LeaveDecision.discard) {
      Navigator.of(context).pop(false);
      return;
    }
    if (decision == _LeaveDecision.saveAndLeave) {
      await _save();
    }
  }

  Widget _buildBottomBar(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final buttonLabel = _conflict != null
        ? 'Lưu lựa chọn đang sửa'
        : _saveError != null
        ? 'Lưu lại thay đổi'
        : _isDirty
        ? 'Lưu thay đổi'
        : 'Chưa có thay đổi';
    final canSubmit = !_saving && _draftKinds.isNotEmpty && (_isDirty || _conflict != null || _saveError != null);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.grey0,
        border: Border(top: BorderSide(color: AppColors.grey200)),
      ),
      padding: EdgeInsets.fromLTRB(16, 12, 16, math.max(16, bottomInset + 8)),
      child: _saving
          ? SizedBox(
              key: const Key('goalsLoadingButton'),
              height: 48,
              width: double.infinity,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.primary500.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Đang lưu...',
                      style: designText(
                        16,
                        weight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : CustomAppButton(
              key: const Key('goalsSaveButton'),
              text: buttonLabel,
              onPressed: canSubmit ? _save : null,
            ),
    );
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_isDirty && !_saving,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _handleBackPressed();
    },
    child: Scaffold(
      backgroundColor: AppColors.grey25,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: math.max(0, 56 - MediaQuery.paddingOf(context).top),
            ),
            SizedBox(
              height: 52,
              child: Row(
                children: [
                  SizedBox(
                    width: 56,
                    child: IconButton(
                      key: const Key('goalsBackButton'),
                      tooltip: 'Quay lại',
                      onPressed: _saving ? null : _handleBackPressed,
                      icon: const FigmaAsset('intro/imgVuesaxLinearArrowLeft'),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Mục tiêu học tập',
                      textAlign: TextAlign.center,
                      style: designText(18, weight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 56),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                  IgnorePointer(
                    ignoring: _saving,
                    child: AnimatedOpacity(
                      opacity: _saving ? 0.6 : 1,
                      duration: const Duration(milliseconds: 160),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FigmaCard(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                FigmaDropdown(
                                  key: const Key('goalsPurposeDropdown'),
                                  label: 'Bạn học tiếng Anh để làm gì?',
                                  value: _draftPurpose,
                                  items: learningPurposes,
                                  onChanged: (val) => setState(() {
                                    _draftPurpose = val;
                                    _saveError = null;
                                  }),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Mục tiêu trình độ CEFR',
                                  style: designHeading(16),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Chọn 1 mức trình độ bạn hướng tới',
                                  style: designText(
                                    14,
                                    color: AppColors.grey800,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    for (final lvl in _cefrOptions)
                                      _SingleChoicePill(
                                        key: ValueKey('cefr-pill-$lvl'),
                                        label: lvl,
                                        selected: _draftCefr == lvl,
                                        onTap: () => setState(() {
                                          _draftCefr = lvl;
                                          _saveError = null;
                                        }),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          FigmaCard(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Thời gian học mỗi ngày',
                                  style: designHeading(16),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Chọn 1 mức thời lượng phù hợp lịch sinh hoạt',
                                  style: designText(
                                    14,
                                    color: AppColors.grey800,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    for (final mins in _minuteOptions)
                                      _SingleChoicePill(
                                        key: ValueKey('minutes-pill-$mins'),
                                        label: '$mins phút',
                                        selected: _draftMinutes == mins,
                                        onTap: () => setState(() {
                                          _draftMinutes = mins;
                                          _saveError = null;
                                        }),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          FigmaCard(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Nhóm bài ưu tiên',
                                  style: designHeading(16),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Có thể chọn nhiều nhóm bài để hệ thống phân bổ mỗi ngày.',
                                  style: designText(
                                    14,
                                    color: AppColors.grey800,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    for (final kind in allPreferredLearningKinds)
                                      _MultiSelectChip(
                                        key: ValueKey('kind-chip-$kind'),
                                        label: learningKindLabelVi(kind),
                                        selected: _draftKinds.contains(kind),
                                        onTap: () => setState(() {
                                          if (_draftKinds.contains(kind)) {
                                            if (_draftKinds.length > 1) {
                                              _draftKinds.remove(kind);
                                            }
                                          } else {
                                            _draftKinds.add(kind);
                                          }
                                          _saveError = null;
                                        }),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Thay đổi áp dụng ngay cho kế hoạch hôm nay; kết quả đánh giá trình độ của bạn được giữ nguyên.',
                    style: designText(14, color: AppColors.grey800, height: 1.45),
                  ),
                  if (_saveError != null) ...[
                    const SizedBox(height: 14),
                    _GoalsErrorBanner(message: _saveError!),
                  ],
                  if (_conflict != null) ...[
                    const SizedBox(height: 14),
                    _ConflictResolutionCard(
                      conflict: _conflict!,
                      onUseServer: _saving
                          ? null
                          : () => _applyServerVersion(_conflict!),
                    ),
                  ],
                ],
                ),
              ),
            ),
            _buildBottomBar(context),
          ],
        ),
      ),
    ),
  );
}

class _SingleChoicePill extends StatelessWidget {
  const _SingleChoicePill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Material(
      color: selected ? AppColors.grey900 : AppColors.grey0,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.pill,
        side: BorderSide(
          color: selected ? AppColors.grey900 : AppColors.grey200,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pill,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48, minWidth: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                style: designText(
                  14,
                  weight: FontWeight.w500,
                  color: selected ? AppColors.grey0 : AppColors.grey900,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _MultiSelectChip extends StatelessWidget {
  const _MultiSelectChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Material(
      color: selected ? AppColors.primary25 : AppColors.grey0,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardSm,
        side: BorderSide(
          color: selected ? AppColors.primary500 : AppColors.grey200,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.cardSm,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  selected
                      ? Icons.check_box_rounded
                      : Icons.check_box_outline_blank_rounded,
                  size: 20,
                  color: selected ? AppColors.primary600 : AppColors.grey400,
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: designText(
                    14,
                    weight: FontWeight.w500,
                    color: AppColors.grey900,
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

class _GoalsErrorBanner extends StatelessWidget {
  const _GoalsErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error0,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.error25),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 20,
            color: AppColors.error200,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: designText(14, color: AppColors.error200, height: 1.45),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ConflictResolutionCard extends StatelessWidget {
  const _ConflictResolutionCard({
    required this.conflict,
    required this.onUseServer,
  });
  final _GoalConflictSnapshot conflict;
  final VoidCallback? onUseServer;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      key: const Key('goalsConflictBox'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.grey50,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.grey300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Thiết lập vừa thay đổi trên thiết bị khác',
            style: designText(
              14,
              weight: FontWeight.w600,
              color: AppColors.grey900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Lựa chọn đang sửa của bạn (trái) khác với bản mới trên máy chủ (phải):',
            style: designText(14, color: AppColors.grey800, height: 1.4),
          ),
          const SizedBox(height: 6),
          for (final diff in conflict.diffs)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '• ${diff.label}: ${diff.draftValue} ↔ ${diff.serverValue}',
                style: designText(14, color: AppColors.grey900, height: 1.4),
              ),
            ),
          const SizedBox(height: 10),
          CustomAppButton(
            key: const Key('goalsUseServerButton'),
            text: 'Tải bản mới từ máy chủ',
            isSecondary: true,
            onPressed: onUseServer,
          ),
        ],
      ),
    ),
  );
}
