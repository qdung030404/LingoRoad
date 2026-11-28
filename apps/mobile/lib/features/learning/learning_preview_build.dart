part of 'learning_preview.dart';

extension _LearningPreviewBuild on _LearningPreviewState {
  Listenable _tabListenable(int index) => switch (index) {
    0 => Listenable.merge([
      notifications,
      if (widget.account == null) model,
      if (vocabularyController == null) library,
      widget.account,
      learning,
      daily,
      _rememberedWordsCount,
    ]),
    1 => Listenable.merge([
      if (widget.account == null) model,
      widget.account,
      learning,
      showPreviousLevels,
    ]),
    2 => Listenable.merge([
      if (vocabularyController == null) library,
    ]),
    3 => Listenable.merge([
      if (widget.account == null) model,
      learning,
    ]),
    _ => Listenable.merge([
      if (widget.account == null) model,
      widget.account,
      learning,
      daily,
      _rememberedWordsCount,
      showPreviousLevels,
    ]),
  };

  Widget _buildPreviewScaffold(BuildContext context) {
    final surface = ValueListenableBuilder<int>(
      valueListenable: selectedTab,
      child: InAppNotificationBannerHost(
        controller: notifications,
        onTapBanner: (banner) =>
            _openNotificationTarget(banner.targetType, banner.targetPayload),
        child: Scaffold(
          backgroundColor: AppColors.grey25,
          body: Stack(
            children: [
              PageView.builder(
                key: const Key('learningPages'),
                controller: tabs,
                physics: const ClampingScrollPhysics(),
                onPageChanged: (index) {
                  final target = _jumpingToTab;
                  if (target != null && index != target) return;
                  selectedTab.value = index;
                  _loadTab(index);
                },
                itemCount: 5,
                itemBuilder: (context, index) => RetainedTab(
                  key: ValueKey(index),
                  child: AnimatedBuilder(
                    animation: _tabListenable(index),
                    builder: (context, _) => tabContent(index),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: math.max(24, MediaQuery.paddingOf(context).bottom),
                child: ValueListenableBuilder<int>(
                  valueListenable: selectedTab,
                  builder: (context, tab, _) => Container(
                    padding: const EdgeInsets.only(top: 24, bottom: 8),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00FFFFFF), Colors.white],
                        stops: [0, .48],
                      ),
                    ),
                    child: PreviewNavigationBar(
                      selectedIndex: tab,
                      onSelected: switchTab,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      builder: (context, tab, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value:
            (tab == 0 || tab == 4
                    ? SystemUiOverlayStyle.light
                    : SystemUiOverlayStyle.dark)
                .copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: AppColors.grey25,
                  systemNavigationBarIconBrightness: Brightness.dark,
                ),
        child: child!,
      ),
    );
    return widget.account == null ? PreviewSurface(child: surface) : surface;
  }

  Widget tabContent(int page) {
    final accountName =
        ((widget.account?.user?['name'] ??
                widget.account?.cachedAccount?['name'])
            as String?) ??
        'Anna';
    final accountAvatarUrl =
        (widget.account?.user?['avatarUrl'] ??
                widget.account?.cachedAccount?['avatarUrl'])
            as String?;
    if (page == 0) {
      return RepaintBoundary(
        child: HomeDashboard(
          model: model,
          library: library,
          onProfile: openProfile,
          displayName: accountName,
          avatarUrl: accountAvatarUrl,
          level: widget.account == null ? 'A1' : widget.account!.placementCefr,
          learning: learning,
          vocabularyWordsCount: _rememberedWordsCount.value,
          vocabularySection: vocabularyController == null
              ? null
              : VocabularyHomeSection(
                  controller: vocabularyController!,
                  onWords: () => switchTab(2),
                  onDeck: openWordDeck,
                  onReview: () => switchTab(2),
                ),
          onLesson: () {
            final lesson = learning?.continueLesson;
            if (learning != null) {
              if (lesson != null) {
                if (lesson.kind == 'GRAMMAR' &&
                    lesson.state != 'COMPLETED' &&
                    learning!.grammar != null) {
                  openUncompletedGrammarCard(
                    context,
                    learning!,
                    lessonId: lesson.id,
                    lessonCode: lesson.code,
                    grammarTopicCode: lesson.grammarTopicCode,
                    title: lesson.title,
                  );
                } else {
                  openLearningLesson(context, learning!, lessonId: lesson.id);
                }
              } else {
                switchTab(1);
              }
            } else {
              previewPush(context, VocabularyLessonPage(model: model));
            }
          },
          onGrammar: () =>
              previewPush(context, GrammarLessonPage(model: model)),
          onWords: () => switchTab(2),
          onReview: openReview,
          onNotifications: openNotifications,
          unreadNotificationCount: notifications.unreadCount,
          onDeck: openWordDeck,
          onOpenSpeakingTopic: (topicId) async {
            if (speaking != null && topicId.isNotEmpty) {
              await openSpeakingTopicFromPlan(
                context,
                controller: speaking!,
                topicId: topicId,
                practicePage: () => SpeakingPreviewPage(
                  model: model,
                  speaking: speaking,
                ),
              );
              if (mounted && (learning?.active ?? false)) {
                await learning!.refresh();
              }
            } else {
              _updateState(() => skill = PracticeSkill.speaking);
              switchTab(3);
            }
          },
          onOpenWritingItem: (itemId) async {
            if (itemId.isNotEmpty) {
              final opened = await previewPush<bool>(
                context,
                _DeferredWritingTaskPage(
                  model: model,
                  itemId: itemId,
                  evaluationService: writing,
                  cachedItems: _cachedWritingItems,
                  onItemsLoaded: (items) => _cachedWritingItems = items,
                ),
              );
              if (opened == false && mounted) {
                _updateState(() => skill = PracticeSkill.writing);
                switchTab(3);
                return;
              }
              if (mounted && (learning?.active ?? false)) {
                await learning!.refresh();
              }
              return;
            }
            _updateState(() => skill = PracticeSkill.writing);
            switchTab(3);
          },
        ),
      );
    }
    if (page == 2) {
      return RepaintBoundary(
        child: vocabularyController != null
            ? VocabularyWordsTab(controller: vocabularyController!)
            : MyWordsTab(library: library, onNavigate: returnToTab),
      );
    }
    if (page == 4) {
      return RepaintBoundary(
        child: ProgressDashboard(
          model: model,
          displayName: accountName,
          avatarUrl: accountAvatarUrl,
          level: widget.account == null ? 'A1' : widget.account!.placementCefr,
          learning: learning,
          daily: daily,
          vocabularyController: vocabularyController,
          grammarController: grammarController,
          showPreviousLevels: showPreviousLevels.value,
          onTogglePreviousLevels: () =>
              showPreviousLevels.value = !showPreviousLevels.value,
          onProfile: openProfile,
          onLevelTap: widget.account != null
              ? openProfile
              : () => previewMessage(
                  context,
                  'A1 là mức minh họa của bản xem trước.',
                ),
          onOpenDailyPlan: learning != null && daily != null
              ? () => previewPush(context, DailyPlanPage(learning: learning!))
              : null,
          onOpenHistory: learning != null
              ? () => previewPush(context, LearningHistoryPage(controller: learning!))
              : null,
          onOpenWeeklyPlan: () => previewPush(context, WeeklyPlanPage(model: model)),
        ),
      );
    }
    final oldPage = page > 2 ? page - 1 : page;
    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                ['Hello, Anna!', 'Học', 'Luyện tập', 'Tiến độ'][oldPage],
                style: designHeading(36, height: 1),
              ),
            ),
            PreviewLevelBadge(
              label: widget.account == null
                  ? 'A1'
                  : widget.account!.placementCefr ?? '—',
              onTap: () => previewMessage(
                context,
                widget.account == null
                    ? 'A1 là mức minh họa của bản xem trước.'
                    : 'Mức tạm tính từ bài kiểm tra Đọc/Nghe; chưa đánh giá Nói/Viết.',
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        if (restoreError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(restoreError!),
          ),
      ],
    );
    return RepaintBoundary(
      child: FigmaPage(
        titleStyle: designHeading(18),
        child: CustomScrollView(
          key: PageStorageKey('preview-content-$oldPage'),
          primary: false,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 108),
              sliver: SliverMainAxisGroup(
                slivers: [
                  SliverToBoxAdapter(child: header),
                  if (oldPage == 1) ...roadSlivers(),
                  if (oldPage == 2) ...practiceSlivers(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> roadSlivers() {
    if (learning != null) {
      final String? placementCefr = widget.account?.placementCefr;
      final bool hasVocabLessons = learning!.lessons.any(
        (l) => l.kind == 'VOCABULARY',
      );
      return [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              learningSegments(
                ['Ngữ pháp', 'Từ vựng'],
                vocabulary ? 1 : 0,
                (i) => _updateState(() => vocabulary = i == 1),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
        if (!vocabulary)
          grammarController != null
              ? GrammarRoadSection(
                  grammarController: grammarController!,
                  learningController: learning,
                  placementCefr: placementCefr,
                  showPreviousLevels: showPreviousLevels.value,
                  onTogglePreviousLevels: () =>
                      showPreviousLevels.value = !showPreviousLevels.value,
                  asSliver: true,
                )
              : LearningCatalogue(
                  controller: learning!,
                  kinds: const ['GRAMMAR'],
                  asSliver: true,
                )
        else ...[
          if (hasVocabLessons) ...[
            LearningCatalogue(
              controller: learning!,
              kinds: const ['VOCABULARY'],
              placementCefr: placementCefr,
              showPreviousLevels: showPreviousLevels.value,
              onTogglePreviousLevels: () =>
                  showPreviousLevels.value = !showPreviousLevels.value,
              asSliver: true,
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
          ],
          SliverToBoxAdapter(
            child: CuratedTopicsCatalogue(
              controller: vocabularyController,
              onOpenDeck: openWordDeck,
            ),
          ),
        ],
      ];
    }
    final sampleWidgets = buildSampleRoadSections(
      context: context,
      vocabulary: vocabulary,
      model: model,
      vocabularyController: vocabularyController,
      onSelectVocabulary: (value) => _updateState(() => vocabulary = value),
      onOpenDeck: openWordDeck,
    );
    return [
      SliverList.builder(
        itemCount: sampleWidgets.length,
        itemBuilder: (context, index) => sampleWidgets[index],
      ),
    ];
  }

  Widget practiceCatalogue(String kind, {bool asSliver = false}) =>
      LearningCatalogue(
        controller: learning!,
        kinds: [kind],
        asSliver: asSliver,
        onOpenHistory: () => previewPush<void>(
          context,
          LearningHistoryPage(controller: learning!, kind: kind),
        ),
      );

  List<Widget> practiceSlivers() {
    final headerControl = SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          learningSegments(
            PracticeSkill.values.map((s) => s.label).toList(),
            skill.index,
            (i) => _updateState(() => skill = PracticeSkill.values[i]),
            icons: [
              'imgVuesaxLinearHeadphone',
              'imgVuesaxLinearBook',
              'imgVuesaxOutlineNoteText',
              'imgVuesaxLinearMicrophone2',
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
    if (speaking == null && skill == PracticeSkill.speaking) {
      final sampleWidgets = buildSamplePracticeSections(
        context: context,
        skill: skill,
        model: model,
      );
      return [
        headerControl,
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.onSignIn != null)
                TextButton(
                  key: const Key('speakingSignIn'),
                  onPressed: widget.onSignIn,
                  child: const Text('Đăng nhập để chấm giọng thật'),
                ),
              ...sampleWidgets,
            ],
          ),
        ),
      ];
    }
    if (speaking != null && skill == PracticeSkill.speaking) {
      return [
        headerControl,
        SliverToBoxAdapter(
          child: SpeakingTopicCatalogue(
            controller: speaking!,
            practicePage: () =>
                SpeakingPreviewPage(model: model, speaking: speaking),
          ),
        ),
      ];
    }
    if (learning != null &&
        (skill == PracticeSkill.reading || skill == PracticeSkill.listening)) {
      return [
        headerControl,
        practiceCatalogue(
          skill == PracticeSkill.reading ? 'READING' : 'LISTENING',
          asSliver: true,
        ),
      ];
    }
    if (skill == PracticeSkill.writing) {
      return [
        headerControl,
        SliverToBoxAdapter(
          child: WritingPracticeSection(
            model: model,
            evaluationService: writing,
          ),
        ),
      ];
    }
    final sampleWidgets = buildSamplePracticeSections(
      context: context,
      skill: skill,
      model: model,
    );
    return [
      headerControl,
      SliverList.builder(
        itemCount: sampleWidgets.length,
        itemBuilder: (context, index) => sampleWidgets[index],
      ),
    ];
  }
}


class _DeferredWritingTaskPage extends StatefulWidget {
  const _DeferredWritingTaskPage({
    required this.model,
    required this.itemId,
    required this.evaluationService,
    required this.cachedItems,
    required this.onItemsLoaded,
  });

  final PreviewModel model;
  final String itemId;
  final WritingEvaluationService? evaluationService;
  final List<WritingPracticeItem>? cachedItems;
  final ValueChanged<List<WritingPracticeItem>> onItemsLoaded;

  @override
  State<_DeferredWritingTaskPage> createState() =>
      _DeferredWritingTaskPageState();
}

class _DeferredWritingTaskPageState extends State<_DeferredWritingTaskPage> {
  WritingPracticeItem? _matched;
  int _matchedIndex = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    List<WritingPracticeItem> items =
        widget.cachedItems ?? WritingPracticeItem.defaultItems;
    final restoreFuture = widget.model.ensureRestored().catchError((Object _) {});
    if (widget.cachedItems == null) {
      try {
        final fetched = await (widget.evaluationService ??
                WritingEvaluationService())
            .fetchWritingItems();
        if (fetched.isNotEmpty) {
          items = fetched;
          widget.onItemsLoaded(fetched);
        }
      } catch (_) {}
    }
    await restoreFuture;
    if (!mounted) return;
    final index = items.indexWhere((e) => e.id == widget.itemId);
    final matched = index >= 0 ? items[index] : items.firstOrNull;
    if (matched == null) {
      Navigator.of(context).pop(false);
      return;
    }
    setState(() {
      _matched = matched;
      _matchedIndex = index >= 0 ? index : 0;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _matched == null) {
      return FigmaPage(
        titleStyle: designHeading(18),
        title: 'Luyện Viết',
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.primary500),
        ),
      );
    }
    return WritingTaskPage(
      model: widget.model,
      item: _matched!,
      itemIndex: _matchedIndex,
      evaluationService: widget.evaluationService,
    );
  }
}
