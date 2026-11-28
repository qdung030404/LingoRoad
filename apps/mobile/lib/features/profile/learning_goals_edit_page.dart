import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import 'cefr_road_chart.dart';
import 'profile_constants.dart';

part 'learning_goals_edit_sections.dart';
part 'learning_goals_edit_widgets.dart';

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
  static List<String> _dedupeKinds(Iterable<String> raw) {
    final seen = <String>{};
    return [
      for (final k in raw)
        if (seen.add(k)) k,
    ];
  }

  late int _expectedVersion;
  late String _savedPurpose;
  late String _savedCefr;
  late int _savedMinutes;
  late List<String> _savedKinds;

  late String _draftPurpose;
  late String _draftCefr;
  late int _draftMinutes;
  late List<String> _draftKinds;

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
    _savedKinds = _dedupeKinds(rawKinds);
    if (_savedKinds.isEmpty) _savedKinds = [...allPreferredLearningKinds];

    _draftPurpose = _savedPurpose;
    _draftCefr = _savedCefr;
    _draftMinutes = _savedMinutes;
    _draftKinds = List<String>.from(_savedKinds);
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
      !listEquals(_draftKinds, _savedKinds);

  List<String> get _orderedDraftKinds => List<String>.unmodifiable(_draftKinds);

  List<String> get _cefrOptions {
    final base = [...selectableTargetCefrLevels];
    if (!base.contains(_savedCefr)) base.insert(0, _savedCefr);
    if (!base.contains(_draftCefr)) base.add(_draftCefr);
    return base;
  }

  List<int> get _minuteOptions =>
      {...dailyGoalMinuteOptions, _savedMinutes, _draftMinutes}.toList()
        ..sort();

  Map<String, String> get _purposeOptions => {
    ...learningPurposes,
    if (!learningPurposes.containsKey(_draftPurpose))
      _draftPurpose: learningPurposeLabelVi(_draftPurpose),
  };

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
      final srvKinds = _dedupeKinds(
        ((srv['preferredKinds'] as List?) ?? const []).cast<String>(),
      );

      final matchesDraft =
          (srvPurpose == null || srvPurpose == _draftPurpose) &&
          srvCefr == _draftCefr &&
          srvMinutes == _draftMinutes &&
          listEquals(srvKinds, _draftKinds);
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
        if (!listEquals(srvKinds, _draftKinds))
          _GoalDiffEntry(
            label: 'Nhóm bài ưu tiên',
            draftValue: formatKindsSummary(_draftKinds),
            serverValue: formatKindsSummary(srvKinds),
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
      _savedKinds = _dedupeKinds(conflict.serverKinds);
      _draftKinds = List<String>.from(_savedKinds);
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
          borderRadius: AppRadius.dialogRadius,
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
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
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
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
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
    final buttonLabel = _draftKinds.isEmpty
        ? 'Chọn ít nhất 1 kỹ năng'
        : _conflict != null
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

    if (_saving) {
      return SizedBox(
        key: const Key('goalsLoadingButton'),
        height: 50,
        width: double.infinity,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: ProfilePalette.ink.withValues(alpha: 0.88),
            borderRadius: AppRadius.buttonRadius,
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
                  weight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      height: 50,
      width: double.infinity,
      child: ElevatedButton(
        key: const Key('goalsSaveButton'),
        style: ElevatedButton.styleFrom(
          backgroundColor: ProfilePalette.ink,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.grey50,
          disabledForegroundColor: AppColors.grey500,
          elevation: 0,
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadius.buttonRadius,
          ),
        ),
        onPressed: canSubmit ? _save : null,
        child: Text(
          buttonLabel,
          style: designText(
            16,
            weight: FontWeight.w700,
            color: canSubmit ? Colors.white : AppColors.grey500,
          ),
        ),
      ),
    );
  }

  Widget _buildPurposeGrid(BoxConstraints constraints) {
    final entries = _purposeOptions.entries.toList();
    final twoCols = constraints.maxWidth >= 290;
    if (!twoCols) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _PurposeOptionCard(
              key: ValueKey('purpose-chip-${entries[i].key}'),
              glyph: learningPurposeGlyph(entries[i].key),
              label: entries[i].value,
              selected: _draftPurpose == entries[i].key,
              onTap: _saving
                  ? null
                  : () => setState(() {
                      _draftPurpose = entries[i].key;
                      _saveError = null;
                    }),
            ),
          ],
        ],
      );
    }

    final rows = <Widget>[];
    for (var i = 0; i < entries.length; i += 2) {
      final left = entries[i];
      final right = i + 1 < entries.length ? entries[i + 1] : null;
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 8));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _PurposeOptionCard(
                  key: ValueKey('purpose-chip-${left.key}'),
                  glyph: learningPurposeGlyph(left.key),
                  label: left.value,
                  selected: _draftPurpose == left.key,
                  onTap: _saving
                      ? null
                      : () => setState(() {
                          _draftPurpose = left.key;
                          _saveError = null;
                        }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: right == null
                    ? const SizedBox.shrink()
                    : _PurposeOptionCard(
                        key: ValueKey('purpose-chip-${right.key}'),
                        glyph: learningPurposeGlyph(right.key),
                        label: right.value,
                        selected: _draftPurpose == right.key,
                        onTap: _saving
                            ? null
                            : () => setState(() {
                                _draftPurpose = right.key;
                                _saveError = null;
                              }),
                      ),
              ),
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }

  void _updateState(VoidCallback fn) => setState(fn);

  @override
  Widget build(BuildContext context) => _buildDialogContent(context);
}
