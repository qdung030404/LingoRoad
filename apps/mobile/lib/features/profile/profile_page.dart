import 'package:flutter/material.dart';
import '../../shared/app_text_field.dart';
import '../auth/session_controller.dart';
import '../common.dart';
import '../../shared/figma_widgets.dart';

const learningPurposes = {
  'EXAM': 'Thi chứng chỉ',
  'WORK': 'Công việc',
  'DAILY_COMMUNICATION': 'Giao tiếp hằng ngày',
  'STUDY': 'Học tập ở trường',
};

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.session,
    this.onboarding = false,
  });
  final SessionController session;
  final bool onboarding;
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(
    text: widget.session.user?['name'] as String? ?? '',
  );
  late String? purpose = widget.session.profile['learningPurpose'] as String?;
  late int minutes = widget.session.profile['dailyGoalMinutes'] as int? ?? 10;
  late String level =
      widget.session.profile['selfAssessedCefr'] as String? ?? 'UNKNOWN';
  bool busy = false;
  String? error;
  String? notice;
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
      notice = null;
    });
    try {
      await widget.session.saveProfile({
        'name': name.text.trim(),
        'learningPurpose': purpose,
        'dailyGoalMinutes': minutes,
        'selfAssessedCefr': level == 'UNKNOWN' ? null : level,
      });
      if (mounted) setState(() => notice = 'Đã lưu hồ sơ.');
    } catch (e) {
      if (mounted) setState(() => error = errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: widget.onboarding ? 'Mục tiêu của bạn' : 'Hồ sơ của tôi',
    child: Form(
      key: form,
      child: PageBody(
        children: [
          if (widget.onboarding)
            const BrandHeading(
              title: 'Học theo cách của bạn',
              description: 'Một vài thông tin để bắt đầu hành trình phù hợp.',
            ),
          if (!widget.onboarding)
            Text(widget.session.user?['email'] as String? ?? ''),
          CustomAppTextField(
            label: 'Họ tên',
            controller: name,
            validator: requiredName,
            enabled: !busy,
          ),
          DropdownButtonFormField<String>(
            key: const Key('learningPurpose'),
            initialValue: purpose,
            decoration: const InputDecoration(
              labelText: 'Bạn học tiếng Anh để làm gì?',
            ),
            isExpanded: true,
            items: learningPurposes.entries
                .map(
                  (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                )
                .toList(),
            onChanged: busy ? null : (value) => setState(() => purpose = value),
            validator: (value) => value == null ? 'Chọn mục đích học.' : null,
          ),
          const Text('Thời gian học mỗi ngày'),
          Wrap(
            spacing: 12,
            children: [
              for (final value in [5, 10, 20])
                ChoiceChip(
                  label: Text('$value phút'),
                  selected: minutes == value,
                  onSelected: busy
                      ? null
                      : (_) => setState(() => minutes = value),
                ),
            ],
          ),
          DropdownButtonFormField<String>(
            initialValue: level,
            decoration: const InputDecoration(
              labelText: 'Trình độ tự đánh giá',
            ),
            items: ['UNKNOWN', 'A1', 'A2', 'B1', 'B2']
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(value == 'UNKNOWN' ? 'Chưa biết' : value),
                  ),
                )
                .toList(),
            onChanged: busy ? null : (value) => setState(() => level = value!),
          ),
          if (error != null) ErrorNotice(error!),
          if (notice != null) Text(notice!, semanticsLabel: notice),
          primary(
            widget.onboarding ? 'Lưu và tiếp tục' : 'Lưu thay đổi',
            save,
            busy: busy,
          ),
          if (!widget.onboarding) ...[
            TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ChangePasswordPage(session: widget.session),
                ),
              ),
              child: const Text('Đổi mật khẩu'),
            ),
            TextButton(
              onPressed: busy
                  ? null
                  : () async {
                      setState(() => busy = true);
                      await widget.session.logout();
                    },
              child: const Text('Đăng xuất'),
            ),
          ],
        ],
      ),
    ),
  );
}

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key, required this.session});
  final SessionController session;
  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final form = GlobalKey<FormState>();
  final oldPassword = TextEditingController();
  final newPassword = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    oldPassword.dispose();
    newPassword.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.api.request(
        'POST',
        '/auth/change-password',
        data: {
          'oldPassword': oldPassword.text,
          'newPassword': newPassword.text,
        },
      );
      // The backend revokes refresh tokens after a password change.
      await widget.session.logout();
    } catch (e) {
      if (mounted) setState(() => error = errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: 'Đổi mật khẩu',
    child: Form(
      key: form,
      child: PageBody(
        children: [
          const Text(
            'Sau khi đổi mật khẩu, hãy đăng nhập lại bằng mật khẩu mới.',
          ),
          CustomAppTextField(
            label: 'Mật khẩu hiện tại',
            controller: oldPassword,
            isPassword: true,
            validator: (value) => value == null || value.isEmpty
                ? 'Nhập mật khẩu hiện tại.'
                : null,
          ),
          CustomAppTextField(
            label: 'Mật khẩu mới',
            controller: newPassword,
            isPassword: true,
            validator: validPassword,
          ),
          if (error != null) ErrorNotice(error!),
          primary('Đổi mật khẩu', submit, busy: busy),
        ],
      ),
    ),
  );
}
