import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/config/app_config.dart';
import '../core/theme/app_colors.dart';

const Set<String> kBundledIllustrations = {
  // Listening scene covers
  'scene-greetings.jpg',
  'scene-first-class.jpg',
  'scene-campus-cafe.jpg',
  'scene-valkyrie.jpg',
  'scene-underground.jpg',
  // Reading scene covers
  'scene-reading-introductions.jpg',
  'scene-reading-book-club.jpg',
  'scene-reading-weekend-market.jpg',
  'scene-reading-library-desk.jpg',
  'scene-reading-hybrid-office.jpg',
  'scene-reading-pocket-park.jpg',
  'scene-reading-deep-reading.jpg',
  // Visual listening 2x2 options
  'opt-lesson-science.jpg',
  'opt-lesson-english.jpg',
  'opt-lesson-art.jpg',
  'opt-lesson-music.jpg',
  'opt-item-dictionary.jpg',
  'opt-item-lunchbox.jpg',
  'opt-item-notebook.jpg',
  'opt-item-textbook.jpg',
  // Vocabulary thumbnails
  'vocab-timetable.jpg',
  'vocab-lesson.jpg',
  'vocab-bring.jpg',
  'vocab-check.jpg',
  'vocab-menu.jpg',
  'vocab-order.jpg',
  'vocab-ready.jpg',
  'vocab-pay.jpg',
  'vocab-cargo.jpg',
  'vocab-sight.jpg',
  'vocab-vessel.jpg',
  'vocab-slope.jpg',
  'vocab-loaded.jpg',
  'vocab-trunk.jpg',
  'vocab-hometown.jpg',
  'vocab-student.jpg',
  'vocab-hobby.jpg',
  'vocab-family.jpg',
  'vocab-dish.jpg',
  'vocab-neighbourhood.jpg',
  'vocab-schedule.jpg',
  'vocab-park.jpg',
  // Speaking topic covers
  'topic-introduce-yourself.jpg',
  'topic-my-day.jpg',
  'topic-my-family.jpg',
  'topic-my-hobbies.jpg',
  'topic-favourite-food.jpg',
  'topic-where-i-live.jpg',
  // Picture description scenes
  'picture-campus-cafe.jpg',
  'picture-weekend-park.jpg',
  'picture-family-kitchen.jpg',
  'picture-study-library.jpg',
  // Personas & speaker avatars
  'persona-lingo.jpg',
  'persona-ava.jpg',
  'persona-brian.jpg',
  'avatar-anna.jpg',
  'avatar-ben.jpg',
  'avatar-staff.jpg',
  'avatar-noah.jpg',
  'avatar-lily.jpg',
  'avatar-narrator.jpg',
};

const _topicIllustrationFallbacks = <String, String>{
  'introduce yourself': 'assets/illustrations/topic-introduce-yourself.jpg',
  'my day': 'assets/illustrations/topic-my-day.jpg',
  'my family': 'assets/illustrations/topic-my-family.jpg',
  'my hobbies': 'assets/illustrations/topic-my-hobbies.jpg',
  'my favourite food': 'assets/illustrations/topic-favourite-food.jpg',
  'where i live': 'assets/illustrations/topic-where-i-live.jpg',
};

const _speakerAvatarFallbacks = <String, String>{
  'anna': 'assets/illustrations/avatar-anna.jpg',
  'ben': 'assets/illustrations/avatar-ben.jpg',
  'staff': 'assets/illustrations/avatar-staff.jpg',
  'noah': 'assets/illustrations/avatar-noah.jpg',
  'lily': 'assets/illustrations/avatar-lily.jpg',
  'narrator': 'assets/illustrations/avatar-narrator.jpg',
};

String? resolveBundledIllustrationAsset(String? rawUrl) {
  final trimmed = rawUrl?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  String? fileName;
  if (trimmed.startsWith('assets/illustrations/')) {
    fileName = trimmed.substring('assets/illustrations/'.length);
  } else {
    const backendPrefix = '/media/learning/v1/images/';
    if (trimmed.startsWith(backendPrefix)) {
      fileName = trimmed.substring(backendPrefix.length);
    }
  }
  if (fileName == null) return null;
  if (kBundledIllustrations.contains(fileName)) {
    return 'assets/illustrations/$fileName';
  }
  // Backward compatibility: older snapshots referencing <stem>.svg resolve to the new real <stem>.jpg.
  if (fileName.toLowerCase().endsWith('.svg')) {
    final upgraded = '${fileName.substring(0, fileName.length - 4)}.jpg';
    if (kBundledIllustrations.contains(upgraded)) {
      return 'assets/illustrations/$upgraded';
    }
  }
  return null;
}

String topicIllustrationAsset(String title, {String? imageUrl}) {
  final explicit = imageUrl?.trim();
  if (explicit != null && explicit.isNotEmpty) return explicit;
  return _topicIllustrationFallbacks[title.trim().toLowerCase()] ??
      'assets/illustrations/topic-introduce-yourself.jpg';
}

