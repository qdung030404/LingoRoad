import 'package:flutter/material.dart';
import '../core/api/api_client.dart';
import '../shared/app_button.dart';

String errorMessage(Object error) =>
    error is ApiFailure ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';

class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final child in children)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: child,
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

class ErrorNotice extends StatelessWidget {
  const ErrorNotice(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        liveRegion: true,
        child: Text(
          message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      ),
      if (onRetry != null)
        TextButton(onPressed: onRetry, child: const Text('Thử lại')),
    ],
  );
}

class LoadPage extends StatefulWidget {
  const LoadPage({
    super.key,
    required this.title,
    required this.load,
    required this.builder,
  });
  final String title;
  final Future<Json> Function() load;
  final Widget Function(BuildContext, Json) builder;
  @override
  State<LoadPage> createState() => _LoadPageState();
}

class _LoadPageState extends State<LoadPage> {
  late Future<Json> future = widget.load();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: FutureBuilder<Json>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return PageBody(
            children: [
              ErrorNotice(
                errorMessage(snapshot.error!),
                onRetry: () => setState(() => future = widget.load()),
              ),
            ],
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return widget.builder(context, snapshot.data!);
      },
    ),
  );
}

String? requiredName(String? value) =>
    (value?.trim().length ?? 0) < 2 || value!.trim().length > 100
    ? 'Họ tên cần từ 2 đến 100 ký tự.'
    : null;
String? validEmail(String? value) =>
    !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value?.trim() ?? '')
    ? 'Nhập địa chỉ email hợp lệ.'
    : null;
String? validPassword(String? value) =>
    value == null ||
        value.length < 8 ||
        value.length > 64 ||
        !RegExp(r'[a-z]').hasMatch(value) ||
        !RegExp(r'\d').hasMatch(value)
    ? 'Mật khẩu 8–64 ký tự, có chữ thường và số.'
    : null;

class BrandHeading extends StatelessWidget {
  const BrandHeading({
    super.key,
    required this.title,
    required this.description,
    this.icon = Icons.route_rounded,
  });
  final String title;
  final String description;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 60, color: Theme.of(context).colorScheme.primary),
      const SizedBox(height: 24),
      Text(
        title,
        style: Theme.of(
          context,
        ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 12),
      Text(description, style: Theme.of(context).textTheme.bodyLarge),
    ],
  );
}

Widget primary(String text, VoidCallback? action, {bool busy = false}) =>
    CustomAppButton(text: text, onPressed: action, isLoading: busy);
