package com.example.mobile

import android.os.SystemClock
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var conversationAudio: ConversationAudioCapture? = null
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val capture = ConversationAudioCapture(cacheDir)
        conversationAudio = capture
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "lingoroad/conversation_audio")
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "start" -> { capture.start(call.argument<String>("trackId")!!); result.success(null) }
                        "speech" -> { capture.speech(call.argument<Boolean>("started") == true, call.argument<String>("itemId")); result.success(null) }
                        "mute" -> { capture.mute(call.argument<Boolean>("muted") == true); result.success(null) }
                        "stop" -> result.success(capture.stop())
                        "cancel" -> { capture.cancel(); result.success(null) }
                        else -> result.notImplemented()
                    }
                } catch (error: Exception) {
                    result.error("conversation_audio_failed", "Chưa giữ được bản thu hội thoại.", null)
                }
            }
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "lingoroad/activity_clock",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "elapsedRealtimeMilliseconds" -> result.success(SystemClock.elapsedRealtime())
                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        conversationAudio?.cancel()
        super.onDestroy()
    }
}
