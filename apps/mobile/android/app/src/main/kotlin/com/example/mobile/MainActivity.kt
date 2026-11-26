package com.example.mobile

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private var conversationAudio: ConversationAudioCapture? = null
    private var pendingNotificationResult: MethodChannel.Result? = null

    private fun notificationsEnabled(): Boolean {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        return manager.areNotificationsEnabled()
    }

    private fun openAppNotificationSettings() {
        val settingsIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            }
        }
        try {
            startActivity(settingsIntent)
        } catch (_: Exception) {
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            }
            startActivity(fallback)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val capture = ConversationAudioCapture(cacheDir)
        conversationAudio = capture
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "lingoroad/conversation_audio")
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "start" -> {
                            capture.start(call.argument<String>("trackId")!!, call.argument<Boolean>("muted") == true)
                            result.success(null)
                        }
                        "speech" -> { capture.speech(call.argument<Boolean>("started") == true, call.argument<String>("itemId")); result.success(null) }
                        "mute" -> { capture.mute(call.argument<Boolean>("muted") == true); result.success(null) }
                        "amplitudeDb" -> result.success(capture.amplitudeDb())
                        "stop" -> result.success(capture.stop())
                        "cancel" -> { capture.cancel(); result.success(null) }
                        "savedRecordingDirectory" -> {
                            result.success(File(noBackupFilesDir, "conversation-recordings").absolutePath)
                        }
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
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "lingoroad/reminders",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "checkPermission" -> result.success(notificationsEnabled())
                "requestPermission" -> {
                    if (notificationsEnabled()) {
                        result.success(true)
                        return@setMethodCallHandler
                    }
                    if (Build.VERSION.SDK_INT >= 33) {
                        val granted = checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                            PackageManager.PERMISSION_GRANTED
                        val prefs = getSharedPreferences("lingoroad_reminders", Context.MODE_PRIVATE)
                        val alreadyAsked = prefs.getBoolean("permission_asked", false)
                        val showRationale = shouldShowRequestPermissionRationale(
                            android.Manifest.permission.POST_NOTIFICATIONS,
                        )
                        if (!granted && (!alreadyAsked || showRationale)) {
                            prefs.edit().putBoolean("permission_asked", true).apply()
                            pendingNotificationResult?.success(notificationsEnabled())
                            pendingNotificationResult = result
                            requestPermissions(
                                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                                NOTIFICATION_PERMISSION_REQUEST_CODE,
                            )
                            return@setMethodCallHandler
                        }
                    }
                    openAppNotificationSettings()
                    result.success(notificationsEnabled())
                }
                "syncSchedule" -> {
                    val accountId = call.argument<String>("accountId") ?: "local"
                    val enabled = call.argument<Boolean>("enabled") == true
                    val localTime = call.argument<String>("localTime") ?: "19:30"
                    if (enabled) {
                        ReminderAlarmReceiver.schedule(this, accountId, localTime)
                    } else {
                        ReminderAlarmReceiver.cancel(this, accountId)
                    }
                    result.success(null)
                }
                "cancelForAccount" -> {
                    val accountId = call.argument<String>("accountId") ?: "local"
                    ReminderAlarmReceiver.cancel(this, accountId)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            val callback = pendingNotificationResult
            pendingNotificationResult = null
            callback?.success(notificationsEnabled())
            return
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onDestroy() {
        pendingNotificationResult = null
        conversationAudio?.cancel()
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 4107
    }
}
