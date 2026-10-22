import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/figma_assets.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_preview.dart';

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key, required this.onEmail, this.onLogout});
  final VoidCallback onEmail;
  final Future<void> Function()? onLogout;
  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  int page = 0;
  double dragDistance = 0;
  final pages = PageController();
  int phoneCacheWidth = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scale = math.min(MediaQuery.sizeOf(context).width, 430) / 393;
    final width = (280 * scale * MediaQuery.devicePixelRatioOf(context))
        .ceil()
        .clamp(1, 1419);
    if (phoneCacheWidth == width) return;
    phoneCacheWidth = width;
    // The three exported phone PNGs have identical bytes; decode one at its
    // displayed physical size and reuse it across the carousel.
    unawaited(
      precacheImage(
        ResizeImage(
          AssetImage(FigmaAssets.files['welcome/imgIPhone15Pro']!),
          width: width,
        ),
        context,
      ),
    );
    for (final source in sources) {
      unawaited(
        precacheImage(
          AssetImage('assets/figma/${source}_glow_3x.png'),
          context,
        ),
      );
    }
  }

  @override
  void dispose() {
    pages.dispose();
    super.dispose();
  }

  static const sources = ['welcome', 'welcome-audio', 'welcome-path'];
  static const titles = [
    'Ứng dụng học\ntiếng Anh',
    'Học tiếng anh\nmọi nơi',
    'Lộ trình thiết kế\nriêng cho bạn',
  ];
  static const subtitles = [
    'Khóa học và tài liệu được tổ chức rõ ràng, sẵn sàng cho bạn bắt đầu.',
    'Rèn luyện toàn diện 4 kỹ năng: nói, đọc, viết và nghe dành cho bạn',
    'Nâng cao trình độ tiếng Anh phù hợp với phong cách riêng của bạn',
  ];
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: AppColors.grey25,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
    child: Scaffold(
      body: LayoutBuilder(
        builder: (context, viewport) => Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 430),
            child: LayoutBuilder(
              builder: (context, bounds) {
                final scale = bounds.maxWidth / 393;
                final height = math.max(bounds.maxHeight, 852 * scale);
                return SingleChildScrollView(
                  child: SizedBox(
                    height: height,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                stops: [0, .50565, .91406],
                                colors: [
                                  Color(0xFF59B070),
                                  Color(0xFF73DD91),
                                  AppColors.grey25,
                                ],
                              ),
                            ),
                          ),
                        ),
                        Positioned.fill(
                          child: PageView.builder(
                            key: const Key('welcomePages'),
                            itemCount: 3,
                            controller: pages,
                            onPageChanged: (value) =>
                                setState(() => page = value),
                            itemBuilder: (context, index) => RepaintBoundary(
                              child: _WelcomeArt(
                                source: sources[index],
                                index: index,
                                scale: scale,
                                phoneCacheWidth: phoneCacheWidth,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: MediaQuery.paddingOf(context).top + 12,
                          right: 16,
                          child: TextButton(
                            key: const Key('openLearningPreview'),
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.grey900,
                            ),
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    LearningPreview(onLogout: widget.onLogout),
                              ),
                            ),
                            child: Text(
                              'Khám phá giao diện',
                              style: designText(12, weight: FontWeight.w500),
                            ),
                          ),
                        ),
                        Positioned(
                          left: 8,
                          right: 8,
                          bottom: math.max(
                            24,
                            MediaQuery.paddingOf(context).bottom,
                          ),
                          child: GestureDetector(
                            onHorizontalDragStart: (_) => dragDistance = 0,
                            onHorizontalDragUpdate: (details) =>
                                dragDistance += details.delta.dx,
                            onHorizontalDragEnd: (_) {
                              if (dragDistance.abs() < 35) return;
                              pages.animateToPage(
                                (page + (dragDistance < 0 ? 1 : -1)).clamp(
                                  0,
                                  2,
                                ),
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeOut,
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                32,
                                16,
                                16,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.grey5,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x0F0D2249),
                                    offset: Offset(0, 1),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const FigmaAsset(
                                    'welcome/imgUnion',
                                    width: 72,
                                    height: 52,
                                  ),
                                  const SizedBox(height: 24),
                                  SizedBox(
                                    width: 300,
                                    child: Text(
                                      titles[page],
                                      textAlign: TextAlign.center,
                                      style: designText(
                                        32,
                                        weight: FontWeight.w600,
                                        height: 1,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  SizedBox(
                                    width: 270,
                                    child: Text(
                                      subtitles[page],
                                      textAlign: TextAlign.center,
                                      style: designText(
                                        16,
                                        color: AppColors.grey800,
                                        height: 1.5,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 20),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      for (var i = 0; i < 3; i++)
                                        GestureDetector(
                                          key: Key('welcomeDot$i'),
                                          onTap: () => pages.animateToPage(
                                            i,
                                            duration: const Duration(
                                              milliseconds: 250,
                                            ),
                                            curve: Curves.easeOut,
                                          ),
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 3,
                                            ),
                                            child: Container(
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: page == i
                                                    ? AppColors.grey900
                                                    : AppColors.grey300,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 24),
                                  _SocialButton(
                                    label: 'Tiếp tục với Apple',
                                    icon: 'apple/imgLogos',
                                    dark: true,
                                    onPressed: () => _emailNotice(context),
                                  ),
                                  const SizedBox(height: 12),
                                  _SocialButton(
                                    label: 'Tiếp tục với Google',
                                    icon: 'google/imgLogos',
                                    onPressed: () => _emailNotice(context),
                                  ),
                                  const SizedBox(height: 12),
                                  _SocialButton(
                                    label: 'Tiếp tục với Email',
                                    muted: true,
                                    onPressed: widget.onEmail,
                                  ),
                                  const SizedBox(height: 24),
                                  const TermsCaption(),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    ),
  );
  void _emailNotice(BuildContext context) =>
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bản demo hiện hỗ trợ đăng nhập bằng email.'),
        ),
      );
}

class TermsCaption extends StatelessWidget {
  const TermsCaption({super.key});
  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      style: designText(12, color: AppColors.grey800),
      children: const [
        TextSpan(text: 'Tiếp tục đồng ý '),
        TextSpan(
          text: 'Điều khoản Sử dụng',
          style: TextStyle(
            decoration: TextDecoration.underline,
            fontWeight: FontWeight.w600,
          ),
        ),
        TextSpan(text: ' của LingoRoad'),
      ],
    ),
    textAlign: TextAlign.center,
  );
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.dark = false,
    this.muted = false,
  });
  final String label;
  final String? icon;
  final VoidCallback onPressed;
  final bool dark, muted;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 48,
    width: double.infinity,
    child: ElevatedButton(
      style: ElevatedButton.styleFrom(
        elevation: 0,
        backgroundColor: dark
            ? AppColors.grey900
            : muted
            ? AppColors.grey25
            : Colors.white,
        foregroundColor: dark ? Colors.white : AppColors.grey900,
        side: !dark && !muted
            ? const BorderSide(color: AppColors.grey200)
            : BorderSide.none,
        shape: const StadiumBorder(),
      ),
      onPressed: onPressed,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            FigmaAsset(icon!, size: 20),
            const SizedBox(width: 8),
          ],
          Text(
            label,
            style: designText(
              14,
              weight: FontWeight.w500,
              color: dark ? Colors.white : AppColors.grey900,
            ),
          ),
        ],
      ),
    ),
  );
}

