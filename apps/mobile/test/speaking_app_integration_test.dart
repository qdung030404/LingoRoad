import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/main.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/conversation_settings_dialog.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';
import 'package:mobile/shared/figma_dropdown.dart';
import 'test_helpers.dart';

class SpeakingAppApi extends FakeApi {
  SpeakingAppApi() : super(signedIn: true, completed: true);
  static const read = {'id': 'read-family', 'text': 'I live with my sister.'};
  static const family = {
    'id': 'family',
    'title': 'My family',
    'text': 'Talk about your family.',
    'hints': ['Who is in your family?'],
  };
  bool liveEnabled = false;
  int detailLoads = 0;
  int conversationCreates = 0;
  final historyRequests = <String>[];
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    if (method == 'POST' && path == '/speaking/conversations') {
      conversationCreates++;
      throw StateError('An unconfirmed call must not be created.');
    }
    if (path.startsWith('/speaking/history') ||
        path == '/speaking/conversations') {
      historyRequests.add(path);
      return {'items': []};
    }
    if (path == '/speaking/prompts') {
      return {
        'enabled': true,
        'items': [
          {'id': 'prompt-1', 'text': 'My name is Anna', 'contentVersion': 1},
        ],
      };
    }
    if (path == '/speaking/conversations/topics') {
      return {
        'items': [family],
        'enabled': liveEnabled,
      };
    }
    if (path == '/speaking/conversations/topics/family') {
      detailLoads++;
      return {
        ...family,
        'enabled': liveEnabled,
        'practice': {
          'readAloud': {
            'enabled': true,
            'items': [read],
          },
          'topic': {'enabled': true, 'prompt': family},
        },
      };
    }
    return super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'the app opens reading and solo practice for the selected topic',
    (tester) async {
      final api = SpeakingAppApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();
      expect(api.detailLoads, 0);
      expect(find.text('Chặng 1'), findsNothing);
      await tester.tap(find.text('My family'));
      await tester.pumpAndSettle();
      expect(api.detailLoads, 1);
      final call = tester.widget<InkWell>(
        find
            .ancestor(
              of: find.text('Trò chuyện cùng Lingo'),
              matching: find.byType(InkWell),
            )
            .first,
      );
      expect(call.onTap, isNull);
      await tester.tap(find.text('Nghe và đọc'));
      await tester.pumpAndSettle();
      expect(find.byType(SpeakingPreviewPage), findsOneWidget);
      expect(find.text('I live with my sister.'), findsOneWidget);
      expect(find.text('My name is Anna'), findsNothing);
      Navigator.of(tester.element(find.byType(SpeakingPreviewPage))).pop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tự nói'));
      await tester.pumpAndSettle();
      expect(find.text('Talk about your family.'), findsOneWidget);
      expect(find.textContaining('Who is in your family?'), findsOneWidget);
      expect(api.detailLoads, 1);
    },
  );

  testWidgets(
    'topic opens the ready screen and saving settings does not start a call',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = SpeakingAppApi()..liveEnabled = true;
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('My family'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Trò chuyện cùng Lingo'));
      await tester.pumpAndSettle();

      await tester.binding.setSurfaceSize(const Size(320, 640));
      await tester.pumpAndSettle();
      expect(find.text('Hội thoại AI'), findsOneWidget);
      expect(find.text('Cùng bắt đầu câu chuyện'), findsOneWidget);
      expect(find.text('Bắt đầu hội thoại'), findsOneWidget);
      expect(find.text('Cài đặt trò chuyện'), findsNothing);
      await tester.tap(find.byTooltip('Cài đặt trò chuyện'));
      await tester.pumpAndSettle();
      expect(find.text('Cài đặt trò chuyện'), findsOneWidget);
      expect(find.text('Giọng của Lingo'), findsOneWidget);
      expect(find.text('Tốc độ nói'), findsOneWidget);
      expect(find.text('Chờ bạn nói tiếp'), findsOneWidget);
      expect(api.conversationCreates, 0);

      await tester.tap(find.byTooltip('Đóng cài đặt'));
      await tester.pumpAndSettle();
      expect(find.byType(ConversationSettingsDialog), findsNothing);
      expect(find.text('Sẵn sàng'), findsOneWidget);
      expect(api.conversationCreates, 0);

      expect(find.byTooltip('Lịch sử hội thoại AI'), findsNothing);
      await tester.tap(find.byTooltip('Cài đặt trò chuyện'));
      await tester.pumpAndSettle();
      expect(find.byType(FigmaDropdown), findsNWidgets(3));
      await tester.tap(find.text('Lưu cài đặt'));
      await tester.pumpAndSettle();
      expect(find.byType(ConversationSettingsDialog), findsNothing);
      expect(api.conversationCreates, 0);
    },
  );

  testWidgets('live settings use shared dropdown and retry a rejected update', (
    tester,
  ) async {
    final applied = <ConversationSettings>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showDialog<ConversationSettings>(
                context: context,
                builder: (_) => ConversationSettingsDialog(
                  initial: const ConversationSettings(),
                  onApplyLive: (choice) async {
                    applied.add(choice);
                    if (applied.length == 1) throw const ApiFailure('Thử lại');
                  },
                ),
              ),
              child: const Text('Mở cài đặt'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Mở cài đặt'));
    await tester.pumpAndSettle();
    final dropdowns = tester
        .widgetList<FigmaDropdown>(find.byType(FigmaDropdown))
        .toList();
    expect(dropdowns[0].onChanged, isNull);
    expect(dropdowns[1].onChanged, isNotNull);
    await tester.tap(find.widgetWithText(FigmaDropdown, 'Tốc độ nói'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chậm'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FigmaDropdown, 'Chờ bạn nói tiếp'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lâu hơn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lưu cài đặt'));
    await tester.pumpAndSettle();
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.text('Lâu hơn'), findsOneWidget);
    await tester.tap(find.text('Lưu cài đặt'));
    await tester.pumpAndSettle();
    expect(applied.map((choice) => choice.turnPause), [
      ConversationTurnPause.long,
      ConversationTurnPause.long,
    ]);
    expect(applied.map((choice) => choice.speechRate), [
      ConversationSpeechRate.slow,
      ConversationSpeechRate.slow,
    ]);
    expect(find.byType(ConversationSettingsDialog), findsNothing);
  });

  testWidgets('each Speaking activity opens its own history', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final api = SpeakingAppApi();
    await tester.pumpWidget(MyApp(session: SessionController(api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('previewTab3')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nói').first);
    await tester.pumpAndSettle();
    expect(find.byTooltip('Lịch sử luyện nói'), findsNothing);

    Future<void> checkHistory(
      String tooltip,
      String heading,
      String path,
    ) async {
      final button = find.byTooltip(tooltip);
      await Scrollable.ensureVisible(tester.element(button), alignment: 0.35);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(find.text(heading), findsOneWidget);
      expect(find.text('Tất cả'), findsNothing);
      expect(api.historyRequests.last, path);
      Navigator.of(tester.element(find.text(heading))).pop();
      await tester.pumpAndSettle();
    }

    await checkHistory(
      'Lịch sử · Thử thách phát âm',
      'Lịch sử thử thách phát âm',
      '/speaking/history?mode=TONGUE_TWISTER',
    );
    await tester.ensureVisible(find.text('My family'));
    await tester.tap(find.text('My family'));
    await tester.pumpAndSettle();
    await checkHistory(
      'Lịch sử · Nghe và đọc',
      'Lịch sử nghe và đọc',
      '/speaking/history?mode=READ_ALOUD',
    );
    await checkHistory(
      'Lịch sử · Tự nói',
      'Lịch sử tự nói',
      '/speaking/history?mode=TOPIC',
    );
    await checkHistory(
      'Lịch sử hội thoại AI',
      'Lịch sử hội thoại',
      '/speaking/conversations',
    );
  });

  testWidgets(
    'guest Speaking offers sign-in and returns to normal auth sheet',
    (tester) async {
      final api = FakeApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('openLearningPreview')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();
      final signIn = find.byKey(const Key('speakingSignIn'));
      await tester.ensureVisible(signIn);
      await tester.tap(signIn);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('authSheet')), findsOneWidget);
      expect(find.byType(SpeakingCatalogue), findsNothing);
      expect(
        api.requestedPaths.where((p) => p.startsWith('/speaking/')),
        isEmpty,
      );
    },
  );

  testWidgets(
    'picture description mode opens from speaking extras, zooms picture and renders content rubric',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = _PictureSpeakingApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();

      final pictureRow = find.text('Miêu tả bức tranh');
      await tester.ensureVisible(pictureRow);
      expect(find.byTooltip('Lịch sử · Miêu tả bức tranh'), findsOneWidget);
      await tester.tap(pictureRow);
      await tester.pumpAndSettle();

      expect(find.text('At a busy campus café'), findsOneWidget);
      await tester.tap(find.text('Bắt đầu luyện'));
      await tester.pumpAndSettle();

      expect(find.text('Tranh 1/1'), findsOneWidget);
      expect(find.text('Describe this café scene.'), findsOneWidget);
      expect(find.textContaining('Tối đa 60 giây.'), findsOneWidget);
      final picturePreview = find.byKey(
        const ValueKey('speaking-picture-preview'),
      );
      expect(picturePreview, findsOneWidget);
      await tester.tap(picturePreview);
      await tester.pumpAndSettle();
      expect(find.byType(InteractiveViewer), findsOneWidget);
      await tester.tap(find.byTooltip('Đóng ảnh phóng to'));
      await tester.pumpAndSettle();

      await tester.pumpWidget(const SizedBox());
      await tester.pump();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: SpeakingAssessment(
                useSharedScoreLayout: false,
                result: const {
                  'mode': 'PICTURE_DESCRIPTION',
                  'accuracy': 82.0,
                  'fluency': 78.0,
                  'prosody': 80.0,
                  'overall': 80.0,
                  'words': [
                    {
                      'word': 'barista',
                      'accuracy': 85.0,
                      'errorType': 'None',
                    },
                  ],
                  'transcript': 'A smiling barista is making coffee.',
                  'content': {
                    'status': 'succeeded',
                    'rubricVersion': 'picture-content-v1',
                    'vocabulary': 80.0,
                    'grammar': 76.0,
                    'topic': 84.0,
                    'overall': 80.0,
                    'strengths': ['Miêu tả rõ quầy pha chế và khách hàng.'],
                    'improvements': [],
                  },
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final strengthsTile = find.byKey(
        const ValueKey('content-feedback-strengths'),
      );
      await tester.ensureVisible(strengthsTile);
      await tester.tap(strengthsTile);
      await tester.pumpAndSettle();
      expect(find.text('Miêu tả rõ quầy pha chế và khách hàng.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'speaking catalogue shows first 4 topics in 2x2 grid and expands all when tapping Hiện thêm',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = _ManyTopicsSpeakingApi();
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nói').first);
      await tester.pumpAndSettle();

      expect(find.text('Introduce yourself'), findsOneWidget);
      expect(find.text('My hobbies'), findsOneWidget);
      expect(find.text('My favourite food'), findsNothing);
      expect(find.text('Hiện thêm'), findsOneWidget);

      final toggle = find.byKey(const Key('toggleSpeakingTopicsButton'));
      await Scrollable.ensureVisible(tester.element(toggle));
      await tester.pumpAndSettle();
      await tester.tap(toggle);
      await tester.pumpAndSettle();

      expect(find.text('My favourite food'), findsOneWidget);
      expect(find.text('Technology in daily life'), findsOneWidget);

      await Scrollable.ensureVisible(tester.element(toggle));
      await tester.pumpAndSettle();
      expect(find.text('Thu gọn'), findsOneWidget);
      await tester.tap(toggle);
      await tester.pumpAndSettle();

      expect(find.text('My favourite food'), findsNothing);
      expect(find.text('Hiện thêm'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

class _ManyTopicsSpeakingApi extends SpeakingAppApi {
  static const _titles = [
    'Introduce yourself',
    'My day',
    'My family',
    'My hobbies',
    'My favourite food',
    'Where I live',
    'Travel and holidays',
    'Shopping and clothes',
    'Health and sports',
    'Study and future plans',
    'Weather and seasons',
    'Technology in daily life',
  ];

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    if (path == '/speaking/conversations/topics') {
      return {
        'enabled': true,
        'items': [
          for (var i = 0; i < _titles.length; i++)
            {
              'id': 'topic-${i + 1}',
              'title': _titles[i],
              'text': 'Talk about ${_titles[i]}.',
            },
        ],
      };
    }
    return super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
  }
}

class _PictureSpeakingApi extends SpeakingAppApi {
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    if (path.contains('mode=PICTURE_DESCRIPTION')) {
      return {
        'enabled': true,
        'items': [
          {
            'id': 'pic-1',
            'mode': 'PICTURE_DESCRIPTION',
            'title': 'At a busy campus café',
            'text': 'Describe this café scene.',
            'maxDurationSeconds': 60,
            'hints': ['Who is at the counter and what are they doing?'],
            'imageUrl': '/media/learning/v1/images/picture-campus-cafe.jpg',
            'contentVersion': 1,
          },
        ],
      };
    }
    return super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
  }
}
