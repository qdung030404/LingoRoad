import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  await integrationDriver(
    onScreenshot:
        (String name, List<int> bytes, [Map<String, Object?>? args]) async {
          final evidenceDirectory =
              Platform.environment['DEMO_EVIDENCE_DIR'] ??
              '../../.demo/evidence';
          final file = File('$evidenceDirectory/$name.png');
          await file.parent.create(recursive: true);
          await file.writeAsBytes(bytes);
          return true;
        },
  );
}
