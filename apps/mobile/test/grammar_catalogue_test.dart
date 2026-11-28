import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/grammar/grammar_catalogue_view.dart';
import 'package:mobile/features/grammar/grammar_controller.dart';
import 'package:mobile/features/grammar/grammar_repository.dart';
import 'test_helpers.dart';

class FakeGrammarRepository implements GrammarRepository {
  int catalogueCalls = 0;

  @override
  Future<GrammarCatalogueData> fetchCatalogue() async {
    catalogueCalls++;
    final List<Object> results = await Future.wait<Object>(<Future<Object>>[
      fetchLevels(),
      fetchTree(),
    ]);
    return (
      levels: results[0] as List<GrammarLevelSummary>,
      tree: results[1] as List<GrammarTreeNode>,
    );
  }

  @override
  Future<List<GrammarLevelSummary>> fetchLevels() async => const <GrammarLevelSummary>[
    GrammarLevelSummary(cefrLevel: 'A1', topicCount: 1, lessonCount: 1, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'A2', topicCount: 0, lessonCount: 0, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'B1', topicCount: 1, lessonCount: 0, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'B2', topicCount: 0, lessonCount: 0, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'C1', topicCount: 1, lessonCount: 0, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'C2', topicCount: 0, lessonCount: 0, completedCount: 0),
  ];

  @override
  Future<List<GrammarTreeNode>> fetchTree() async => const <GrammarTreeNode>[
    GrammarTreeNode(
      id: 'root-id',
      code: 'grammar',
      parentCode: null,
      cefrLevel: 'A1',
      isLeaf: false,
      titleEn: 'English Grammar',
      titleVi: 'Hệ thống Ngữ pháp',
      summaryVi: '',
      orderIndex: 0,
      prerequisiteCodes: <String>[],
      lessonCount: 1,
      learnerStatus: null,
      children: <GrammarTreeNode>[
        GrammarTreeNode(
          id: 'group-tenses',
          code: 'grammar.tenses',
          parentCode: 'grammar',
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Verb Tenses',
          titleVi: 'Hệ thống 12 Thì',
          summaryVi: 'Trọn bộ 12 thì động từ',
          orderIndex: 10,
          prerequisiteCodes: <String>[],
          lessonCount: 1,
          learnerStatus: null,
          children: <GrammarTreeNode>[
            GrammarTreeNode(
              id: 'leaf-ps',
              code: 'grammar.tenses.present_simple',
              parentCode: 'grammar.tenses',
              cefrLevel: 'A1',
              isLeaf: true,
              titleEn: 'Present Simple',
              titleVi: 'Thì Hiện tại đơn',
              summaryVi: 'Thói quen và sự thật hiển nhiên',
              orderIndex: 101,
              prerequisiteCodes: <String>[],
              lessonCount: 1,
              learnerStatus: 'AVAILABLE',
              children: <GrammarTreeNode>[],
            ),
            GrammarTreeNode(
              id: 'leaf-pp',
              code: 'grammar.tenses.present_perfect',
              parentCode: 'grammar.tenses',
              cefrLevel: 'B1',
              isLeaf: true,
              titleEn: 'Present Perfect',
              titleVi: 'Thì Hiện tại hoàn thành',
              summaryVi: 'Trải nghiệm và kết quả lưu lại hiện tại',
              orderIndex: 102,
              prerequisiteCodes: <String>['grammar.tenses.present_simple'],
              lessonCount: 0,
              learnerStatus: 'LOCKED',
              children: <GrammarTreeNode>[],
            ),
          ],
        ),
        GrammarTreeNode(
          id: 'group-discourse',
          code: 'grammar.discourse_emphasis',
          parentCode: 'grammar',
          cefrLevel: 'C1',
          isLeaf: false,
          titleEn: 'Academic Syntax',
          titleVi: 'Cú pháp Học thuật & Đảo ngữ',
          summaryVi: 'Đảo ngữ và câu chẻ',
          orderIndex: 90,
          prerequisiteCodes: <String>[],
          lessonCount: 0,
          learnerStatus: null,
          children: <GrammarTreeNode>[
            GrammarTreeNode(
              id: 'leaf-inv',
              code: 'grammar.inversion',
              parentCode: 'grammar.discourse_emphasis',
              cefrLevel: 'C1',
              isLeaf: true,
              titleEn: 'Negative Inversion',
              titleVi: 'Đảo ngữ phủ định',
              summaryVi: 'Nhấn mạnh học thuật với trạng từ phủ định đầu câu',
              orderIndex: 901,
              prerequisiteCodes: <String>[],
              lessonCount: 0,
              learnerStatus: 'AVAILABLE',
              children: <GrammarTreeNode>[],
            ),
          ],
        ),
      ],
    ),
  ];

