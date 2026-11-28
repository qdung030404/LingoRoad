part of 'profile_page.dart';

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
    required this.placementSkills,
    required this.readingSnap,
    required this.targetCefr,
    required this.isNarrow,
    required this.onViewPlacement,
    required this.onStartPlacement,
  });

  final bool hasPlacement;
  final String? placementCefr;
  final Json? placementSkills;
  final Json? readingSnap;
  final String targetCefr;
  final bool isNarrow;
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
        key: const Key('cefrOverviewCard'),
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
              const SizedBox(height: 12),
              SizedBox(
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
              const SizedBox(height: 18),
            ] else ...[
              const SizedBox(height: 4),
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
              ),
              const SizedBox(height: 10),
            ],
            _SkillsSection(
              hasPlacement: hasPlacement,
              placementCefr: placementCefr,
              placementSkills: placementSkills,
              readingSnap: readingSnap,
              targetCefr: targetCefr,
              isNarrow: isNarrow,
              onRetakePlacement: onStartPlacement,
            ),
          ],
        ),
      ),
    ],
  );
}

