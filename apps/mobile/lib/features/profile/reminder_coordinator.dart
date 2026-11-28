import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../auth/session_controller.dart';

enum NotificationPermissionState { granted, denied }

abstract class ReminderNotificationPlatform {
  Future<NotificationPermissionState> checkPermission();
  Future<NotificationPermissionState> requestPermission();

  /// `localTime` is HH:mm in the device local wall-clock timezone.
  /// `completedDate` (YYYY-MM-DD) controls Smart Suppression:
  /// - non-empty: saves completed date for `accountId`
  /// - null: preserves previously saved completed date
  /// - empty string: clears saved completed date
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
    String? completedDate,
  });

  Future<void> cancelForAccount(String accountId);

  Future<String?> consumeLaunchTarget();
}

Future<void> syncAccountReminderSchedule({
  required ReminderNotificationPlatform platform,
  required String accountId,
  required bool enabled,
  required String localTime,
  String? completedDate,
}) async {
  final permission = await platform.checkPermission();
  if (permission == NotificationPermissionState.granted) {
    await platform.syncSchedule(
      accountId: accountId,
      enabled: enabled,
      localTime: localTime,
      completedDate: completedDate,
    );
  } else if (!enabled) {
    await platform.cancelForAccount(accountId);
  }
}

class SharedPrefsReminderPlatform implements ReminderNotificationPlatform {
  SharedPrefsReminderPlatform({
    this.initialPermission = NotificationPermissionState.granted,
    String? initialLaunchTarget,
  }) : _pendingLaunchTarget = initialLaunchTarget;

  final NotificationPermissionState initialPermission;
  String? _pendingLaunchTarget;

  static String _scheduleKey(String accountId) =>
      'reminder.local_schedule.v1.$accountId';

  static String _completedDateKey(String accountId) =>
      'reminder.completed_date.v1.$accountId';

  @override
  Future<NotificationPermissionState> checkPermission() async =>
      initialPermission;

  @override
  Future<NotificationPermissionState> requestPermission() async =>
      initialPermission;

  @override
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
    String? completedDate,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (!enabled) {
      await prefs.remove(_scheduleKey(accountId));
      await prefs.remove(_completedDateKey(accountId));
      return;
    }
    if (completedDate != null) {
      if (completedDate.isNotEmpty) {
        await prefs.setString(_completedDateKey(accountId), completedDate);
      } else {
        await prefs.remove(_completedDateKey(accountId));
      }
    }
    final effectiveCompletedDate = prefs.getString(
      _completedDateKey(accountId),
    );
    await prefs.setString(
      _scheduleKey(accountId),
      jsonEncode({
        'enabled': true,
        'localTime': localTime,
        'timeZoneMode': 'DEVICE_LOCAL_WALL_CLOCK',
        'completedDate': ?effectiveCompletedDate,
      }),
    );
  }

  @override
  Future<void> cancelForAccount(String accountId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_scheduleKey(accountId));
    await prefs.remove(_completedDateKey(accountId));
  }

  @override
  Future<String?> consumeLaunchTarget() async {
    final target = _pendingLaunchTarget;
    _pendingLaunchTarget = null;
    return target;
  }
}

class MethodChannelReminderPlatform implements ReminderNotificationPlatform {
  MethodChannelReminderPlatform({SharedPrefsReminderPlatform? fallback})
    : _fallback = fallback ?? SharedPrefsReminderPlatform();

  static const MethodChannel _channel = MethodChannel('lingoroad/reminders');
  final SharedPrefsReminderPlatform _fallback;

  bool get _supportsAndroidChannel =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  Future<NotificationPermissionState> checkPermission() async {
    if (!_supportsAndroidChannel) return _fallback.checkPermission();
    try {
      final granted = await _channel.invokeMethod<bool>('checkPermission');
      return granted == true
          ? NotificationPermissionState.granted
          : NotificationPermissionState.denied;
    } on MissingPluginException {
      return _fallback.checkPermission();
    } on PlatformException {
      return _fallback.checkPermission();
    }
  }

  @override
  Future<NotificationPermissionState> requestPermission() async {
    if (!_supportsAndroidChannel) return _fallback.requestPermission();
    try {
      final granted = await _channel.invokeMethod<bool>('requestPermission');
      return granted == true
          ? NotificationPermissionState.granted
          : NotificationPermissionState.denied;
    } on MissingPluginException {
      return _fallback.requestPermission();
    } on PlatformException {
      return _fallback.requestPermission();
    }
  }