  @override
  Future<GrammarTopicDetail> fetchTopicDetail(String code) async {
    return GrammarTopicDetail(
      id: 'leaf-ps',
      code: code,
      cefrLevel: 'A1',
      titleEn: 'Present Simple',
      titleVi: 'Thì Hiện tại đơn',
      summaryVi: 'Diễn tả thói quen và sự thật hiển nhiên.',
      parent: const GrammarRelatedTopic(
        id: 'group-tenses',
        code: 'grammar.tenses',
        cefrLevel: 'A1',
        titleEn: 'Verb Tenses',
        titleVi: 'Hệ thống 12 Thì',
      ),
      formulas: const <GrammarFormula>[
        GrammarFormula(
          form: 'AFFIRMATIVE',
          labelVi: 'Khẳng định',
          structure: 'S + V(s/es)',
          noteVi: 'Thêm -s/-es với ngôi thứ 3 số ít.',
        ),
      ],
      usageNotes: const <GrammarUsageNote>[
        GrammarUsageNote(
          useCaseVi: 'Thói quen lặp lại hằng ngày.',
          signalWords: <String>['always', 'usually'],
          commonMistakeVi: 'Quên chia -s với chủ ngữ số ít.',
        ),
      ],
      examples: const <GrammarExample>[
        GrammarExample(
          sentenceEn: 'Minh usually catches the 7 a.m. bus.',
          translationVi: 'Minh thường bắt chuyến xe buýt lúc 7 giờ sáng.',
        ),
      ],
      prerequisites: const <GrammarRelatedTopic>[],
      dependents: const <GrammarRelatedTopic>[
        GrammarRelatedTopic(
          id: 'leaf-pp',
          code: 'grammar.tenses.present_perfect',
          cefrLevel: 'B1',
          titleEn: 'Present Perfect',
          titleVi: 'Thì Hiện tại hoàn thành',
        ),
      ],
      lessons: const <GrammarLinkedLesson>[],
      learnerStatus: 'AVAILABLE',
    );
  }
}

