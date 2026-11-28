part of 'profile_page.dart';

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

