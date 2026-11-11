import Flutter
import UIKit
import Darwin

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var activityClockChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    let channel = FlutterMethodChannel(
      name: "lingoroad/activity_clock",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      guard call.method == "elapsedRealtimeMilliseconds" else {
        result(FlutterMethodNotImplemented)
        return
      }

      var timebase = mach_timebase_info_data_t()
      guard mach_timebase_info(&timebase) == KERN_SUCCESS, timebase.denom != 0 else {
        result(FlutterError(
          code: "ACTIVITY_CLOCK_UNAVAILABLE",
          message: "Cannot read the system continuous clock.",
          details: nil
        ))
        return
      }
      // Convert through Double to avoid overflowing UInt64 during tick scaling.
      // Continuous time includes sleep; Dart decides which intervals are active.
      let milliseconds = Double(mach_continuous_time())
        * Double(timebase.numer) / Double(timebase.denom) / 1_000_000
      result(Int64(milliseconds))
    }
    activityClockChannel = channel
  }
}
