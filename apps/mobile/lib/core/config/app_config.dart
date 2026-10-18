class AppConfig {
  AppConfig({String? apiBaseUrl, String? environment})
      : environment = (environment ??
                const String.fromEnvironment('APP_ENV', defaultValue: 'dev'))
            .trim()
            .toLowerCase(),
        apiBaseUrl = normalizeBaseUrl(
          apiBaseUrl ??
              const String.fromEnvironment(
                'API_BASE_URL',
                defaultValue: 'http://localhost:5000',
              ),
        ) {
    if (!{'dev', 'staging', 'prod'}.contains(this.environment)) {
      throw ArgumentError.value(
        this.environment,
        'environment',
        'Môi trường phải là dev, staging hoặc prod',
      );
    }
    if (this.environment == 'prod' &&
        Uri.parse(this.apiBaseUrl).scheme != 'https') {
      throw ArgumentError.value(
        this.apiBaseUrl,
        'apiBaseUrl',
        'Production API URL phải dùng HTTPS',
      );
    }
  }

  final String apiBaseUrl;
  final String environment;

  Uri resolve(String path) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$apiBaseUrl$normalizedPath');
  }

  static String normalizeBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(normalized);
    if (normalized.isEmpty ||
        uri == null ||
        !uri.hasScheme ||
        uri.host.isEmpty ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw ArgumentError.value(value, 'apiBaseUrl', 'URL API không hợp lệ');
    }
    return normalized;
  }
}
