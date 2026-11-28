part of 'profile_and_goals_test.dart';

void _registerProfileAndGoalsExtraTests() {
  testWidgets(
    'Name dialog sits above the keyboard and supports cancel and save',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 290);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      final api = _InterceptingApi(displayName: 'Anna Nguyễn');
      final session = await _bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('editIdentityButton')));
      await tester.tap(find.byKey(const Key('editIdentityButton')));
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsOneWidget);
      expect(
        tester.getRect(find.byKey(const Key('saveEditNameButton'))).bottom,
        lessThanOrEqualTo(640 - 290),
      );
      await tester.enterText(
        find.byKey(const Key('profileNameInput')),
        'Anna Nguyễn Minh',
      );
      await tester.ensureVisible(find.byKey(const Key('cancelEditNameButton')));
      await tester.tap(find.byKey(const Key('cancelEditNameButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profileDisplayName')), findsOneWidget);
      expect(find.text('Anna Nguyễn'), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('editIdentityButton')));
      await tester.tap(find.byKey(const Key('editIdentityButton')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('profileNameInput')),
        'Anna Nguyễn Minh',
      );
      await tester.ensureVisible(find.byKey(const Key('saveEditNameButton')));
      await tester.tap(find.byKey(const Key('saveEditNameButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.text('Đã lưu họ và tên'), findsNothing);
      expect(find.text('Anna Nguyễn Minh'), findsOneWidget);
    },
  );

  testWidgets(
    'Goals dialog uses tactile chips, enforces 3-option close confirmation, updates overview without top toast, and dismisses stale errors while saving',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var failSave = true;
      final api = _InterceptingApi(
        dailyGoalMinutes: 15,
        onRequest: (method, path, data, fallback) async {
          if (method == 'PATCH' &&
              path == '/learning/preferences' &&
              failSave) {
            throw const ApiFailure(
              'Không lưu được thay đổi do kết nối gián đoạn.',
              status: 503,
            );
          }
          return fallback();
        },
      );
      final session = await _bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.byKey(const Key('editLearningGoalsButton')),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('learningGoalsEditDialog')), findsOneWidget);
      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.byKey(const Key('goalsCefrSlider')), findsOneWidget);
      expect(find.byKey(const Key('goalsMinutesSlider')), findsOneWidget);

      expect(find.text('Chưa có thay đổi'), findsOneWidget);

      // Drag CEFR slider all the way right to C2 and select 1 hour (60p) on duration slider
      final cefrSlider = find.byKey(const Key('goalsCefrSlider'));
      await tester.scrollUntilVisible(
        cefrSlider,
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.drag(cefrSlider, const Offset(260, 0));
      await tester.pumpAndSettle();
      expect(find.text('C2 · Thành thạo'), findsOneWidget);

      await tapGoalChip(tester, const ValueKey('minutes-chip-60'));
      expect(find.text('60 phút (1 giờ)'), findsOneWidget);

      await tester.tap(find.byKey(const Key('goalsBackButton')));
      await tester.pumpAndSettle();
      expect(find.text('Tiếp tục chỉnh sửa'), findsOneWidget);
      expect(find.text('Lưu và đóng'), findsOneWidget);
      expect(find.text('Bỏ thay đổi'), findsOneWidget);
      await tester.tap(find.byKey(const Key('leaveDialogContinueButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(
        find.text('Không lưu được thay đổi do kết nối gián đoạn.'),
        findsOneWidget,
      );
      expect(find.text('Lưu lại thay đổi'), findsOneWidget);

      failSave = false;
      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.text('Đã lưu mục tiêu học tập'), findsNothing);
      expect(find.text('60 phút/ngày'), findsOneWidget);
      expect(find.text('Mục tiêu C2'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    '409 conflict auto-confirms when server snapshot matches draft, and displays all differing fields before manual overwrite',
    (tester) async {
      final apiMatch = _InterceptingApi(
        learningPurpose: 'WORK',
        targetCefr: 'B2',
        dailyGoalMinutes: 20,
        preferredKinds: const ['GRAMMAR', 'VOCABULARY'],
        preferencesVersion: 4,
      );
      final sessionA = await _bootSession(apiMatch);
      sessionA.user = {
        ...sessionA.user!,
        'profile': {
          ...sessionA.profile,
          'learningPurpose': 'STUDY',
          'targetCefr': 'B1',
          'dailyGoalMinutes': 15,
          'preferredKinds': ['GRAMMAR'],
          'preferencesVersion': 3,
        },
      };

      var initialFetched = false;
      apiMatch.onRequest = (method, path, data, fallback) async {
        if (method == 'GET' &&
            path == '/learning/preferences' &&
            !initialFetched) {
          initialFetched = true;
          return {
            'learningPurpose': 'STUDY',
            'targetCefr': 'B1',
            'dailyGoalMinutes': 15,
            'preferredKinds': ['GRAMMAR'],
            'version': 3,
            'readingLevel': {'cefrLevel': 'B1', 'source': 'PLACEMENT'},
          };
        }
        if (method == 'PATCH' && path == '/learning/preferences') {
          throw const ApiFailure(
            'Thiết lập đã thay đổi.',
            code: 'LEARNING_PREFERENCES_CONFLICT',
            status: 409,
          );
        }
        return fallback();
      };

      await tester.pumpWidget(
        MaterialApp(home: ProfilePage(session: sessionA)),
      );
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.byKey(const Key('editLearningGoalsButton')),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      await tapGoalChip(tester, const ValueKey('purpose-chip-WORK'));
      await tapGoalChip(tester, const ValueKey('cefr-chip-B2'));
      await tapGoalChip(tester, const ValueKey('minutes-chip-20'));
      await tapGoalChip(tester, const ValueKey('kind-chip-VOCABULARY'));

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.text('Đã lưu mục tiêu học tập'), findsNothing);
      expect(find.text('Công việc'), findsOneWidget);
      expect(find.text('20 phút/ngày'), findsOneWidget);

      final apiDiff = _InterceptingApi(
        learningPurpose: 'DAILY_COMMUNICATION',
        targetCefr: 'C1',
        dailyGoalMinutes: 30,
        preferredKinds: const ['LISTENING'],
        preferencesVersion: 9,
      );
      var firstLoadDiff = true;
      apiDiff.onRequest = (method, path, data, fallback) async {
        if (method == 'GET' &&
            path == '/learning/preferences' &&
            firstLoadDiff) {
          firstLoadDiff = false;
          return {
            'learningPurpose': 'WORK',
            'targetCefr': 'B1',
            'dailyGoalMinutes': 15,
            'preferredKinds': ['GRAMMAR'],
            'version': 8,
            'readingLevel': {'cefrLevel': 'B1', 'source': 'PLACEMENT'},
          };
        }
        return fallback();
      };
      final sessionB = await _bootSession(apiDiff);
      sessionB.user = {
        ...sessionB.user!,
        'profile': {
          ...sessionB.profile,
          'learningPurpose': 'WORK',
          'targetCefr': 'B1',
          'dailyGoalMinutes': 15,
          'preferredKinds': ['GRAMMAR'],
          'preferencesVersion': 8,
        },
      };

      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey('app-session-b'),
          home: ProfilePage(
            key: const ValueKey('profile-session-b'),
            session: sessionB,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const Key('editLearningGoalsButton')),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      await tapGoalChip(tester, const ValueKey('cefr-chip-B2'));
      await tapGoalChip(tester, const ValueKey('minutes-chip-20'));

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('goalsConflictBox')), findsOneWidget);
      expect(find.textContaining('Mục đích học:'), findsOneWidget);
      expect(find.textContaining('Mục tiêu CEFR:'), findsOneWidget);
      expect(find.textContaining('Thời lượng mỗi ngày:'), findsOneWidget);
      expect(find.textContaining('Nhóm bài ưu tiên:'), findsOneWidget);
      expect(find.text('Lưu lựa chọn đang sửa'), findsOneWidget);

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.text('Đã lưu mục tiêu học tập'), findsNothing);
      expect(apiDiff.profile['dailyGoalMinutes'], 20);
      expect(apiDiff.profile['targetCefr'], 'B2');
    },
  );

  test(
    'ReminderCoordinator coalesces rapid updates, rejects stale server overwrites on 409, and clears local schedule on logout',
    () async {
      final firstPatch = Completer<Json>();
      var patchCount = 0;
      late final Future<Json> Function() firstPatchCommit;
      final api = _InterceptingApi(
        reminderEnabled: true,
        reminderTime: '19:30',
        reminderVersion: 0,
        onRequest: (method, path, data, fallback) async {
          if (method == 'PATCH' && path == '/auth/me') {
            patchCount++;
            if (patchCount == 1) {
              firstPatchCommit = fallback;
              return firstPatch.future;
            }
          }
          return fallback();
        },
      );
      final session = await _bootSession(api);
      final platform = _ScriptedPlatform();
      final coordinator = ReminderCoordinator(
        session: session,
        platform: platform,
      );
      await coordinator.initialize();

      final f1 = coordinator.setTime('20:00');
      final f2 = coordinator.setTime('20:30');
      final f3 = coordinator.setTime('21:00');
      await Future<void>.value();

      firstPatch.complete(await firstPatchCommit());
      await Future.wait([f1, f2, f3]);

      expect(patchCount, 2);
      expect(coordinator.state.serverTime, '21:00');
      expect(coordinator.state.version, 2);
      expect(platform.synced.last.time, '21:00');

      api.profile['reminderTime'] = '22:00';
      api.profile['reminderVersion'] = 3;
      await coordinator.setTime('18:00');
      expect(coordinator.state.serverTime, '22:00');
      expect(coordinator.state.errorMessage, contains('22:00'));

      await session.logout();
      expect(platform.cancelledAccounts, contains('user'));
      coordinator.dispose();
    },
  );

  testWidgets(
    'Home and Progress avatars open ProfilePage directly and reflect updated avatarUrl upon return',
    (tester) async {
      final api = _InterceptingApi(completed: true, displayName: 'Anna Nguyễn');
      final session = SessionController(api);
      await tester.pumpWidget(MyApp(session: session));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('previewAvatar')));
      await tester.pumpAndSettle();
      expect(find.byType(ProfilePage), findsOneWidget);
      expect(find.text('Hồ sơ của tôi'), findsOneWidget);

      await session.saveProfile({
        'avatarUrl': 'https://cdn.example.com/home-avatar.jpg',
      });
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();

      final avatarImg = find.descendant(
        of: find.byKey(const Key('previewAvatar')),
        matching: find.byType(Image),
      );
      expect(avatarImg, findsOneWidget);
      expect(
        (tester.widget<Image>(avatarImg).image as NetworkImage).url,
        'https://cdn.example.com/home-avatar.jpg',
      );

      // Switch to Progress tab (index 4): avatar replaces old A1 badge and opens ProfilePage
      await tester.tap(find.byKey(const Key('previewTab4')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('progressAvatar')), findsOneWidget);
      final progressAvatarImg = find.descendant(
        of: find.byKey(const Key('progressAvatar')),
        matching: find.byType(Image),
      );
      expect(progressAvatarImg, findsOneWidget);
      expect(
        (tester.widget<Image>(progressAvatarImg).image as NetworkImage).url,
        'https://cdn.example.com/home-avatar.jpg',
      );

      await tester.tap(find.byKey(const Key('progressAvatar')));
      await tester.pumpAndSettle();
      expect(find.byType(ProfilePage), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Returning from OS settings (AppLifecycleState.resumed) clears blocked notification banner inline on ProfilePage once granted',
    (tester) async {
      final api = _InterceptingApi(
        completed: true,
        reminderEnabled: true,
        reminderTime: '19:30',
      );
      final session = await _bootSession(api);
      final platform = _ScriptedPlatform(
        permission: NotificationPermissionState.denied,
        afterRequest: NotificationPermissionState.denied,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(session: session, reminderPlatform: platform),
        ),
      );
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.byKey(const Key('notificationPermissionBox')),
        140,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.byKey(const Key('notificationPermissionBox')),
        findsOneWidget,
      );

      platform.permission = NotificationPermissionState.granted;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('notificationPermissionBox')), findsNothing);
      expect(platform.synced, isNotEmpty);
      expect(tester.takeException(), isNull);
    },
  );
}
