import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../common.dart';
import 'profile_constants.dart';

class ProfileEditDialog extends StatelessWidget {
  const ProfileEditDialog({
    super.key,
    required this.title,
    required this.closeKey,
    required this.onClose,
    required this.body,
    required this.action,
    this.scrollController,
  });

  final String title;
  final Key closeKey;
  final VoidCallback? onClose;
  final Widget body;
  final Widget action;
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context) => Dialog(
    backgroundColor: ProfilePalette.paper,
    surfaceTintColor: Colors.transparent,
    insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    constraints: const BoxConstraints(maxWidth: 400),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: const BorderSide(color: AppColors.borderLight),
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: designHeading(20, color: ProfilePalette.ink),
                  ),
                ),
              ),
              IconButton(
                key: closeKey,
                tooltip: 'Đóng',
                onPressed: onClose,
                icon: const Icon(
                  Icons.close_rounded,
                  color: ProfilePalette.ink,
                ),
              ),
            ],
          ),
          Flexible(
            child: SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.only(top: 4, bottom: 12),
              child: body,
            ),
          ),
          action,
        ],
      ),
    ),
  );
}

class ProfileNameEditDialog extends StatefulWidget {
  const ProfileNameEditDialog({
    super.key,
    required this.initialName,
    required this.onSave,
  });

  final String initialName;
  final Future<void> Function(String name) onSave;

  @override
  State<ProfileNameEditDialog> createState() => _ProfileNameEditDialogState();
}

class _ProfileNameEditDialogState extends State<ProfileNameEditDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _controller = TextEditingController(text: widget.initialName);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(_controller.text.trim());
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = errorMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(9));
    return PopScope<void>(
      canPop: !_saving,
      child: ProfileEditDialog(
        title: 'Sửa họ và tên',
        closeKey: const Key('cancelEditNameButton'),
        onClose: _saving ? null : () => Navigator.of(context).pop(),
        body: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Họ và tên', style: designText(14, weight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextFormField(
                key: const Key('profileNameInput'),
                controller: _controller,
                enabled: !_saving,
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _save(),
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                validator: requiredName,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.grey50,
                  contentPadding: const EdgeInsets.all(12),
                  border: border,
                  enabledBorder: border.copyWith(
                    borderSide: const BorderSide(color: AppColors.borderLight),
                  ),
                  focusedBorder: border.copyWith(
                    borderSide: const BorderSide(
                      color: AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                  errorBorder: border.copyWith(
                    borderSide: const BorderSide(color: AppColors.error200),
                  ),
                  focusedErrorBorder: border.copyWith(
                    borderSide: const BorderSide(color: AppColors.error200),
                  ),
                  errorText: _error,
                  errorMaxLines: 3,
                ),
              ),
            ],
          ),
        ),
        action: FilledButton(
          key: const Key('saveEditNameButton'),
          style: FilledButton.styleFrom(
            backgroundColor: ProfilePalette.ink,
            foregroundColor: ProfilePalette.paper,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9),
            ),
          ),
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Đang lưu...' : 'Lưu tên'),
        ),
      ),
    );
  }
}
