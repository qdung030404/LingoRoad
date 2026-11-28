part of 'profile_page.dart';

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
    return Column(
      key: const Key('profileSkillsCard'),
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
    final iconColor = assessed
        ? ProfilePalette.skillRowAdaptiveColor
        : ProfilePalette.skillRowInactiveIconColor;
    final iconBg = assessed
        ? ProfilePalette.skillRowAdaptiveBg
        : ProfilePalette.skillRowInactiveIconBg;

    return ConstrainedBox(
      key: ValueKey('skillTile-${skill.kind}'),
      constraints: const BoxConstraints(minHeight: 49),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            key: ValueKey('skillIconBox-${skill.kind}'),
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

