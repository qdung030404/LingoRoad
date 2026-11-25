import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/grammar/grammar_catalogue_view.dart';
import 'package:mobile/features/grammar/grammar_controller.dart';
import 'package:mobile/features/grammar/grammar_repository.dart';

class FakeGrammarRepository implements GrammarRepository {
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
}
