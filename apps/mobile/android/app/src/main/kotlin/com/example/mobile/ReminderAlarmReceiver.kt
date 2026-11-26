package com.example.mobile

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> restoreAll(context)
            ACTION_DAILY_REMINDER -> showNotification(context, intent.getStringExtra(EXTRA_ACCOUNT_ID) ?: "local")
        }
    }

    private fun showNotification(context: Context, accountId: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!manager.areNotificationsEnabled()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Nhắc học hằng ngày",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Nhắc duy trì thói quen học tiếng Anh mỗi ngày"
            }
            manager.createNotificationChannel(channel)
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            requestCodeFor(accountId),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }

        val notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Đến giờ học tiếng Anh rồi!")
            .setContentText("Dành vài phút duy trì mục tiêu hôm nay trên LingoRoad nhé.")
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .build()

        manager.notify(requestCodeFor(accountId), notification)
    }

    companion object {
        private const val PREFS_NAME = "lingoroad_reminders"
        private const val KEY_PREFIX = "schedule_"
        private const val ACTION_DAILY_REMINDER = "com.example.mobile.DAILY_REMINDER"
        private const val EXTRA_ACCOUNT_ID = "accountId"
        private const val CHANNEL_ID = "lingoroad_daily_reminder"

        private fun requestCodeFor(accountId: String): Int =
            (accountId.hashCode() and 0x3FFFFFFF) + 1000

        private fun alarmPendingIntent(context: Context, accountId: String): PendingIntent {
            val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
                action = ACTION_DAILY_REMINDER
                putExtra(EXTRA_ACCOUNT_ID, accountId)
            }
            return PendingIntent.getBroadcast(
                context,
                requestCodeFor(accountId),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        fun schedule(context: Context, accountId: String, localTime: String) {
            val parts = localTime.split(":")
            val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 19
            val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 30

            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("$KEY_PREFIX$accountId", localTime)
                .apply()

            val triggerAt = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= System.currentTimeMillis()) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pendingIntent = alarmPendingIntent(context, accountId)
            alarmManager.cancel(pendingIntent)
            alarmManager.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                triggerAt.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pendingIntent,
            )
        }

        fun cancel(context: Context, accountId: String) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove("$KEY_PREFIX$accountId")
                .apply()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(alarmPendingIntent(context, accountId))
        }

        fun restoreAll(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            for ((key, value) in prefs.all) {
                if (key.startsWith(KEY_PREFIX) && value is String) {
                    val accountId = key.removePrefix(KEY_PREFIX)
                    schedule(context, accountId, value)
                }
            }
        }
    }
}
