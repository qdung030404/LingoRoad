part of 'learning_preview.dart';

extension _LearningPreviewBuild on _LearningPreviewState {
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
                  selectedTab.value = index;
                  _loadTab(index);
                },
                itemCount: 5,
                itemBuilder: (context, index) => RetainedTab(
                  key: ValueKey(index),
                  child: AnimatedBuilder(
                    animation: Listenable.merge([
                      if (index == 0) notifications,
                      if (index == 0 || index == 4 || widget.account == null)
                        model,
                      if (index == 0 || index == 2 || widget.account == null)
                        library,
                      widget.account,
                      if (index != 2) learning,
                      if (index == 0 || index == 4) daily,
                      if (index != 3) vocabularyController,
                      if (index == 0 || index == 1 || index == 4)
                        showPreviousLevels,
                    ]),
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
    if (page == 0) {
      return RepaintBoundary(
        child: HomeDashboard(
          model: model,
          library: library,
          onProfile: openProfile,
          displayName: widget.account?.user?['name'] as String? ?? 'Anna',
          avatarUrl: widget.account?.user?['avatarUrl'] as String?,
          level: widget.account == null ? 'A1' : widget.account!.placementCefr,
          learning: learning,
          vocabularyWordsCount:
              (vocabularyController?.summary?['totals']
                      as Map?)?['rememberedWords']
                  as int?,
          vocabularySection: vocabularyController == null
              ? null
              : VocabularyHomeSection(
                  controller: vocabularyController!,
                  onWords: () => switchTab(2),
                  onDeck: openWordDeck,
                  onReview: openReview,
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
              List<WritingPracticeItem> items = WritingPracticeItem.defaultItems;
              try {
                final fetched = await (writing ?? WritingEvaluationService())
                    .fetchWritingItems();
                if (fetched.isNotEmpty) {
                  items = fetched;
                }
              } catch (_) {}
              final index = items.indexWhere((e) => e.id == itemId);
              final matched = index >= 0 ? items[index] : items.firstOrNull;
              if (matched != null && mounted) {
                await previewPush<void>(
                  context,
                  WritingTaskPage(
                    model: model,
                    item: matched,
                    itemIndex: index >= 0 ? index : 0,
                    evaluationService: writing,
                  ),
                );
                if (mounted && (learning?.active ?? false)) {
                  await learning!.refresh();
                }
                return;
              }
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
          displayName: widget.account?.user?['name'] as String? ?? 'Anna',
          avatarUrl: widget.account?.user?['avatarUrl'] as String?,
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
    return RepaintBoundary(
      child: FigmaPage(
        titleStyle: designHeading(18),
        child: ListView(
          key: PageStorageKey('preview-content-$oldPage'),
          primary: false,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 108),
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
            if (oldPage == 1) ...road(),
            if (oldPage == 2) ...practice(),
          ],
        ),
      ),
    );
  }

  List<Widget> road() {
    if (learning != null) {
      final String? placementCefr = widget.account?.placementCefr;
      final bool hasVocabLessons = learning!.lessons.any(
        (l) => l.kind == 'VOCABULARY',
      );
      return [
        learningSegments(['Ngữ pháp', 'Từ vựng'], vocabulary ? 1 : 0, (i) => _updateState(() => vocabulary = i == 1)),
        const SizedBox(height: 24),
        if (!vocabulary)
          grammarController != null
              ? GrammarRoadSection(
                  grammarController: grammarController!,
                  learningController: learning,
                  placementCefr: placementCefr,
                  showPreviousLevels: showPreviousLevels.value,
                  onTogglePreviousLevels: () => showPreviousLevels.value = !showPreviousLevels.value,
                )
              : LearningCatalogue(controller: learning!, kinds: const ['GRAMMAR'])
        else ...[
          if (hasVocabLessons) ...[
            LearningCatalogue(
              controller: learning!,
              kinds: const ['VOCABULARY'],
              placementCefr: placementCefr,
              showPreviousLevels: showPreviousLevels.value,
              onTogglePreviousLevels: () =>
                  showPreviousLevels.value = !showPreviousLevels.value,
            ),
            const SizedBox(height: 12),
          ],
          CuratedTopicsCatalogue(controller: vocabularyController, onOpenDeck: openWordDeck),
        ],
      ];
    }
    return buildSampleRoadSections(
      context: context,
      vocabulary: vocabulary,
      model: model,
      vocabularyController: vocabularyController,
      onSelectVocabulary: (value) => _updateState(() => vocabulary = value),
      onOpenDeck: openWordDeck,
    );
  }

  Widget practiceCatalogue(String kind) => LearningCatalogue(
    controller: learning!,
    kinds: [kind],
    onOpenHistory: () => previewPush<void>(
      context,
      LearningHistoryPage(controller: learning!, kind: kind),
    ),
  );

  List<Widget> practice() => [
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
    if (speaking == null && skill == PracticeSkill.speaking) ...[
      if (widget.onSignIn != null)
        TextButton(
          key: const Key('speakingSignIn'),
          onPressed: widget.onSignIn,
          child: const Text('Đăng nhập để chấm giọng thật'),
        ),
    ],
    if (speaking != null && skill == PracticeSkill.speaking)
      SpeakingTopicCatalogue(
        controller: speaking!,
        practicePage: () =>
            SpeakingPreviewPage(model: model, speaking: speaking),
      )
    else if (learning != null &&
        (skill == PracticeSkill.reading || skill == PracticeSkill.listening))
      practiceCatalogue(
        skill == PracticeSkill.reading ? 'READING' : 'LISTENING',
      )
    else if (skill == PracticeSkill.writing)
      WritingPracticeSection(model: model, evaluationService: writing)
    else
      ...buildSamplePracticeSections(
        context: context,
        skill: skill,
        model: model,
      ),
  ];
  }