void main() {
  testWidgets(
    'renders CEFR grammar tree, filters by level/search, and opens topic detail page',
    (WidgetTester tester) async {
      final GrammarController controller = GrammarController(
        repository: FakeGrammarRepository(),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: GrammarCatalogueView(controller: controller),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Header & first expanded group
      expect(find.text('Cấu trúc ngữ pháp CEFR'), findsOneWidget);
      expect(find.text('Hệ thống 12 Thì'), findsOneWidget);
      expect(find.text('Thì Hiện tại đơn'), findsOneWidget);
      expect(find.text('Thì Hiện tại hoàn thành'), findsOneWidget);

      // Filter by C1 -> auto-expands matching C1 group and hides A1/B1 group
      await tester.tap(find.byKey(const ValueKey<String>('grammar-filter-C1')));
      await tester.pumpAndSettle();

      expect(find.text('Thì Hiện tại đơn'), findsNothing);
      expect(find.text('Đảo ngữ phủ định'), findsOneWidget);

      // Reset to ALL and search
      await tester.tap(find.byKey(const ValueKey<String>('grammar-filter-ALL')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const ValueKey<String>('grammar-search-input')),
        'Hiện tại đơn',
      );
      await tester.pumpAndSettle();

      expect(find.text('Thì Hiện tại đơn'), findsOneWidget);
      expect(find.text('Thì Hiện tại hoàn thành'), findsNothing);

      // Tap topic to open detail screen
      await tester.tap(
        find.byKey(
          const ValueKey<String>('grammar-topic-grammar.tenses.present_simple'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chi tiết ngữ pháp'), findsOneWidget);
      expect(find.text('S + V(s/es)'), findsOneWidget);

      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();

      expect(find.text('Quên chia -s với chủ ngữ số ít.'), findsOneWidget);
      expect(find.text('Minh usually catches the 7 a.m. bus.'), findsOneWidget);
    },
  );

  testWidgets(
    'shows prerequisite unlock dialog for locked topics with Cancel and Learn actions',
    (WidgetTester tester) async {
      final GrammarController controller = GrammarController(
        repository: FakeGrammarRepository(),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: GrammarCatalogueView(controller: controller),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap locked topic "Thì Hiện tại hoàn thành" (requires "Thì Hiện tại đơn")
      await tester.tap(
        find.byKey(
          const ValueKey<String>(
            'grammar-topic-grammar.tenses.present_perfect',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Bạn cần học cấu trúc: Thì Hiện tại đơn để mở khóa cấu trúc này',
        ),
        findsOneWidget,
      );
      expect(find.text('Hủy'), findsOneWidget);
      expect(find.text('Học'), findsOneWidget);

      // Tap "Hủy" -> closes dialog and stays on catalogue
      await tester.tap(
        find.byKey(const ValueKey<String>('grammar-locked-cancel')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cấu trúc ngữ pháp CEFR'), findsOneWidget);
      expect(find.text('Chi tiết ngữ pháp'), findsNothing);

      // Tap locked topic again, then tap "Học" -> opens prerequisite detail page
      await tester.tap(
        find.byKey(
          const ValueKey<String>(
            'grammar-topic-grammar.tenses.present_perfect',
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const ValueKey<String>('grammar-locked-learn')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chi tiết ngữ pháp'), findsOneWidget);
      expect(find.text('Thì Hiện tại đơn'), findsOneWidget);
      expect(find.text('S + V(s/es)'), findsOneWidget);
    },
  );

  test(
    'ApiGrammarRepository.fetchCatalogue loads levels and tree in a single HTTP request',
    () async {
      final List<String> paths = <String>[];
      final _RecordingGrammarApi api = _RecordingGrammarApi((String path) async {
        paths.add(path);
        return <String, Object?>{
          'groupBy': 'hierarchy',
          'levels': <Map<String, Object?>>[
            <String, Object?>{
              'cefrLevel': 'A1',
              'topicCount': 2,
              'lessonCount': 3,
              'completedCount': 1,
            },
          ],
          'tree': <Map<String, Object?>>[
            <String, Object?>{
              'id': 'root-id',
              'code': 'grammar',
              'parentCode': null,
              'cefrLevel': 'A1',
              'isLeaf': false,
              'titleEn': 'Grammar',
              'titleVi': 'Ngữ pháp',
              'summaryVi': '',
              'orderIndex': 0,
              'prerequisiteCodes': <String>[],
              'lessonCount': 3,
              'children': <Map<String, Object?>>[
                <String, Object?>{
                  'id': 'group-1',
                  'code': 'grammar.tenses',
                  'parentCode': 'grammar',
                  'cefrLevel': 'A1',
                  'isLeaf': false,
                  'titleEn': 'Tenses',
                  'titleVi': 'Hệ thống Thì',
                  'summaryVi': '',
                  'orderIndex': 1,
                  'prerequisiteCodes': <String>[],
                  'lessonCount': 3,
                  'children': <Map<String, Object?>>[
                    <String, Object?>{
                      'id': 'leaf-1',
                      'code': 'grammar.tenses.present_simple',
                      'parentCode': 'grammar.tenses',
                      'cefrLevel': 'A1',
                      'isLeaf': true,
                      'titleEn': 'Present Simple',
                      'titleVi': 'Thì Hiện tại đơn',
                      'summaryVi': 'Thói quen',
                      'orderIndex': 2,
                      'prerequisiteCodes': <String>[],
                      'lessonCount': 3,
                      'learnerStatus': 'COMPLETED',
                      'children': <Map<String, Object?>>[],
                    },
                  ],
                },
              ],
            },
          ],
        };
      });

      final GrammarController controller = GrammarController(
        repository: ApiGrammarRepository(api, authenticated: true),
      );
      await controller.load();

      expect(paths, <String>['/grammar/tree?groupBy=hierarchy&includeLevels=true']);
      expect(controller.countForLevel('A1'), 2);
      expect(controller.completedCountForLevel('A1'), 1);
      expect(controller.visibleGroups, hasLength(1));
      controller.dispose();
    },
  );

  test(
    'load(force: true) overrides in-flight load (RC-2), supports TTL cache and stale-while-error',
    () async {
      final Completer<List<GrammarTreeNode>> slowTree =
          Completer<List<GrammarTreeNode>>();
      int treeCall = 0;
      bool shouldFail = false;

      final _ConfigurableGrammarRepository repo =
          _ConfigurableGrammarRepository(
            onFetchLevels: () async {
              if (shouldFail) throw Exception('network fail');
              return const <GrammarLevelSummary>[
                GrammarLevelSummary(
                  cefrLevel: 'B1',
                  topicCount: 1,
                  lessonCount: 1,
                  completedCount: 0,
                ),
              ];
            },
            onFetchTree: () async {
              treeCall++;
              if (shouldFail) throw Exception('network fail');
              if (treeCall == 1) {
                return slowTree.future;
              }
              return const <GrammarTreeNode>[
                GrammarTreeNode(
                  id: 'g-fresh',
                  code: 'grammar.fresh',
                  parentCode: null,
                  cefrLevel: 'B1',
                  isLeaf: false,
                  titleEn: 'Fresh Group',
                  titleVi: 'Nhóm Mới',
                  summaryVi: '',
                  orderIndex: 1,
                  prerequisiteCodes: <String>[],
                  lessonCount: 1,
                  learnerStatus: null,
                  children: <GrammarTreeNode>[
                    GrammarTreeNode(
                      id: 'leaf-fresh',
                      code: 'grammar.fresh.topic',
                      parentCode: 'grammar.fresh',
                      cefrLevel: 'B1',
                      isLeaf: true,
                      titleEn: 'Fresh Topic',
                      titleVi: 'Chủ điểm Mới',
                      summaryVi: '',
                      orderIndex: 2,
                      prerequisiteCodes: <String>[],
                      lessonCount: 1,
                      learnerStatus: 'AVAILABLE',
                      children: <GrammarTreeNode>[],
                    ),
                  ],
                ),
              ];
            },
          );

      final GrammarController controller = GrammarController(repository: repo);

      // Start initial load (in-flight).
      final Future<void> firstLoad = controller.load();
      // Coalesces when force: false.
      expect(identical(controller.load(), firstLoad), isTrue);

      // Override with force: true.
      final Future<void> forcedLoad = controller.load(force: true);
      await forcedLoad;

      expect(controller.findTopicByCode('grammar.fresh.topic'), isNotNull);
      expect(controller.loading, isFalse);

      // Complete the stale first load later — must NOT overwrite fresh state.
      slowTree.complete(const <GrammarTreeNode>[
        GrammarTreeNode(
          id: 'g-stale',
          code: 'grammar.stale',
          parentCode: null,
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Stale Group',
          titleVi: 'Nhóm Cũ',
          summaryVi: '',
          orderIndex: 1,
          prerequisiteCodes: <String>[],
          lessonCount: 1,
          learnerStatus: null,
          children: <GrammarTreeNode>[
            GrammarTreeNode(
              id: 'leaf-stale',
              code: 'grammar.stale.topic',
              parentCode: 'grammar.stale',
              cefrLevel: 'A1',
              isLeaf: true,
              titleEn: 'Stale Topic',
              titleVi: 'Chủ điểm Cũ',
              summaryVi: '',
              orderIndex: 2,
              prerequisiteCodes: <String>[],
              lessonCount: 1,
              learnerStatus: 'AVAILABLE',
              children: <GrammarTreeNode>[],
            ),
          ],
        ),
      ]);
      await firstLoad;

      expect(controller.findTopicByCode('grammar.fresh.topic'), isNotNull);
      expect(controller.findTopicByCode('grammar.stale.topic'), isNull);

      // Within cacheTtl, load() does not re-fetch.
      final int callsBeforeCached = treeCall;
      await controller.load();
      expect(treeCall, callsBeforeCached);

      // Stale-while-error: forced refresh error keeps existing groups & levels.
      shouldFail = true;
      await controller.load(force: true);
      expect(controller.error, isNotNull);
      expect(controller.totalLeafCount, 1);
      expect(controller.levels, isNotEmpty);
      expect(controller.findTopicByCode('grammar.fresh.topic'), isNotNull);
    },
  );

  test(
    'ApiGrammarRepository.fetchCatalogue falls back to /grammar/levels + /grammar/tree when older backend rejects includeLevels with 400',
    () async {
      final List<String> paths = <String>[];
      final _RecordingGrammarApi api = _RecordingGrammarApi((String path) async {
        paths.add(path);
        if (path.contains('includeLevels=true')) {
          throw const ApiFailure(
            'property includeLevels should not exist',
            status: 400,
          );
        }
        if (path == '/grammar/levels') {
          return <String, Object?>{
            'levels': <Map<String, Object?>>[
              <String, Object?>{
                'cefrLevel': 'A1',
                'topicCount': 1,
                'lessonCount': 2,
                'completedCount': 1,
              },
            ],
          };
        }
        if (path == '/grammar/tree?groupBy=hierarchy') {
          return <String, Object?>{
            'groupBy': 'hierarchy',
            'tree': <Map<String, Object?>>[
              <String, Object?>{
                'id': 'root-id',
                'code': 'grammar',
                'parentCode': null,
                'cefrLevel': 'A1',
                'isLeaf': false,
                'titleEn': 'Grammar',
                'titleVi': 'Ngữ pháp',
                'summaryVi': '',
                'orderIndex': 0,
                'prerequisiteCodes': <String>[],
                'lessonCount': 2,
                'children': <Map<String, Object?>>[
                  <String, Object?>{
                    'id': 'group-1',
                    'code': 'grammar.tenses',
                    'parentCode': 'grammar',
                    'cefrLevel': 'A1',
                    'isLeaf': false,
                    'titleEn': 'Tenses',
                    'titleVi': 'Hệ thống Thì',
                    'summaryVi': '',
                    'orderIndex': 1,
                    'prerequisiteCodes': <String>[],
                    'lessonCount': 2,
                    'children': <Map<String, Object?>>[
                      <String, Object?>{
                        'id': 'leaf-1',
                        'code': 'grammar.tenses.present_simple',
                        'parentCode': 'grammar.tenses',
                        'cefrLevel': 'A1',
                        'isLeaf': true,
                        'titleEn': 'Present Simple',
                        'titleVi': 'Thì Hiện tại đơn',
                        'summaryVi': 'Thói quen',
                        'orderIndex': 2,
                        'prerequisiteCodes': <String>[],
                        'lessonCount': 2,
                        'learnerStatus': 'COMPLETED',
                        'children': <Map<String, Object?>>[],
                      },
                    ],
                  },
                ],
              },
            ],
          };
        }
        throw ApiFailure('Unexpected path: $path', status: 500);
      });

      final GrammarController controller = GrammarController(
        repository: ApiGrammarRepository(api, authenticated: true),
      );
      await controller.load();

      expect(
        paths,
        containsAll(<String>[
          '/grammar/tree?groupBy=hierarchy&includeLevels=true',
          '/grammar/levels',
          '/grammar/tree?groupBy=hierarchy',
        ]),
      );
      expect(controller.error, isNull);
      expect(controller.countForLevel('A1'), 1);
      expect(controller.completedCountForLevel('A1'), 1);
      expect(controller.visibleGroups, hasLength(1));
      controller.dispose();
    },
  );

  test(
    'topicsForLevel ignores filters and uncompletedPrerequisites exempts < placementCefr',
    () async {
      final GrammarController controller = GrammarController(
        repository: FakeGrammarRepository(),
      );
      await controller.load();

      controller.setMinimumVisibleCefr('B1');
      controller.setSelectedCefr('C1');
      controller.setSearchQuery('Đảo ngữ');

      // visibleLeafCount excludes A1, ignores C1 filter & search.
      expect(controller.totalLeafCount, 3);
      expect(controller.visibleLeafCount, 2);

      // topicsForLevel('A1') ignores minimumVisibleCefr, selectedCefr, searchQuery.
      final List<GrammarTreeNode> a1Topics = controller.topicsForLevel('A1');
      expect(a1Topics.length, 1);
      expect(a1Topics.single.code, 'grammar.tenses.present_simple');

      final GrammarTreeNode b1Topic = controller.findTopicByCode(
        'grammar.tenses.present_perfect',
      )!;
      // Without minimumBlockingCefr, A1 prereq blocks B1 topic.
      expect(controller.uncompletedPrerequisites(b1Topic).length, 1);
      // With minimumBlockingCefr: 'B1', A1 prereq is exempted.
      expect(
        controller.uncompletedPrerequisites(
          b1Topic,
          minimumBlockingCefr: 'B1',
        ),
        isEmpty,
      );
    },
  );

  testWidgets(
    'hides < placementCefr topics & chips by default and toggles via grammarTogglePreviousLevels',
    (WidgetTester tester) async {
      final GrammarController controller = GrammarController(
        repository: FakeGrammarRepository(),
      );
      bool showPreviousLevels = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: StatefulBuilder(
            builder: (BuildContext context, StateSetter setState) {
              return Scaffold(
                body: SingleChildScrollView(
                  child: GrammarRoadSection(
                    grammarController: controller,
                    placementCefr: 'B1',
                    showPreviousLevels: showPreviousLevels,
                    onTogglePreviousLevels: () {
                      setState(() => showPreviousLevels = !showPreviousLevels);
                    },
                  ),
                ),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Header & subtitle reflect hidden < B1 levels.
      expect(find.text('2 cấu trúc'), findsOneWidget);
      expect(
        find.text('Tra cứu công thức, cách dùng và lộ trình từ B1 đến C2'),
        findsOneWidget,
      );

      // A1/A2 filter chips & A1 topic are hidden.
      expect(
        find.byKey(const ValueKey<String>('grammar-filter-A1')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey<String>('grammar-filter-A2')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey<String>('grammar-filter-B1')),
        findsOneWidget,
      );
      expect(find.text('Thì Hiện tại đơn'), findsNothing);
      expect(find.text('Thì Hiện tại hoàn thành'), findsOneWidget);

      // Toggle button shows "Xem các bậc trước đó".
      expect(
        find.byKey(const Key('grammarTogglePreviousLevels')),
        findsOneWidget,
      );
      expect(find.text('Xem các bậc trước đó'), findsOneWidget);

      // Tap toggle -> shows A1/A2 chips & A1 topic, updates header & button text.
      await tester.tap(find.byKey(const Key('grammarTogglePreviousLevels')));
      await tester.pumpAndSettle();

      expect(find.text('3 cấu trúc'), findsOneWidget);
      expect(
        find.text('Tra cứu công thức, cách dùng và lộ trình từ A1 đến C2'),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('grammar-filter-A1')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('grammar-filter-A2')),
        findsOneWidget,
      );
      expect(find.text('Thì Hiện tại đơn'), findsOneWidget);
      expect(find.text('Ẩn các bậc trước đó'), findsOneWidget);

      // Tapping B1 LOCKED topic whose only prereq is A1 opens detail directly (exempted).
      final Finder lockedB1Topic = find.byKey(
        const ValueKey<String>(
          'grammar-topic-grammar.tenses.present_perfect',
        ),
      );
      await tester.ensureVisible(lockedB1Topic);
      await tester.pumpAndSettle();
      await tester.tap(lockedB1Topic);
      await tester.pumpAndSettle();
      expect(find.text('Chi tiết ngữ pháp'), findsOneWidget);
    },
  );
}

class _RecordingGrammarApi extends FakeApi {
  _RecordingGrammarApi(this._onGet) : super(signedIn: true);

  final Future<Json> Function(String path) _onGet;

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) => _onGet(path);
}

class _ConfigurableGrammarRepository extends FakeGrammarRepository {
  _ConfigurableGrammarRepository({
    required this.onFetchLevels,
    required this.onFetchTree,
  });

  final Future<List<GrammarLevelSummary>> Function() onFetchLevels;
  final Future<List<GrammarTreeNode>> Function() onFetchTree;

  @override
  Future<List<GrammarLevelSummary>> fetchLevels() => onFetchLevels();

  @override
  Future<List<GrammarTreeNode>> fetchTree() => onFetchTree();
}