  @override
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
    String? completedDate,
  }) async {
    await _fallback.syncSchedule(
      accountId: accountId,
      enabled: enabled,
      localTime: localTime,
      completedDate: completedDate,
    );
    if (!_supportsAndroidChannel) return;
    try {
      await _channel.invokeMethod<void>('syncSchedule', {
        'accountId': accountId,
        'enabled': enabled,
        'localTime': localTime,
        'completedDate': ?completedDate,
      });
    } on MissingPluginException {
      // Running in unit tests or without the Android host plugin.
    } on PlatformException {
      // Ignore native scheduling errors when falling back to local prefs.
    }
  }

  @override
  Future<void> cancelForAccount(String accountId) async {
    await _fallback.cancelForAccount(accountId);
    if (!_supportsAndroidChannel) return;
    try {
      await _channel.invokeMethod<void>('cancelForAccount', {
        'accountId': accountId,
      });
    } on MissingPluginException {
      // Running in unit tests or without the Android host plugin.
    } on PlatformException {
      // Ignore native scheduling errors when falling back to local prefs.
    }
  }

  @override
  Future<String?> consumeLaunchTarget() async {
    if (!_supportsAndroidChannel) return _fallback.consumeLaunchTarget();
    try {
      return await _channel.invokeMethod<String>('consumeLaunchTarget');
    } on MissingPluginException {
      return _fallback.consumeLaunchTarget();
    } on PlatformException {
      return _fallback.consumeLaunchTarget();
    }
  }
}

class ReminderUiState {
  const ReminderUiState({
    required this.enabled,
    required this.time,
    required this.serverEnabled,
    required this.serverTime,
    required this.version,
    required this.permission,
    this.saving = false,
    this.errorMessage,
    this.failedTime,
  });

  final bool enabled;
  final String time;
  final bool serverEnabled;
  final String serverTime;
  final int version;
  final NotificationPermissionState permission;
  final bool saving;
  final String? errorMessage;
  final String? failedTime;

  bool get needsPermissionBanner =>
      enabled && permission == NotificationPermissionState.denied;

  ReminderUiState copyWith({
    bool? enabled,
    String? time,
    bool? serverEnabled,
    String? serverTime,
    int? version,
    NotificationPermissionState? permission,
    bool? saving,
    String? errorMessage,
    bool clearError = false,
    String? failedTime,
    bool clearFailedTime = false,
  }) => ReminderUiState(
    enabled: enabled ?? this.enabled,
    time: time ?? this.time,
    serverEnabled: serverEnabled ?? this.serverEnabled,
    serverTime: serverTime ?? this.serverTime,
    version: version ?? this.version,
    permission: permission ?? this.permission,
    saving: saving ?? this.saving,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    failedTime: clearFailedTime ? null : (failedTime ?? this.failedTime),
  );
}

class _ReminderTarget {
  const _ReminderTarget(this.enabled, this.time);
  final bool enabled;
  final String time;

  @override
  bool operator ==(Object other) =>
      other is _ReminderTarget && other.enabled == enabled && other.time == time;

  @override
  int get hashCode => Object.hash(enabled, time);
}

enum _ReconcileOutcome {
  continueSync,
  remoteConflictHandled,
  unresolvedFailure,
}

/// Coordinates account-scoped reminder updates using Single-Flight + Coalescing
/// and backend optimistic concurrency (`expectedReminderVersion`) so stale or
/// timed-out requests never overwrite newer intent.
class ReminderCoordinator extends ChangeNotifier {
  ReminderCoordinator({
    required this.session,
    ReminderNotificationPlatform? platform,
  }) : platform = platform ?? MethodChannelReminderPlatform() {
    _state = _initialStateFromSession();
    session.onAccountCleared ??= this.platform.cancelForAccount;
  }

  final SessionController session;
  final ReminderNotificationPlatform platform;

  late ReminderUiState _state;
  ReminderUiState get state => _state;

  bool _disposed = false;
  bool _inFlight = false;
  _ReminderTarget? _desired;
  _ReminderTarget? _lastFailedTarget;

  String get _accountId => (session.user?['id'] as String?) ?? 'local';

  ReminderUiState _initialStateFromSession() {
    final p = session.profile;
    final enabled = p['reminderEnabled'] as bool? ?? true;
    final time = p['reminderTime'] as String? ?? '19:30';
    final version = (p['reminderVersion'] as num?)?.toInt() ?? 0;
    return ReminderUiState(
      enabled: enabled,
      time: time,
      serverEnabled: enabled,
      serverTime: time,
      version: version,
      permission: NotificationPermissionState.granted,
    );
  }

  Future<void> initialize() async {
    await recheckPermission();
  }

  Future<void> recheckPermission() async {
    final perm = await platform.checkPermission();
    if (_disposed) return;
    if (perm != _state.permission) {
      _state = _state.copyWith(permission: perm);
      notifyListeners();
    }
    if (perm == NotificationPermissionState.granted) {
      await platform.syncSchedule(
        accountId: _accountId,
        enabled: _state.serverEnabled,
        localTime: _state.serverTime,
      );
    } else if (!_state.serverEnabled) {
      await platform.cancelForAccount(_accountId);
    }
  }

  Future<void> refreshPermissionAndSchedule() async {
    final perm = await platform.requestPermission();
    if (_disposed) return;
    _state = _state.copyWith(permission: perm);
    notifyListeners();
    if (perm == NotificationPermissionState.granted) {
      await platform.syncSchedule(
        accountId: _accountId,
        enabled: _state.serverEnabled,
        localTime: _state.serverTime,
      );
    }
  }

