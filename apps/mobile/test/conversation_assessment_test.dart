import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/conversation_assessment.dart';
import 'package:mobile/features/speaking/conversation_audio.dart';
import 'package:mobile/features/speaking/conversation_recording_store.dart';
import 'package:mobile/features/speaking/conversation_result_page.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/voice_conversations_page.dart';
import 'speaking_workflow_test.dart' show FakeSpeakingRepository, FakeRecorder;

class AssessmentRepository extends FakeSpeakingRepository {
  Json row = {'id': 'call', 'assessmentStatus': 'UNASSESSED'};
  int requests = 0;
  String? receivedPath;
  bool loseAck = false;
  bool failNextSummary = false;
  int summaryReads = 0;
  Uint8List? retriedWav;
  List<Json>? retriedSegments;
  final historyChoices = <bool>[];
  @override
  Future<Json> chooseConversationHistory(
    String id, {
    required bool save,
  }) async {
    historyChoices.add(save);
    return row = {...row, 'historyStatus': 'SAVED'};
  }

  @override
  Future<Json> conversation(String id) async => Map.of(row);

  @override
  Future<Json> conversationSummary(String id) async {
    summaryReads++;
    if (failNextSummary) {
      failNextSummary = false;
      throw const ApiFailure('Offline');
    }
    return conversation(id);
  }

  @override
  Future<Json> retryConversationPronunciation(
    String id,
    Uint8List wav,
    List<Json> segments,
  ) async {
    retriedWav = wav;
    retriedSegments = segments;
    return row = {...row, 'assessmentStatus': 'PROCESSING'};
  }

  @override
  Future<Json> conversations({String? cursor}) async => {
    'items': [if (row['historyStatus'] == 'SAVED') row],
  };
  @override
  Future<Json> assessConversation(String id, {String? audioPath}) async {
    requests++;
    receivedPath = audioPath;
    row = {
      ...row,
      'assessmentStatus': 'PROCESSING',
      'assessment': {'segmentHash': 'pending'},
    };
    if (loseAck) throw const ApiFailure('offline');
    return Map.of(row);
  }
}

class TestRecordingStore extends ConversationRecordingStore {
  final recordings = <(String, String), ConversationRecording>{};
  bool failWrite = false;

  @override
  Future<void> save(
    String accountId,
    String id,
    ConversationRecording capture,
  ) async {
    if (failWrite) throw StateError('Storage full');
    recordings[(accountId, id)] = capture;
  }

  @override
  Future<ConversationRecording?> read(String accountId, String id) async =>
      recordings[(accountId, id)];
}

class TestConversationAudio extends ConversationAudio {
  final wav = Uint8List(44 + 32000);

  @override
  Future<Uint8List?> readForReview() async => wav;
}

