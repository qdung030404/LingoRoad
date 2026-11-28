part of 'conversation_preparation.dart';

class _SpeakingHeroTopBar extends StatelessWidget {
  const _SpeakingHeroTopBar({
    required this.title,
    required this.canPop,
    required this.onBack,
  });

  final String title;
  final bool canPop;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 52),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: canPop
                ? IconButton(
                    tooltip: MaterialLocalizations.of(
                      context,
                    ).backButtonTooltip,
                    padding: EdgeInsets.zero,
                    onPressed: onBack,
                    icon: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0x30FFFFFF),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0x45FFFFFF)),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.chevron_left_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  )
                : null,
          ),
          Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                title,
                maxLines: 1,
                textAlign: TextAlign.center,
                style: designText(
                  17.5,
                  weight: FontWeight.w700,
                  color: Colors.white,
                ).copyWith(letterSpacing: -0.3),
              ),
            ),
          ),
          const SizedBox(width: 48, height: 48),
        ],
      ),
    ),
  );
}

class _PreparationSection extends StatelessWidget {
  const _PreparationSection({
    required this.title,
    required this.icon,
    required this.children,
    this.collapsible = false,
  });
  final String title;
  final IconData icon;
  final List<Widget> children;
  final bool collapsible;

  @override
  Widget build(BuildContext context) => collapsible
      ? FigmaCard(
          padding: EdgeInsets.zero,
          child: Material(
            color: Colors.transparent,
            child: ExpansionTile(
              shape: const Border(),
              collapsedShape: const Border(),
              leading: Icon(icon, color: AppColors.primary700),
              title: learningHeading(title, size: 16),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final item in children)
                  Padding(padding: const EdgeInsets.only(top: 12), child: item),
              ],
            ),
          ),
        )
      : FigmaCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 20, color: AppColors.primary700),
                  const SizedBox(width: 10),
                  Expanded(child: learningHeading(title, size: 18)),
                ],
              ),
              for (var i = 0; i < children.length; i++) ...[
                const SizedBox(height: 16),
                if (i > 0) ...[
                  const Divider(height: 1, color: AppColors.grey100),
                  const SizedBox(height: 12),
                ],
                children[i],
              ],
            ],
          ),
        );
}

class _PreparationList extends StatefulWidget {
  const _PreparationList({
    required this.listKey,
    required this.caption,
    required this.itemCount,
    required this.itemBuilder,
  });

  final Key listKey;
  final String caption;
  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;

  @override
  State<_PreparationList> createState() => _PreparationListState();
}

class _PreparationListState extends State<_PreparationList> {
  final _scroll = ScrollController(keepScrollOffset: false);

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Align(
        alignment: Alignment.centerLeft,
        child: PracticeCountBadge(widget.caption),
      ),
      const SizedBox(height: 10),
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 288),
        child: Scrollbar(
          controller: _scroll,
          thumbVisibility: true,
          child: ListView.separated(
            key: widget.listKey,
            controller: _scroll,
            primary: false,
            shrinkWrap: true,
            physics: const ClampingScrollPhysics(),
            padding: const EdgeInsets.only(right: 12),
            itemCount: widget.itemCount,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: widget.itemBuilder,
          ),
        ),
      ),
    ],
  );
}

class _PreparationListCard extends StatelessWidget {
  const _PreparationListCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.grey0,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );
}

class _VocabularyCard extends StatelessWidget {
  const _VocabularyCard(this.item);

  final Json item;

  @override
  Widget build(BuildContext context) => PracticeVocabularyCard(
    word: (item['word'] ?? '').toString(),
    phonetic: (item['phonetic'] ?? '').toString(),
    meaning: (item['meaningVi'] ?? item['meaning'] ?? '').toString(),
    example: (item['example'] ?? '').toString(),
    imageUrl: item['imageUrl']?.toString(),
    compact: true,
  );
}

class _SentenceCard extends StatelessWidget {
  const _SentenceCard(this.item);

  final Json item;

  @override
  Widget build(BuildContext context) => _PreparationListCard(
    children: [
      Text(
        item['text'].toString(),
        style: designText(16, weight: FontWeight.w600, height: 1.45),
      ),
      const SizedBox(height: 6),
      Text(
        item['meaningVi'].toString(),
        style: designText(14, color: AppColors.grey800, height: 1.45),
      ),
    ],
  );
}

class _Phrase extends StatelessWidget {
  const _Phrase(this.item);
  final Json item;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        item['text'].toString(),
        style: designText(15, weight: FontWeight.w500),
      ),
      const SizedBox(height: 4),
      learningBody(item['meaningVi'].toString(), size: 14),
    ],
  );
}

