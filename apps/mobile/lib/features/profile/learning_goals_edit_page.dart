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

  Widget _buildCefrSelector() {
    final levels = _cefrOptions;
    return _NotchedStepSlider<String>(
      sliderKey: const Key('goalsCefrSlider'),
      stops: levels,
      value: _draftCefr,
      enabled: !_saving,
      itemKeyBuilder: (lvl) => ValueKey('cefr-chip-$lvl'),
      labelBuilder: (lvl) => lvl,
      semanticLabelBuilder: cefrLabelWithDescriptor,
      onChanged: (lvl) => setState(() {
        _draftCefr = lvl;
        _saveError = null;
      }),
    );
  }

  Widget _buildMinutesSelector() {
    final options = _minuteOptions;
    return _NotchedStepSlider<int>(
      sliderKey: const Key('goalsMinutesSlider'),
      stops: options,
      value: _draftMinutes,
      enabled: !_saving,
      itemKeyBuilder: (minutes) => ValueKey('minutes-chip-$minutes'),
      labelBuilder: shortDurationStopLabel,
      semanticLabelBuilder: (minutes) =>
          '${formatDailyDurationLabel(minutes)} mỗi ngày',
      onChanged: (minutes) => setState(() {
        _draftMinutes = minutes;
        _saveError = null;
      }),
    );
  }

  Widget _buildPreferredKindsGrid(BoxConstraints constraints) {
    const kinds = allPreferredLearningKinds;
    final twoCols = constraints.maxWidth >= 290;

    void toggleKind(String kind) {
      setState(() {
        if (_draftKinds.contains(kind)) {
          _draftKinds.remove(kind);
        } else {
          _draftKinds.add(kind);
        }
        _saveError = null;
      });
    }

    int? rankOf(String kind) {
      final idx = _draftKinds.indexOf(kind);
      return idx >= 0 ? idx + 1 : null;
    }

    if (!twoCols) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < kinds.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _SkillKindCard(
              key: ValueKey('kind-chip-${kinds[i]}'),
              kind: kinds[i],
              glyph: learningKindGlyph(kinds[i]),
              label: learningKindLabelVi(kinds[i]),
              rank: rankOf(kinds[i]),
              onTap: _saving ? null : () => toggleKind(kinds[i]),
            ),
          ],
        ],
      );
    }

    final rows = <Widget>[];
    for (var i = 0; i < kinds.length; i += 2) {
      final left = kinds[i];
      final right = i + 1 < kinds.length ? kinds[i + 1] : null;
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 8));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _SkillKindCard(
                  key: ValueKey('kind-chip-$left'),
                  kind: left,
                  glyph: learningKindGlyph(left),
                  label: learningKindLabelVi(left),
                  rank: rankOf(left),
                  onTap: _saving ? null : () => toggleKind(left),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: right == null
                    ? const SizedBox.shrink()
                    : _SkillKindCard(
                        key: ValueKey('kind-chip-$right'),
                        kind: right,
                        glyph: learningKindGlyph(right),
                        label: learningKindLabelVi(right),
                        rank: rankOf(right),
                        onTap: _saving ? null : () => toggleKind(right),
                      ),
              ),
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.sizeOf(context).height;
    final bottomInset = math.max(16.0, MediaQuery.paddingOf(context).bottom + 12);

    return PopScope<bool>(
      canPop: !_isDirty && !_saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBackPressed();
      },
      child: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 560,
            maxHeight: screenHeight * 0.9,
          ),
          child: Material(
            key: const Key('learningGoalsEditDialog'),
            color: ProfilePalette.paper,
            borderRadius: AppRadius.bottomSheetRadius,
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Drag handle indicator
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 4),
                    width: 40,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: AppColors.grey200,
                      borderRadius: AppRadius.pill,
                    ),
                  ),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 6, 10, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(
                                'Mục tiêu học tập',
                                style: designHeading(22, color: ProfilePalette.ink)
                                    .copyWith(
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -0.4,
                                    ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Tự động đồng bộ vào kế hoạch học mỗi ngày',
                              style: designText(
                                14,
                                color: ProfilePalette.muted,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        key: const Key('goalsBackButton'),
                        tooltip: 'Đóng',
                        constraints: const BoxConstraints(
                          minWidth: 48,
                          minHeight: 48,
                        ),
                        padding: EdgeInsets.zero,
                        onPressed: _saving ? null : _handleBackPressed,
                        icon: Container(
                          width: 38,
                          height: 38,
                          decoration: const BoxDecoration(
                            color: AppColors.grey50,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: const ConceptSvgIcon(
                            ConceptGlyph.close,
                            size: 18,
                            color: ProfilePalette.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, thickness: 1, color: ProfilePalette.line),
                // Scrollable form body
                Flexible(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                    child: LayoutBuilder(
                      builder: (context, constraints) => Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (_saveError != null) ...[
                            _GoalsErrorBanner(message: _saveError!),
                            const SizedBox(height: 14),
                          ],
                          if (_conflict != null) ...[
                            _ConflictResolutionCard(
                              conflict: _conflict!,
                              onUseServer: _saving
                                  ? null
                                  : () => _applyServerVersion(_conflict!),
                            ),
                            const SizedBox(height: 14),
                          ],
                          Text(
                            'Mục đích học',
                            style: designHeading(
                              16.5,
                              color: ProfilePalette.ink,
                            ),
                          ),
                          const SizedBox(height: 10),
                          _buildPurposeGrid(constraints),
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'Trình độ mục tiêu',
                                  style: designHeading(
                                    16.5,
                                    color: ProfilePalette.ink,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              ConstrainedBox(
                                constraints: BoxConstraints(
                                  maxWidth: constraints.maxWidth * 0.52,
                                ),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 11,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary25,
                                    borderRadius: AppRadius.tagRadius,
                                    border: Border.all(
                                      color: AppColors.primary100,
                                    ),
                                  ),
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      cefrLabelWithDescriptor(_draftCefr),
                                      key: const Key('goalsCefrBadgeValue'),
                                      style: designText(
                                        13.5,
                                        weight: FontWeight.w700,
                                        color: ProfilePalette.accent,
                                        height: 1.2,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _buildCefrSelector(),
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'Thời lượng mỗi ngày',
                                  style: designHeading(
                                    16.5,
                                    color: ProfilePalette.ink,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              ConstrainedBox(
                                constraints: BoxConstraints(
                                  maxWidth: constraints.maxWidth * 0.54,
                                ),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 11,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary25,
                                    borderRadius: AppRadius.tagRadius,
                                    border: Border.all(
                                      color: AppColors.primary100,
                                    ),
                                  ),
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      formatDailyDurationLabel(_draftMinutes),
                                      key: const Key('goalsMinutesBadgeValue'),
                                      style:
                                          designText(
                                            13.5,
                                            weight: FontWeight.w700,
                                            color: ProfilePalette.accent,
                                            height: 1.2,
                                          ).copyWith(
                                            fontFeatures: const [
                                              FontFeature.tabularFigures(),
                                            ],
                                          ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _buildMinutesSelector(),
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'Nhóm bài ưu tiên',
                                  style: designHeading(
                                    16.5,
                                    color: ProfilePalette.ink,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'Đã chọn ${_draftKinds.length}/${allPreferredLearningKinds.length}',
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
                                  if (_draftKinds.isNotEmpty) ...[
                                    const SizedBox(width: 10),
                                    InkWell(
                                      key: const Key('goalsResetKindOrder'),
                                      onTap: _saving
                                          ? null
                                          : () => setState(() {
                                              _draftKinds.clear();
                                              _saveError = null;
                                            }),
                                      borderRadius: BorderRadius.circular(8),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 4,
                                          vertical: 2,
                                        ),
                                        child: Text(
                                          'Đặt lại',
                                          style: designText(
                                            13.5,
                                            weight: FontWeight.w700,
                                            color: ProfilePalette.accent,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _buildPreferredKindsGrid(constraints),
                        ],
                      ),
                    ),
                  ),
                ),
                // Pinned footer action
                Container(
                  padding: EdgeInsets.fromLTRB(20, 12, 20, bottomInset),
                  decoration: const BoxDecoration(
                    color: ProfilePalette.paper,
                    border: Border(top: BorderSide(color: ProfilePalette.line)),
                  ),
                  child: _buildSaveAction(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotchedStepSlider<T> extends StatelessWidget {
  const _NotchedStepSlider({
    required this.sliderKey,
    required this.stops,
    required this.value,
    required this.enabled,
    required this.itemKeyBuilder,
    required this.labelBuilder,
    required this.semanticLabelBuilder,
    required this.onChanged,
  });

  final Key sliderKey;
  final List<T> stops;
  final T value;
  final bool enabled;
  final Key Function(T stop) itemKeyBuilder;
  final String Function(T stop) labelBuilder;
  final String Function(T stop) semanticLabelBuilder;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final count = stops.length;
    if (count == 0) return const SizedBox.shrink();
    final rawIdx = stops.indexOf(value);
    final selectedIndex = rawIdx >= 0 ? rawIdx : 0;
    final maxVal = math.max(1, count - 1).toDouble();

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
      decoration: BoxDecoration(
        color: AppColors.grey5,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProfilePalette.line),
      ),
      child: LayoutBuilder(
        builder: (context, box) {
          final horizontalInset = box.maxWidth / (2 * count);
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 40,
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 7.5,
                    trackShape: _NotchedRulerTrackShape(
                      stopCount: count,
                      selectedIndex: selectedIndex,
                      horizontalInset: horizontalInset,
                    ),
                    thumbShape: const _NotchedRulerThumbShape(),
                    overlayShape: const RoundSliderOverlayShape(
                      overlayRadius: 18,
                    ),
                    tickMarkShape: SliderTickMarkShape.noTickMark,
                    overlayColor: AppColors.primary.withValues(alpha: 0.14),
                  ),
                  child: Slider(
                    key: sliderKey,
                    min: 0,
                    max: maxVal,
                    divisions: count > 1 ? count - 1 : null,
                    value: selectedIndex.toDouble().clamp(0, maxVal),
                    semanticFormatterCallback: (raw) {
                      final idx = raw.round().clamp(0, count - 1);
                      return semanticLabelBuilder(stops[idx]);
                    },
                    onChanged: !enabled || count <= 1
                        ? null
                        : (raw) {
                            final nextIdx = raw.round().clamp(0, count - 1);
                            if (nextIdx != selectedIndex) {
                              HapticFeedback.selectionClick();
                              onChanged(stops[nextIdx]);
                            }
                          },
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  for (var i = 0; i < count; i++)
                    Expanded(
                      child: _NotchStopButton(
                        key: itemKeyBuilder(stops[i]),
                        label: labelBuilder(stops[i]),
                        semanticLabel: semanticLabelBuilder(stops[i]),
                        selected: i == selectedIndex,
                        passed: i < selectedIndex,
                        onTap: !enabled
                            ? null
                            : () {
                                if (i != selectedIndex) {
                                  HapticFeedback.selectionClick();
                                }
                                onChanged(stops[i]);
                              },
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _NotchStopButton extends StatelessWidget {
  const _NotchStopButton({
    super.key,
    required this.label,
    required this.semanticLabel,
    required this.selected,
    required this.passed,
    required this.onTap,
  });

  final String label;
  final String semanticLabel;
  final bool selected;
  final bool passed;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: semanticLabel,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 38),
          child: Center(
            child: AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary50 : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: selected
                    ? Border.all(color: AppColors.primary200)
                    : null,
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  style:
                      designText(
                        13,
                        weight: selected
                            ? FontWeight.w800
                            : passed
                            ? FontWeight.w700
                            : FontWeight.w600,
                        color: selected
                            ? ProfilePalette.accent
                            : passed
                            ? AppColors.grey800
                            : AppColors.grey600,
                        height: 1.15,
                      ).copyWith(
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _NotchedRulerTrackShape extends SliderTrackShape {
  const _NotchedRulerTrackShape({
    required this.stopCount,
    required this.selectedIndex,
    required this.horizontalInset,
  });

  final int stopCount;
  final int selectedIndex;
  final double horizontalInset;

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    final trackHeight = sliderTheme.trackHeight ?? 6;
    final inset = horizontalInset.clamp(
      12.0,
      math.max(12.0, parentBox.size.width / 2),
    );
    final trackLeft = offset.dx + inset;
    final trackTop = offset.dy + (parentBox.size.height - trackHeight) / 2;
    final trackWidth = math.max(0.0, parentBox.size.width - inset * 2);
    return Rect.fromLTWH(trackLeft, trackTop, trackWidth, trackHeight);
  }

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required Offset thumbCenter,
    Offset? secondaryOffset,
    bool isEnabled = false,
    bool isDiscrete = false,
    required TextDirection textDirection,
  }) {
    final trackRect = getPreferredRect(
      parentBox: parentBox,
      offset: offset,
      sliderTheme: sliderTheme,
      isEnabled: isEnabled,
      isDiscrete: isDiscrete,
    );
    if (trackRect.width <= 0) return;

    final canvas = context.canvas;
    final radius = Radius.circular(trackRect.height / 2);

    // Base inactive rail
    final inactivePaint = Paint()
      ..color = AppColors.grey200
      ..style = PaintingStyle.fill;
    canvas.drawRRect(RRect.fromRectAndRadius(trackRect, radius), inactivePaint);

    // Active emerald gradient rail
    final activeRight = thumbCenter.dx.clamp(trackRect.left, trackRect.right);
    if (activeRight > trackRect.left) {
      final activeRect = Rect.fromLTRB(
        trackRect.left,
        trackRect.top,
        activeRight,
        trackRect.bottom,
      );
      final activePaint = Paint()
        ..shader = const LinearGradient(
          colors: [
            ProfilePalette.routeJourneyStart,
            AppColors.primary,
          ],
        ).createShader(activeRect)
        ..style = PaintingStyle.fill;
      canvas.drawRRect(RRect.fromRectAndRadius(activeRect, radius), activePaint);
    }

    // Ruler notches & nodes at each division
    if (stopCount <= 1) return;
    final step = trackRect.width / (stopCount - 1);
    final cy = trackRect.center.dy;
    final tickTop = trackRect.bottom + 3.5;
    final tickBottom = tickTop + 4.5;

    final passedTickPaint = Paint()
      ..color = AppColors.primary200
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final futureTickPaint = Paint()
      ..color = AppColors.grey300
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final passedDotPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final futureNodeFill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final futureNodeBorder = Paint()
      ..color = AppColors.grey300
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    for (var i = 0; i < stopCount; i++) {
      final x = trackRect.left + step * i;
      canvas.drawLine(
        Offset(x, tickTop),
        Offset(x, tickBottom),
        i <= selectedIndex ? passedTickPaint : futureTickPaint,
      );
      if (i == selectedIndex) continue;
      if (i < selectedIndex) {
        canvas.drawCircle(Offset(x, cy), 2.2, passedDotPaint);
      } else {
        canvas.drawCircle(Offset(x, cy), 3.6, futureNodeFill);
        canvas.drawCircle(Offset(x, cy), 3.6, futureNodeBorder);
      }
    }
  }
}

class _NotchedRulerThumbShape extends SliderComponentShape {
  const _NotchedRulerThumbShape();

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) => const Size(24, 24);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    // Soft emerald aura
    canvas.drawCircle(
      center,
      13 + activationAnimation.value * 2,
      Paint()..color = AppColors.primary.withValues(alpha: 0.16),
    );
    // Crisp white outer disc with subtle elevation shadow
    canvas.drawShadow(
      Path()..addOval(Rect.fromCircle(center: center, radius: 10)),
      AppColors.grey900.withValues(alpha: 0.28),
      3,
      false,
    );
    canvas.drawCircle(center, 10, Paint()..color = Colors.white);
    canvas.drawCircle(
      center,
      10,
      Paint()
        ..color = ProfilePalette.routeJourneyStart
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2,
    );
    // Emerald core dot
    canvas.drawCircle(
      center,
      4.5,
      Paint()..color = AppColors.primary,
    );
  }
}

class _PurposeOptionCard extends StatelessWidget {
  const _PurposeOptionCard({
    super.key,
    required this.glyph,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final ConceptGlyph glyph;
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Material(
      color: selected ? AppColors.primary25 : AppColors.grey5,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardSm,
        side: BorderSide(
          color: selected ? AppColors.primary : ProfilePalette.line,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.cardSm,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 54),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary50 : AppColors.grey50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: ConceptSvgIcon(
                    glyph,
                    size: 18,
                    color: selected ? ProfilePalette.accent : AppColors.grey700,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    softWrap: true,
                    style: designText(
                      15,
                      weight: selected ? FontWeight.w700 : FontWeight.w600,
                      color: selected ? ProfilePalette.accent : ProfilePalette.ink,
                      height: 1.25,
                    ),
                  ),
                ),
                if (selected) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 8.5,
                    height: 8.5,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _SkillKindCard extends StatelessWidget {
  const _SkillKindCard({
    super.key,
    required this.kind,
    required this.glyph,
    required this.label,
    required this.rank,
    required this.onTap,
  });
  final String kind;
  final ConceptGlyph glyph;
  final String label;
  final int? rank;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final selected = rank != null;
    final isPrimary = rank == 1;
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: isPrimary
            ? AppColors.primary25
            : selected
            ? const Color(0xFFF8FCFA)
            : AppColors.grey5,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardSm,
          side: BorderSide(
            color: isPrimary
                ? AppColors.primary
                : selected
                ? AppColors.primary200
                : ProfilePalette.line,
            width: isPrimary ? 1.6 : (selected ? 1.3 : 1),
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.cardSm,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 54),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary50 : AppColors.grey50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: ConceptSvgIcon(
                      glyph,
                      size: 18,
                      color: selected ? ProfilePalette.accent : AppColors.grey700,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      softWrap: true,
                      style: designText(
                        15,
                        weight: selected ? FontWeight.w700 : FontWeight.w600,
                        color: selected
                            ? ProfilePalette.accent
                            : ProfilePalette.ink,
                        height: 1.25,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: isPrimary
                          ? AppColors.primary
                          : selected
                          ? AppColors.primary50
                          : Colors.transparent,
                      shape: BoxShape.circle,
                      border: isPrimary
                          ? null
                          : Border.all(
                              color: selected
                                  ? AppColors.primary
                                  : AppColors.grey300,
                              width: 1.5,
                            ),
                    ),
                    alignment: Alignment.center,
                    child: selected
                        ? Text(
                            '$rank',
                            style: designText(
                              13,
                              weight: FontWeight.w800,
                              color: isPrimary
                                  ? Colors.white
                                  : ProfilePalette.accent,
                              height: 1.1,
                            ).copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
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
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: ProfilePalette.permissionBorder),
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
