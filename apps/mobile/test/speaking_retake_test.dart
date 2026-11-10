import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'speaking_workflow_test.dart' show FakeRecorder, FakeSpeakingRepository;

class RetakeRepository extends FakeSpeakingRepository {
  Completer<Json>? lookup;
  @override
  Future<Json> prompts() async => {
    'enabled': true,
    'items': [
      {'id': 'first', 'text': 'First sentence'},
      {'id': 'last', 'text': 'Last sentence'},
    ],
  };
  @override
  Future<Json> submission(String id) async =>
      lookup == null ? super.submission(id) : lookup!.future;
}

void main() {
  late RetakeRepository repository;
  late SpeakingController controller;
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'speaking.retake.pending': jsonEncode({
        'clientRequestId': 'old-command',
        'submissionId': 'old-submission',
        'promptId': 'last',
      }),
    });
    repository = RetakeRepository()
      ..value = {
        'id': 'old-submission',
        'status': 'SUCCEEDED',
        'promptSnapshot': {'text': 'Last sentence'},
        'result': {'pronunciation': 99},
      };
    controller = SpeakingController(
      repository: repository,
      recorder: FakeRecorder('unused'),
      accountId: 'retake',
      isCurrent: () => true,
    );
  });
  tearDown(() => controller.dispose());

  Future<void> expectFresh() async {
    expect(controller.prompt!['id'], 'first');
    expect(controller.submission, isNull);
    expect(controller.audioPath, isNull);
    expect(
      (await SharedPreferences.getInstance()).getString(
        'speaking.retake.pending',
      ),
      isNull,
    );
    expect(repository.creates, 0);
    expect(repository.uploads, 0);
    expect((await repository.history())['items'][0]['status'], 'SUCCEEDED');
  }

  test(
    're-entering after a saved completed result starts at the first sentence',
    () async {
      await controller.beginPractice();
      await expectFresh();
    },
  );

  test(
    'Finish clears completed local state while keeping server history',
    () async {
      await controller.initialize();
      expect(controller.prompt!['id'], 'last');
      await controller.finishPractice();
      await expectFresh();
      await controller.beginPractice();
      await expectFresh();
    },
  );

  test(
    'entering practice preserves a processing submission without retry',
    () async {
      repository.value['status'] = 'PROCESSING';
      await controller.beginPractice();
      expect(controller.prompt!['id'], 'last');
      expect(controller.status, 'PROCESSING');
      expect(repository.uploads, 0);
      expect(
        (await SharedPreferences.getInstance()).getString(
          'speaking.retake.pending',
        ),
        isNotNull,
      );
    },
  );

  test(
    'late status response cannot restore old feedback over a new retake',
    () async {
      await controller.initialize();
      repository.lookup = Completer<Json>();
      final checking = controller.check();
      await controller.beginPractice();
      repository.lookup!.complete(Map.of(repository.value));
      await checking;
      await expectFresh();
    },
  );
}
