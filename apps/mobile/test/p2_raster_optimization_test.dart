import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/learning/home_dashboard.dart';
import 'package:mobile/features/learning/learning_widgets.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/preview_navigation_bar.dart';
import 'package:mobile/features/learning/progress_dashboard.dart';
import 'package:mobile/features/learning/word_library.dart';
import 'package:mobile/features/profile/cefr_road_chart.dart';
import 'package:mobile/features/speaking/recording_waveform.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/speaking_pages.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';
import 'package:mobile/features/vocabulary/vocabulary_word_card.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'package:mobile/shared/history_controls.dart';
import 'package:shared_preferences/shared_preferences.dart';

void _mockAudioPlayers() {
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  for (final name in <String>[
    'xyz.luan/audioplayers.global',
    'xyz.luan/audioplayers.global/events',
  ]) {
    messenger.setMockMethodCallHandler(MethodChannel(name), (_) async => null);
  }
  messenger.setMockMethodCallHandler(
    const MethodChannel('xyz.luan/audioplayers'),
    (MethodCall call) async {
      if (call.method == 'create') {
        final id = (call.arguments as Map)['playerId'];
        messenger.setMockMethodCallHandler(
          MethodChannel('xyz.luan/audioplayers/events/$id'),
          (_) async => null,
        );
      }
      return null;
    },
  );
}

Uint8List _testWav(int frames) {
  final bytes = Uint8List(44 + frames * 2);
  final data = ByteData.sublistView(bytes);
  bytes.setRange(0, 4, 'RIFF'.codeUnits);
  data.setUint32(4, bytes.length - 8, Endian.little);
  bytes.setRange(8, 16, 'WAVEfmt '.codeUnits);
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little);
  data.setUint16(22, 1, Endian.little);
  data.setUint32(24, 16000, Endian.little);
  data.setUint32(28, 32000, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  bytes.setRange(36, 40, 'data'.codeUnits);
  data.setUint32(40, frames * 2, Endian.little);
  return bytes;
}

class _FakeAudioPlayer extends Fake implements AudioPlayer {
  int playCalls = 0;
  int stopCalls = 0;
  int disposeCalls = 0;

  @override
  Stream<void> get onPlayerComplete => const Stream<void>.empty();

  @override
  Future<void> play(
    Source source, {
    double? volume,
    double? balance,
    AudioContext? ctx,
    Duration? position,
    PlayerMode? mode,
  }) async {
    playCalls++;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
  }

  @override
  Future<void> dispose() async {
    disposeCalls++;
  }
}

class _FakeSpeakingRepo extends SpeakingRepository {
  @override
  Future<Json> prompts() async => {
    'items': [
      {'id': 'p1', 'text': 'Hello world'},
    ],
  };

  @override
  Future<Json> create(String promptId, String requestId) async => {
    'id': 'sub-1',
    'status': 'CREATED',
  };

  @override
  Future<Json> submission(String id) async => {'id': id, 'status': 'CREATED'};

  @override
  Future<Json> upload(String id, String path) async => {
    'id': id,
    'status': 'SUCCEEDED',
  };

  @override
  Future<Json> history({String? cursor}) async => {'items': [], 'nextCursor': null};
}

class _FakeSpeakingRecorder implements SpeakingRecorder {
  _FakeSpeakingRecorder(this.path);
  final String path;

  @override
  Stream<double> get amplitudes => const Stream<double>.empty();

  @override
  Future<bool> hasPermission() async => true;

  @override
  Future<void> start() async {}

  @override
  Future<String?> stop() async => path;

  @override
  Future<void> clear() async {}