void main() {
  testWidgets(
    'pronunciation retry offers the saved recording on supported servers',
    (tester) async {
      final repository = AssessmentRepository();
      final controller = SpeakingController(
        repository: repository,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
      );
      final wav = Uint8List(128);
      final segments = <Json>[
        {'itemId': 'reply', 'offsetMs': 0, 'durationMs': 100},
      ];
      final row = <String, dynamic>{
        'id': 'call',
        'assessmentStatus': 'PARTIAL',
        'assessment': {
          'turns': [
            {'itemId': 'reply', 'answer': 'My answer'},
          ],
        },
      };
      Future<void> open(bool supported) async {
        repository.row = {
          ...row,
          if (supported) 'supportsPronunciationRetry': true,
        };
        await tester.pumpWidget(
          MaterialApp(
            key: ValueKey(supported),
            home: Scaffold(
              body: ConversationAssessment(
                controller: controller,
                conversation: repository.row,
                fullPage: true,
                reviewRecording: Future.value(
                  ConversationRecording(wav, segments),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      await open(false);
      expect(find.text('Chấm lại phát âm'), findsNothing);
      await open(true);
      await tester.ensureVisible(find.text('Chấm lại phát âm'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chấm lại phát âm'));
      await tester.pump();
      expect(repository.retriedWav, wav);
      expect(repository.retriedSegments, segments);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );
  testWidgets(
    'temporary network failure retries polling and displays saved results',
    (tester) async {
      final repository = AssessmentRepository()
        ..row = {'id': 'call', 'assessmentStatus': 'PROCESSING'}
        ..failNextSummary = true;
      final controller = SpeakingController(
        repository: repository,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ConversationAssessment(
              controller: controller,
              conversation: repository.row,
              fullPage: true,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();
      expect(repository.summaryReads, 1);
      expect(find.text('Kiểm tra kết quả'), findsOneWidget);
      repository.row = {
        'id': 'call',
        'assessmentStatus': 'PARTIAL',
        'assessment': {},
      };
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      expect(repository.summaryReads, 2);
      expect(find.text('Điểm của bạn'), findsOneWidget);
      expect(find.text('Kiểm tra kết quả'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );
  testWidgets(
    'uploads captured microphone, recovers lost ACK and shows saved content scores',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(393, 850));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final repository = AssessmentRepository()..loseAck = true;
      final controller = SpeakingController(
        repository: repository,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: ConversationAssessment(
              controller: controller,
              conversation: Map.of(repository.row),
              audioPath: '/temporary/user.wav',
              fullPage: true,
            ),
          ),
        ),
      );
      await tester.tap(find.text('Chấm điểm hội thoại'));
      await tester.pumpAndSettle();
      expect(repository.receivedPath, '/temporary/user.wav');
      await tester.tap(find.text('Chấm điểm hội thoại'));
      await tester.pump();
      expect(repository.requests, 1);
      expect(find.text('Đang chấm hội thoại'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Phát âm'), findsNothing);
      expect(find.text('Nội dung'), findsNothing);
      repository.row = {
        ...repository.row,
        'assessmentStatus': 'PARTIAL',
        'assessment': {
          'schemaVersion': 2,
          'turns': [
            {
              'question': 'Who is in your family?',
              'answer': 'I live with my sister.',
            },
          ],
          'content': {
            'status': 'succeeded',
            'overall': 72.5,
            'vocabulary': 70.5,
            'improvements': [
              {
                'quote': 'with my sister',
                'suggestion': 'My sister and I live together.',
              },
            ],
            'grammar': 72.5,
            'topic': 74.5,
          },
        },
      };
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.text('72.5'), findsOneWidget);
      expect(find.text('My sister and I live together.'), findsOneWidget);
      expect(find.text('Chưa có điểm phát âm cho phiên này.'), findsOneWidget);
      expect(
        find.text('Cần đủ điểm phát âm và nội dung để tính trung bình.'),
        findsOneWidget,
      );
      final heading = find.text('Chi tiết hội thoại');
      final overallScore = find.text('Điểm của bạn');
      final scoreDetails = find.text('Điểm chi tiết');
      final annotation = find.text('Phát âm cần luyện');
      final question = find.text('Who is in your family?');
      await tester.ensureVisible(heading);
      expect(
        tester.getBottomLeft(overallScore).dy,
        lessThan(tester.getTopLeft(scoreDetails).dy),
      );
      expect(
        tester.getBottomLeft(scoreDetails).dy,
        lessThan(tester.getTopLeft(heading).dy),
      );
      expect(
        tester.getTopLeft(heading).dy,
        lessThan(tester.getTopLeft(annotation).dy),
      );
      expect(
        tester.getTopLeft(annotation).dy,
        lessThan(tester.getTopLeft(question).dy),
      );
      expect(find.textContaining('Phản hồi nội dung dựa trên'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('result returns without saving and only saves on explicit tap', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(393, 850));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = AssessmentRepository()
      ..row = {
        'id': 'call',
        'historyStatus': 'PENDING',
        'assessmentStatus': 'PARTIAL',
        'assessment': {
          'schemaVersion': 2,
          'content': {'status': 'succeeded', 'overall': 72.5},
        },
      };
    final controller = SpeakingController(
      repository: repository,
      recorder: FakeRecorder('unused'),
      accountId: 'a',
      isCurrent: () => true,
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ConversationResultPage(
                    controller: controller,
                    conversation: repository.row,
                    audio: ConversationAudio(),
                  ),
                ),
              ),
              child: const Text('Mở kết quả'),
            ),
          ),
        ),
      ),
    );

    final open = find.text('Mở kết quả');
    final save = find.text('Lưu lịch sử trò chuyện');
    final back = find.byTooltip('Quay lại').last;
    await tester.tap(open);
    await tester.pumpAndSettle();
    expect(tester.getCenter(back).dx, lessThan(tester.getCenter(save).dx));
    await tester.tap(back);
    await tester.pumpAndSettle();
    expect(repository.historyChoices, isEmpty);

    await tester.tap(open);
    await tester.pumpAndSettle();
    expect(save.hitTestable(), findsOneWidget);
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(repository.historyChoices, [true]);
    expect(find.text('Đã lưu lịch sử trò chuyện'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets(
    'saves capture before marking history saved and restores word replay',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(393, 920));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final store = TestRecordingStore()..failWrite = true;
      final controller = SpeakingController(
        repository: AssessmentRepository()
          ..row = {
            'id': 'call',
            'status': 'ENDED',
            'hasUserTurns': true,
            'topicSnapshot': {'title': 'My day', 'text': 'Describe your day.'},
            'createdAt': '2026-11-11T05:34:00Z',
            'historyStatus': 'PENDING',
            'assessmentStatus': 'PARTIAL',
            'assessment': {
              'schemaVersion': 2,
              'turns': [
                {
                  'itemId': 'turn',
                  'answer': 'Hello',
                  'pronunciation': {
                    'mode': 'TOPIC',
                    'transcript': 'Hello',
                    'words': [
                      {
                        'word': 'Hello',
                        'offsetMs': 200,
                        'durationMs': 350,
                        'accuracy': 90,
                      },
                    ],
                  },
                },
              ],
            },
          },
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
        conversationRecordings: store,
      );
      final repository = controller.repository as AssessmentRepository;
      final captured = TestConversationAudio()
        ..segments = [
          {'itemId': 'turn', 'offsetMs': 0, 'durationMs': 1000},
        ];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: ConversationResultPage(
            controller: controller,
            conversation: repository.row,
            audio: captured,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final save = find.text('Lưu lịch sử trò chuyện');
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(repository.historyChoices, isEmpty);
      expect(find.textContaining('Chưa lưu được bản thu'), findsOneWidget);

      store.failWrite = false;
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(repository.historyChoices, [true]);
      final saved = store.recordings[('a', 'call')]!;
      expect(saved.wav, captured.wav);
      expect(saved.segments, captured.segments);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: VoiceConversationsPage(
            controller: controller,
            historyOnly: true,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('speaking-history-call')));
      await tester.pumpAndSettle();
      expect(find.text('My day'), findsOneWidget);
      expect(find.text('Đã kết thúc'), findsOneWidget);
      expect(find.text('11/11/2026, 12:34'), findsOneWidget);
      final word = find.byKey(const ValueKey('speaking-reference-0'));
      await tester.scrollUntilVisible(word.hitTestable(), 250);
      expect(
        find.widgetWithText(OutlinedButton, 'Giọng của bạn'),
        findsOneWidget,
      );
      await tester.tap(word);
      await tester.pumpAndSettle();
      expect(find.byTooltip('Đóng chi tiết'), findsOneWidget);
      final replay = tester.widget<OutlinedButton>(
        find.descendant(
          of: find.byType(BottomSheet),
          matching: find.widgetWithText(OutlinedButton, 'Giọng của bạn'),
        ),
      );
      expect(replay.onPressed, isNotNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
}
