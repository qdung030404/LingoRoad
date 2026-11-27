import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import 'profile_constants.dart';
import 'profile_edit_dialog.dart';

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

class LearningGoalsEditDialog extends StatefulWidget {
  const LearningGoalsEditDialog({
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
  State<LearningGoalsEditDialog> createState() =>
      _LearningGoalsEditDialogState();
}

class _LearningGoalsEditDialogState extends State<LearningGoalsEditDialog> {
  late int _expectedVersion;
  late String _savedPurpose;
  late String _savedCefr;
  late int _savedMinutes;
  late Set<String> _savedKinds;

  late String _draftPurpose;
  late String _draftCefr;
  late int _draftMinutes;
  late Set<String> _draftKinds;

  final _scrollController = ScrollController();
  bool _saving = false;
  bool _confirmingLeave = false;
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
        widget.initialPurpose ?? (prof['learningPurpose'] as String?) ?? 'WORK';
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

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _revealFeedback() {
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
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
      _revealFeedback();
      return false;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        _saving = false;
        _saveError = errorMessage(e);
      });
      _revealFeedback();
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
      _revealFeedback();
      return false;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        _saving = false;
        _saveError =
            'Thiết lập vừa thay đổi trên thiết bị khác nhưng chưa tải được bản mới: ${errorMessage(e)}';
      });
      _revealFeedback();
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
    if (_saving || _confirmingLeave) return;
    if (!_isDirty) {
      Navigator.of(context).pop(false);
      return;
    }
    _confirmingLeave = true;
    final decision = await showDialog<_LeaveDecision>(
      context: context,
      barrierColor: AppColors.overlayPopup,
      builder: (dialogContext) => Dialog(
        backgroundColor: ProfilePalette.paper,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: ProfilePalette.goalsBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Chưa lưu thay đổi',
                style: designHeading(20, color: ProfilePalette.ink),
              ),
              const SizedBox(height: 10),
              Text(
                'Bạn có thay đổi mục tiêu học tập chưa lưu.',
                style: designText(14, color: ProfilePalette.muted, height: 1.5),
              ),
              const SizedBox(height: 20),
              SizedBox(
                height: 48,
                width: double.infinity,
                child: ElevatedButton(
                  key: const Key('leaveDialogContinueButton'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ProfilePalette.ink,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  onPressed: () =>
                      Navigator.of(dialogContext).pop(_LeaveDecision.stay),
                  child: Text(
                    'Tiếp tục chỉnh sửa',
                    style: designText(
                      15,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              CustomAppButton(
                key: const Key('leaveDialogSaveAndLeaveButton'),
                text: 'Lưu và đóng',
                isSecondary: true,
                borderRadius: BorderRadius.circular(9),
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
                    foregroundColor: ProfilePalette.danger,
                    side: const BorderSide(color: AppColors.error25),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  onPressed: () =>
                      Navigator.of(dialogContext).pop(_LeaveDecision.discard),
                  child: Text(
                    'Bỏ thay đổi',
                    style: designText(
                      15,
                      weight: FontWeight.w600,
                      color: ProfilePalette.danger,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    _confirmingLeave = false;
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

  Widget _buildSaveAction() {
    final buttonLabel = _conflict != null
        ? 'Lưu lựa chọn đang sửa'
        : _saveError != null
        ? 'Lưu lại thay đổi'
        : _isDirty
        ? 'Lưu thay đổi'
        : 'Chưa có thay đổi';
    final canSubmit =
        !_saving &&
        _draftKinds.isNotEmpty &&
        (_isDirty || _conflict != null || _saveError != null);

    return _saving
        ? SizedBox(
            key: const Key('goalsLoadingButton'),
            height: 48,
            width: double.infinity,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: ProfilePalette.ink.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(9),
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
                      15,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          )
        : SizedBox(
            height: 48,
            width: double.infinity,
            child: ElevatedButton(
              key: const Key('goalsSaveButton'),
              style: ElevatedButton.styleFrom(
                backgroundColor: ProfilePalette.ink,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.grey200,
                disabledForegroundColor: AppColors.grey500,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
              onPressed: canSubmit ? _save : null,
              child: Text(
                buttonLabel,
                style: designText(
                  15,
                  weight: FontWeight.w700,
                  color: canSubmit ? Colors.white : AppColors.grey500,
                ),
              ),
            ),
          );
  }

  @override
  Widget build(BuildContext context) => PopScope<bool>(
    canPop: !_isDirty && !_saving,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _handleBackPressed();
    },
    child: ProfileEditDialog(
      key: const Key('learningGoalsEditDialog'),
      title: 'Mục tiêu học tập',
      closeKey: const Key('goalsBackButton'),
      onClose: _saving ? null : _handleBackPressed,
      scrollController: _scrollController,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_saveError != null) ...[
            _GoalsErrorBanner(message: _saveError!),
            const SizedBox(height: 12),
          ],
          if (_conflict != null) ...[
            _ConflictResolutionCard(
              conflict: _conflict!,
              onUseServer: _saving
                  ? null
                  : () => _applyServerVersion(_conflict!),
            ),
            const SizedBox(height: 12),
          ],
          _GoalSelect(
            key: const Key('goalsPurposeDropdown'),
            label: 'Mục đích',
            value: _draftPurpose,
            items: {
              ...learningPurposes,
              if (!learningPurposes.containsKey(_draftPurpose))
                _draftPurpose: learningPurposeLabelVi(_draftPurpose),
            },
            onChanged: _saving
                ? null
                : (value) => setState(() {
                    _draftPurpose = value;
                    _saveError = null;
                  }),
          ),
          const SizedBox(height: 12),
          _GoalSelect(
            key: const Key('goalsCefrDropdown'),
            label: 'Trình độ mục tiêu',
            value: _draftCefr,
            items: {for (final level in _cefrOptions) level: level},
            onChanged: _saving
                ? null
                : (value) => setState(() {
                    _draftCefr = value;
                    _saveError = null;
                  }),
          ),
          const SizedBox(height: 12),
          _GoalSelect(
            key: const Key('goalsMinutesDropdown'),
            label: 'Phút mỗi ngày',
            value: _draftMinutes.toString(),
            items: {
              for (final minutes in _minuteOptions) '$minutes': '$minutes phút',
            },
            onChanged: _saving
                ? null
                : (value) => setState(() {
                    _draftMinutes = int.parse(value);
                    _saveError = null;
                  }),
          ),
          const SizedBox(height: 12),
          Text(
            'Nhóm bài ưu tiên',
            style: designText(14, weight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              for (final kind in allPreferredLearningKinds)
                _MultiSelectChip(
                  key: ValueKey('kind-chip-$kind'),
                  label: learningKindLabelVi(kind),
                  selected: _draftKinds.contains(kind),
                  onTap: _saving
                      ? null
                      : () => setState(() {
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
      action: _buildSaveAction(),
    ),
  );
}

class _GoalSelect extends StatelessWidget {
  const _GoalSelect({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> items;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(label, style: designText(14, weight: FontWeight.w600)),
      const SizedBox(height: 6),
      DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.grey50,
          border: Border.all(color: AppColors.borderLight),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              itemHeight: 48,
              dropdownColor: ProfilePalette.paper,
              borderRadius: BorderRadius.circular(9),
              style: designText(14, color: ProfilePalette.ink),
              items: [
                for (final entry in items.entries)
                  DropdownMenuItem(value: entry.key, child: Text(entry.value)),
              ],
              onChanged: onChanged == null
                  ? null
                  : (selected) {
                      if (selected != null) onChanged!(selected);
                    },
            ),
          ),
        ),
      ),
    ],
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
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Material(
      color: selected ? ProfilePalette.tagSurface : ProfilePalette.paper,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(9),
        side: BorderSide(
          color: selected ? ProfilePalette.accent : ProfilePalette.inputBorder,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
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
                  color: selected ? ProfilePalette.ink : AppColors.grey400,
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: designText(
                    14,
                    weight: FontWeight.w500,
                    color: selected
                        ? ProfilePalette.tagText
                        : ProfilePalette.ink,
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
            color: ProfilePalette.danger,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: designText(14, color: ProfilePalette.danger, height: 1.45),
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
        color: ProfilePalette.permissionBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProfilePalette.goalsBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Thiết lập vừa thay đổi trên thiết bị khác',
            style: designText(
              14,
              weight: FontWeight.w600,
              color: ProfilePalette.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Lựa chọn đang sửa của bạn (trái) khác với bản mới trên máy chủ (phải):',
            style: designText(14, color: ProfilePalette.muted, height: 1.4),
          ),
          const SizedBox(height: 6),
          for (final diff in conflict.diffs)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '• ${diff.label}: ${diff.draftValue} ↔ ${diff.serverValue}',
                style: designText(14, color: ProfilePalette.ink, height: 1.4),
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