  @override
  Future<void> dispose() async {}
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _mockAudioPlayers();
  });

  testWidgets(
    'LearningGradientBackdrop isolates paint with RepaintBoundary and DashboardCard defaults to Clip.none',
    (tester) async {
      final scroll = ScrollController();
      addTearDown(scroll.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Stack(
              children: [
                LearningGradientBackdrop(scroll: scroll),
                const DashboardCard(child: Text('Hello')),
                const DashboardCard(
                  clipBehavior: Clip.antiAlias,
                  child: Text('Clipped'),
                ),
              ],
            ),
          ),
        ),
      );

      expect(
        find.descendant(
          of: find.byType(LearningGradientBackdrop),
          matching: find.byType(RepaintBoundary),
        ),
        findsWidgets,
      );

      final containers = tester
          .widgetList<Container>(
            find.descendant(
              of: find.byType(DashboardCard),
              matching: find.byType(Container),
            ),
          )
          .toList();
      expect(containers[0].clipBehavior, Clip.none);
      expect(containers[1].clipBehavior, Clip.antiAlias);
    },
  );

  testWidgets(
    'HomeDashboard only switches AnnotatedRegion overlay style when crossing scroll threshold',
    (tester) async {
      final model = PreviewModel();
      final library = WordLibrary();
      addTearDown(model.dispose);
      addTearDown(library.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HomeDashboard(
              model: model,
              library: library,
              onProfile: () {},
              onLesson: () {},
              onGrammar: () {},
              onWords: () {},
              onReview: () {},
              onDeck: (_) {},
            ),
          ),
        ),
      );

      AnnotatedRegion<SystemUiOverlayStyle> region() => tester.widget(
        find
            .descendant(
              of: find.byType(HomeDashboard),
              matching: find.byType(AnnotatedRegion<SystemUiOverlayStyle>),
            )
            .first,
      );

      final scrollable = find
          .descendant(
            of: find.byType(HomeDashboard),
            matching: find.byType(Scrollable),
          )
          .first;

      expect(
        region().value.statusBarIconBrightness,
        SystemUiOverlayStyle.light.statusBarIconBrightness,
      );

      // Sub-threshold scroll keeps light status style (no rebuild storm).
      await tester.drag(scrollable, const Offset(0, -100));
      await tester.pump();
      expect(
        region().value.statusBarIconBrightness,
        SystemUiOverlayStyle.light.statusBarIconBrightness,
      );

      // Crossing >180 switches to dark status style once.
      await tester.drag(scrollable, const Offset(0, -160));
      await tester.pump();
      expect(
        region().value.statusBarIconBrightness,
        SystemUiOverlayStyle.dark.statusBarIconBrightness,
      );
    },
  );

  testWidgets(
    'PreviewNavigationBar and PreviewCheck pass colorFilter directly to FigmaAsset without ColorFiltered layers',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                PreviewNavigationBar(selectedIndex: 1, onSelected: (_) {}),
                const PreviewCheck(checked: true, size: 24),
              ],
            ),
          ),
        ),
      );

      expect(
        find.descendant(
          of: find.byType(PreviewNavigationBar),
          matching: find.byType(ColorFiltered),
        ),
        findsNothing,
      );
      expect(
        find.descendant(
          of: find.byType(PreviewCheck),
          matching: find.byType(ColorFiltered),
        ),
        findsNothing,
      );

      final navSvg = tester.widget<SvgPicture>(
        find
            .descendant(
              of: find.byType(PreviewNavigationBar),
              matching: find.byType(SvgPicture),
            )
            .at(1),
      );
      expect(
        navSvg.colorFilter,
        const ColorFilter.mode(AppColors.primary500, BlendMode.srcIn),
      );
    },
  );

  testWidgets(
    'FigmaAsset and bounded Image widgets compute cacheWidth automatically for raster assets',
    (tester) async {
      final model = PreviewModel();
      final library = WordLibrary();
      addTearDown(model.dispose);
      addTearDown(library.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(400, 800),
              devicePixelRatio: 2.0,
            ),
            child: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    const FigmaAsset(
                      'welcome/imgIPhone15Pro',
                      width: 140,
                      height: 276,
                    ),
                    const VocabularyWordCard(
                      english: 'focus',
                      meaning: 'tập trung',
                      imageUrl: 'https://example.com/focus.jpg',
                    ),
                    SizedBox(
                      height: 300,
                      child: ProgressDashboard(
                        model: model,
                        avatarUrl: 'https://example.com/avatar.jpg',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      final figmaImg = tester.widget<Image>(
        find.descendant(
          of: find.byWidgetPredicate(
            (w) => w is FigmaAsset && w.asset == 'welcome/imgIPhone15Pro',
          ),
          matching: find.byType(Image),
        ),
      );
      expect((figmaImg.image as ResizeImage).width, 280);

      final vocabImg = tester.widget<Image>(
        find.descendant(
          of: find.byType(VocabularyWordCard),
          matching: find.byType(Image),
        ),
      );
      expect((vocabImg.image as ResizeImage).width, greaterThan(0));
      expect((vocabImg.image as ResizeImage).width, lessThanOrEqualTo(800));

      final avatarImg = tester.widget<Image>(
        find.descendant(
          of: find.byType(ProgressDashboard),
          matching: find.byType(Image),
        ),
      );
      expect((avatarImg.image as ResizeImage).width, 88);
    },
  );

  testWidgets(
    'ConceptSvgIcon and HistoryIcon reuse cached SvgStringLoader instances across builds',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                ConceptSvgIcon(ConceptGlyph.book, color: AppColors.primary500),
                ConceptSvgIcon(ConceptGlyph.book, color: AppColors.grey900),
                HistoryIcon(HistoryIcon.trash, color: AppColors.error200),
                HistoryIcon(HistoryIcon.trash, color: AppColors.grey900),
              ],
            ),
          ),
        ),
      );

      final conceptSvgs = tester
          .widgetList<SvgPicture>(
            find.descendant(
              of: find.byType(ConceptSvgIcon),
              matching: find.byType(SvgPicture),
            ),
          )
          .toList();
      expect(
        identical(conceptSvgs[0].bytesLoader, conceptSvgs[1].bytesLoader),
        isTrue,
      );

      final historySvgs = tester
          .widgetList<SvgPicture>(
            find.descendant(
              of: find.byType(HistoryIcon),
              matching: find.byType(SvgPicture),
            ),
          )
          .toList();
      expect(
        identical(historySvgs[0].bytesLoader, historySvgs[1].bytesLoader),
        isTrue,
      );
    },
  );

  test(
    'limitSpeakingWavFile trims WAV cleanly off-thread and leaves no temp file',
    () async {
      final tempDir = await Directory.systemTemp.createTemp('p2-wav-isolate-');
      addTearDown(() => tempDir.delete(recursive: true));
      final wavFile = File('${tempDir.path}/sample.wav');
      await wavFile.writeAsBytes(_testWav(16000 * 32));

      await limitSpeakingWavFile(wavFile.path, maxSeconds: 30);

      final trimmed = await wavFile.readAsBytes();
      expect(trimmed.length, 44 + 16000 * 30 * 2);
      expect(await File('${wavFile.path}.tmp').exists(), isFalse);
    },
  );

  testWidgets(
    'SpeakingRecordPage lazy-initializes AudioPlayer only when playback starts',
    (tester) async {
      final tempDir = Directory.systemTemp.createTempSync('p2-speaking-lazy-');
      final controller = SpeakingController(
        repository: _FakeSpeakingRepo(),
        recorder: _FakeSpeakingRecorder('${tempDir.path}/rec.wav'),
        accountId: 'p2-user',
        isCurrent: () => true,
      );
      addTearDown(() {
        controller.dispose();
        if (tempDir.existsSync()) {
          tempDir.deleteSync(recursive: true);
        }
      });
      final wavPath = '${tempDir.path}/rec.wav';
      File(wavPath).writeAsBytesSync(_testWav(1600));

      await tester.runAsync(() async {
        await controller.initialize();
        await controller.select(controller.prompts.first);
        await controller.start();
        await controller.stop();
      });

      var playerCreations = 0;
      late _FakeAudioPlayer fakePlayer;
      await tester.pumpWidget(
        MaterialApp(
          home: SpeakingRecordPage(
            controller: controller,
            playerFactory: () {
              playerCreations++;
              return fakePlayer = _FakeAudioPlayer();
            },
          ),
        ),
      );
      await tester.pump();

      expect(playerCreations, 0);

      await tester.tap(find.text('Nghe bản thu của bạn'));
      await tester.pump();

      expect(playerCreations, 1);
      expect(fakePlayer.playCalls, 1);

      await tester.pumpWidget(const SizedBox.shrink());
      expect(fakePlayer.disposeCalls, 1);
    },
  );

  testWidgets(
    'RecordingWaveform renders RepaintBoundary + CustomPaint with zero AnimatedContainers',
    (tester) async {
      final amplitudes = StreamController<double>(sync: true);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox.shrink());
        await amplitudes.close();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: RecordingWaveform(amplitudes: amplitudes.stream)),
        ),
      );

      expect(
        find.descendant(
          of: find.byType(RecordingWaveform),
          matching: find.byType(RepaintBoundary),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(RecordingWaveform),
          matching: find.byType(CustomPaint),
        ),
        findsOneWidget,
      );
      expect(find.byType(AnimatedContainer), findsNothing);
    },
  );
}
