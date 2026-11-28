part of 'learning_goals_edit_page.dart';

extension _LearningGoalsEditSections on _LearningGoalsEditDialogState {
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
      onChanged: (lvl) => _updateState(() {
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
      onChanged: (minutes) => _updateState(() {
        _draftMinutes = minutes;
        _saveError = null;
      }),
    );
  }

  Widget _buildPreferredKindsGrid(BoxConstraints constraints) {
    const kinds = allPreferredLearningKinds;
    final twoCols = constraints.maxWidth >= 290;

    void toggleKind(String kind) {
      _updateState(() {
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

  Widget _buildDialogContent(BuildContext context) {
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
                                          : () => _updateState(() {
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