  Future<void> setEnabled(bool nextEnabled) =>
      _enqueue(_ReminderTarget(nextEnabled, _state.time));

  Future<void> setTime(String nextTime) =>
      _enqueue(_ReminderTarget(_state.enabled, nextTime));

  Future<void> retryLastFailed() =>
      _enqueue(_ReminderTarget(_state.enabled, _state.time));

  Future<void> _enqueue(_ReminderTarget target) async {
    if (_disposed) return;
    _desired = target;
    _state = _state.copyWith(
      enabled: target.enabled,
      time: target.time,
      clearError: true,
      clearFailedTime: true,
      saving: true,
    );
    notifyListeners();
    if (_inFlight) return;
    await _drain();
  }

  Future<void> _drain() async {
    _inFlight = true;
    try {
      while (!_disposed && _desired != null) {
        final target = _desired!;
        _desired = null;
        final synced = await _syncSingle(target);
        if (!synced) break;
      }
    } finally {
      _inFlight = false;
      if (!_disposed) {
        _state = _state.copyWith(saving: false);
        notifyListeners();
      }
    }
  }

  Future<bool> _syncSingle(_ReminderTarget target) async {
    try {
      final account = await session.api.request(
        'PATCH',
        '/auth/me',
        data: {
          'reminderEnabled': target.enabled,
          'reminderTime': target.time,
          'expectedReminderVersion': _state.version,
        },
      );
      if (_disposed) return false;
      _applyServerAccount(account);
      _lastFailedTarget = null;
      return true;
    } on ApiFailure catch (e) {
      if (_disposed) return false;
      if (e.status == 409 || e.status == null || e.status! >= 500) {
        final outcome = await _reconcileWithServer(target, e);
        if (outcome == _ReconcileOutcome.continueSync) return true;
        if (outcome == _ReconcileOutcome.remoteConflictHandled) return false;
      }
      _lastFailedTarget = target;
      _setFailureState(target);
      return false;
    } catch (_) {
      if (_disposed) return false;
      _lastFailedTarget = target;
      _setFailureState(target);
      return false;
    }
  }

  void _setFailureState(_ReminderTarget target) {
    final timedAttempted = target.time != _state.serverTime ? target.time : null;
    _state = _state.copyWith(
      enabled: _state.serverEnabled,
      time: _state.serverTime,
      errorMessage: timedAttempted != null
          ? 'Không thể lưu giờ nhắc $timedAttempted do kết nối gián đoạn.'
          : 'Không thể cập nhật cài đặt nhắc học do kết nối gián đoạn.',
      failedTime: timedAttempted,
    );
    _desired = null;
  }

  Future<_ReconcileOutcome> _reconcileWithServer(
    _ReminderTarget failedTarget,
    ApiFailure error,
  ) async {
    try {
      final account = await session.api.request('GET', '/auth/me');
      if (_disposed) return _ReconcileOutcome.unresolvedFailure;
      final prof =
          (account['profile'] as Map?)?.cast<String, dynamic>() ?? const {};
      final srvEnabled = prof['reminderEnabled'] as bool? ?? true;
      final srvTime = prof['reminderTime'] as String? ?? '19:30';
      final srvTarget = _ReminderTarget(srvEnabled, srvTime);

      _applyServerAccount(account);

      final latestDesired = _desired ?? failedTarget;
      if (srvTarget == latestDesired) {
        _lastFailedTarget = null;
        return _ReconcileOutcome.continueSync;
      }
      if (srvTarget == failedTarget || srvTarget == _lastFailedTarget) {
        _desired ??= latestDesired;
        _lastFailedTarget = null;
        return _ReconcileOutcome.continueSync;
      }

      if (error.status == 409) {
        _state = _state.copyWith(
          enabled: srvEnabled,
          time: srvTime,
          errorMessage:
              'Cài đặt nhắc học vừa thay đổi trên thiết bị khác ($srvTime). Đã cập nhật theo máy chủ.',
          clearFailedTime: true,
        );
        _desired = null;
        return _ReconcileOutcome.remoteConflictHandled;
      }
      return _ReconcileOutcome.unresolvedFailure;
    } catch (_) {
      return _ReconcileOutcome.unresolvedFailure;
    }
  }

  void _applyServerAccount(Json account) {
    session.user = account;
    final prof =
        (account['profile'] as Map?)?.cast<String, dynamic>() ?? const {};
    final srvEnabled = prof['reminderEnabled'] as bool? ?? true;
    final srvTime = prof['reminderTime'] as String? ?? '19:30';
    final srvVersion =
        (prof['reminderVersion'] as num?)?.toInt() ?? _state.version;
    _state = _state.copyWith(
      enabled: _desired?.enabled ?? srvEnabled,
      time: _desired?.time ?? srvTime,
      serverEnabled: srvEnabled,
      serverTime: srvTime,
      version: srvVersion,
      clearError: true,
      clearFailedTime: true,
    );
    if (_state.permission == NotificationPermissionState.granted) {
      platform.syncSchedule(
        accountId: _accountId,
        enabled: srvEnabled,
        localTime: srvTime,
      );
    }
    session.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