class _WelcomeArt extends StatelessWidget {
  const _WelcomeArt({
    required this.source,
    required this.index,
    required this.scale,
    required this.phoneCacheWidth,
  });
  final String source;
  final int index;
  final double scale;
  final int phoneCacheWidth;
  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.hardEdge,
    children: [
      // Generated once from the original SVG, rotation and sigma=50 blur.
      // This texture is transparent: the live background gradient stays separate.
      Positioned(
        left: 0,
        top: 0,
        width: 393 * scale,
        height: 852 * scale,
        child: Image.asset(
          'assets/figma/${source}_glow_3x.png',
          fit: BoxFit.fill,
        ),
      ),
      Positioned(
        left: 56.5 * scale,
        top: 63.21 * scale,
        child: FigmaAsset(
          'welcome/imgIPhone15Pro',
          width: 280 * scale,
          height: 551.712 * scale,
          cacheWidth: phoneCacheWidth,
        ),
      ),
      if (index == 0) ...[
        _artCard(
          50,
          130.51,
          293,
          'Tăng cường từ vựng',
          'Mở rộng vốn từ',
          'welcome/imgVuesaxLinearBook',
        ),
        _artCard(
          62,
          228.51,
          269,
          'Mindspeak',
          'Luyện tập hội thoại',
          'welcome/imgVuesaxLinearMicrophone',
        ),
      ],
      if (index == 1) ...[
        Positioned(
          left: 13 * scale,
          top: 133 * scale,
          child: Container(
            width: 267 * scale,
            height: 68 * scale,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.grey5,
              borderRadius: BorderRadius.circular(99),
            ),
            child: Text.rich(
              TextSpan(
                style: designText(18, weight: FontWeight.w500),
                children: const [
                  TextSpan(text: 'The weather is '),
                  TextSpan(
                    text: 'good today',
                    style: TextStyle(color: Color(0xFFF34737)),
                  ),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          left: 87 * scale,
          top: 235 * scale,
          child: Container(
            width: 294 * scale,
            height: 68 * scale,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey5,
              borderRadius: BorderRadius.circular(99),
            ),
            child: Row(
              children: [
                Container(
                  width: 44 * scale,
                  height: 44 * scale,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: AppColors.primary25,
                    shape: BoxShape.circle,
                  ),
                  child: FigmaAsset(
                    'welcome-audio/imgVuesaxLinearPlay',
                    size: 24 * scale,
                  ),
                ),
                SizedBox(width: 12 * scale),
                SizedBox(
                  width: 202 * scale,
                  height: 31 * scale,
                  child: Stack(
                    children: [
                      FigmaAsset(
                        'welcome-audio/imgGroup112221',
                        width: 102 * scale,
                        height: 31 * scale,
                      ),
                      Positioned(
                        left: 100 * scale,
                        child: FigmaAsset(
                          'welcome-audio/imgGroup112222',
                          width: 102 * scale,
                          height: 31 * scale,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
      if (index == 2)
        Positioned(
          left: 79 * scale,
          top: 146 * scale,
          child: Container(
            width: 236 * scale,
            height: 68 * scale,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey5,
              borderRadius: BorderRadius.circular(99),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final name in ['Book', 'Microphone', 'VolumeHigh'])
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: AppColors.primary25,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: FigmaAsset('welcome-path/imgVuesaxLinear$name'),
                  ),
                Text('20+', style: designText(18, color: AppColors.primary500)),
              ],
            ),
          ),
        ),
    ],
  );
  Widget _artCard(
    double x,
    double y,
    double width,
    String title,
    String subtitle,
    String icon,
  ) => Positioned(
    left: x * scale,
    top: y * scale,
    child: Container(
      width: width * scale,
      height: 68 * scale,
      padding: EdgeInsets.all(12 * scale),
      decoration: BoxDecoration(
        color: AppColors.grey5,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        children: [
          Container(
            width: 44 * scale,
            height: 44 * scale,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary25,
            ),
            child: FigmaAsset(icon, size: 24 * scale),
          ),
          SizedBox(width: 12 * scale),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: designText(14 * scale, weight: FontWeight.w600),
                ),
                SizedBox(height: 8 * scale),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: designText(12 * scale, color: AppColors.grey800),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
