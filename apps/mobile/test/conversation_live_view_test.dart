import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/speaking/conversation_live_view.dart';
import 'package:mobile/features/speaking/recording_waveform.dart';

void main() {
  testWidgets('call actions separate connecting, recording and ending', (
    tester,
  ) async {
    bool connected = false;
    bool recording = false;
    var starts = 0;
    var ends = 0;
    final levels = const Stream<double>.empty();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: StatefulBuilder(
            builder: (context, setState) => ConversationCallActions(
              connected: connected,
              recording: recording,
              engaged: connected,
              actionLabel: connected ? 'Kết thúc' : 'Bắt đầu hội thoại',
              amplitudes: levels,
              draft: recording ? 'I wake up at six.' : '',
              onToggleMic: () => setState(() => recording = !recording),
              onAction: () => setState(() {
                if (connected) {
                  ends++;
                  connected = false;
                  recording = false;
                } else {
                  starts++;
                  connected = true;
                }
              }),
            ),
          ),
        ),
      ),
    );
    expect(find.byTooltip('Bắt đầu ghi âm'), findsNothing);
    await tester.tap(find.text('Bắt đầu hội thoại'));
    await tester.pumpAndSettle();
    expect(starts, 1);
    expect(find.byType(RecordingWaveform), findsNothing);
    await tester.tap(find.byTooltip('Bắt đầu ghi âm'));
    await tester.pumpAndSettle();
    expect(find.text('I wake up at six.'), findsOneWidget);
    expect(find.byType(RecordingWaveform), findsOneWidget);
    await tester.tap(find.byTooltip('Dừng ghi âm'));
    await tester.pumpAndSettle();
    expect(find.byType(RecordingWaveform), findsNothing);
    expect(ends, 0);
    await tester.tap(find.text('Kết thúc'));
    await tester.pumpAndSettle();
    expect(ends, 1);
    expect(find.byTooltip('Bắt đầu ghi âm'), findsNothing);
  });
}