String speakerAvatarAsset(String speaker, {String? avatarUrl}) {
  final explicit = avatarUrl?.trim();
  if (explicit != null && explicit.isNotEmpty) return explicit;
  return _speakerAvatarFallbacks[speaker.trim().toLowerCase()] ??
      'assets/illustrations/avatar-narrator.jpg';
}

String personaAvatarAsset(String voiceName) {
  final lower = voiceName.trim().toLowerCase();
  if (lower == 'ava' || lower.contains('-ava')) {
    return 'assets/illustrations/persona-ava.jpg';
  }
  if (lower == 'brian' || lower.contains('-brian')) {
    return 'assets/illustrations/persona-brian.jpg';
  }
  return 'assets/illustrations/persona-lingo.jpg';
}

String? resolveNetworkLearningImageUrl(
  String? rawUrl, {
  String Function(String path)? baseUrlResolver,
  AppConfig? config,
}) {
  final trimmed = rawUrl?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  final resolved = baseUrlResolver != null
      ? baseUrlResolver(trimmed)
      : trimmed.startsWith('/')
      ? (config ?? AppConfig()).resolve(trimmed).toString()
      : trimmed;
  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    return resolved;
  }
  return null;
}

/// Hybrid illustration renderer: resolves bundled local mirrors instantaneously
/// for offline/test reliability, and falls back to network images with caching.
class LearningMediaImage extends StatelessWidget {
  const LearningMediaImage({
    super.key,
    required this.imageUrl,
    this.baseUrlResolver,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.semanticLabel,
    this.fallbackIcon = Icons.image_outlined,
    this.backgroundColor = AppColors.primary25,
    this.cacheWidth = 800,
  });

  final String? imageUrl;
  final String Function(String path)? baseUrlResolver;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadiusGeometry? borderRadius;
  final String? semanticLabel;
  final IconData fallbackIcon;
  final Color backgroundColor;
  final int cacheWidth;

  @override
  Widget build(BuildContext context) {
    final raw = imageUrl?.trim() ?? '';
    Widget content;
    final bundled = resolveBundledIllustrationAsset(raw);
    if (bundled != null) {
      content = _buildAsset(bundled);
    } else if (raw.isEmpty) {
      content = _placeholder();
    } else {
      final resolved = resolveNetworkLearningImageUrl(
        raw,
        baseUrlResolver: baseUrlResolver,
      );
      if (resolved != null) {
        if (resolved.toLowerCase().endsWith('.svg')) {
          content = SvgPicture.network(
            resolved,
            width: width,
            height: height,
            fit: fit,
            placeholderBuilder: (_) => _placeholder(),
          );
        } else {
          content = Image.network(
            resolved,
            width: width,
            height: height,
            fit: fit,
            cacheWidth: cacheWidth,
            loadingBuilder: (context, child, progress) =>
                progress == null ? child : _placeholder(loading: true),
            errorBuilder: (_, _, _) => _placeholder(),
          );
        }
      } else {
        content = _placeholder();
      }
    }

    final box = Container(
      width: width,
      height: height,
      color: backgroundColor,
      child: content,
    );
    final clipped = borderRadius == null
        ? box
        : ClipRRect(borderRadius: borderRadius!, child: box);
    if (semanticLabel == null || semanticLabel!.trim().isEmpty) {
      return ExcludeSemantics(child: clipped);
    }
    return Semantics(
      image: true,
      label: semanticLabel,
      child: clipped,
    );
  }

  Widget _buildAsset(String path) {
    if (path.endsWith('.svg')) {
      return SvgPicture.asset(
        path,
        width: width,
        height: height,
        fit: fit,
      );
    }
    return Image.asset(
      path,
      width: width,
      height: height,
      fit: fit,
      cacheWidth: cacheWidth,
      errorBuilder: (_, _, _) => _placeholder(),
    );
  }

  Widget _placeholder({bool loading = false}) => Center(
    child: loading
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Icon(fallbackIcon, color: AppColors.primary600, size: 28),
  );
}

Future<void> showZoomableIllustrationDialog(
  BuildContext context, {
  required String imageUrl,
  String? title,
  String? caption,
  String Function(String path)? baseUrlResolver,
}) => showDialog<void>(
  context: context,
  builder: (dialogContext) => Dialog(
    backgroundColor: Colors.black87,
    insetPadding: const EdgeInsets.all(16),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    clipBehavior: Clip.antiAlias,
    child: SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 6, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title ?? 'Quan sát tranh',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng ảnh phóng to',
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ],
            ),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.62,
            ),
            child: InteractiveViewer(
              minScale: 1,
              maxScale: 4,
              child: LearningMediaImage(
                imageUrl: imageUrl,
                baseUrlResolver: baseUrlResolver,
                width: double.infinity,
                fit: BoxFit.contain,
                backgroundColor: Colors.transparent,
                semanticLabel: title ?? 'Ảnh minh họa phóng to',
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
            child: Text(
              caption ?? 'Chụm hoặc kéo để phóng to chi tiết trong tranh.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ),
        ],
      ),
    ),
  ),
);
