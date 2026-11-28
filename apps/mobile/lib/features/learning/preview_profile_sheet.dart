import 'package:flutter/material.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../auth/session_controller.dart';
import '../placement/placement_pages.dart' show ResultPage;
import '../profile/profile_page.dart';
import 'learning_controller.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'weekly_plan_pages.dart';

/// Displays the learner account & preview summary modal bottom sheet.
void showPreviewProfileSheet({
  required BuildContext context,
  required SessionController? account,
  required PreviewModel model,
  required LearningController? learning,
  required bool loggingOut,
  required VoidCallback onLogout,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: AppRadius.bottomSheetRadius,
    ),
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.sm,
            AppSpacing.lg,
            AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              learningHeading(
                account?.user?['name'] as String? ?? 'Anna · tài khoản mẫu',
                size: 24,
              ),
              AppSpacing.gapMd,
              learningBody(
                account == null
                    ? 'Bạn đang xem giao diện với dữ liệu mẫu trên thiết bị. Phản hồi Nói/Viết là minh họa; không thu micro hay cập nhật kết quả kiểm tra thật.'
                    : 'Bài học, bộ từ cá nhân, lịch sử ôn và tiến độ lưu theo tài khoản. Nói/Viết hiện là bản xem trước.',
              ),
              AppSpacing.gapLg,
              if (account != null) ...[
                CustomAppButton(
                  text: 'Hồ sơ của tôi',
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    previewPush<void>(
                      context,
                      ProfilePage(session: account),
                    ).then((_) => learning?.refresh());
                  },
                ),
                AppSpacing.gapMd,
                Builder(
                  builder: (_) {
                    final placementSessionId =
                        (account.placement['currentSessionId'] ??
                                account.placementResult?['sessionId'])
                            as String?;
                    return CustomAppButton(
                      key: const Key('accountPlacementResult'),
                      text: 'Kết quả đầu vào',
                      isSecondary: true,
                      onPressed: placementSessionId == null
                          ? null
                          : () {
                              Navigator.pop(sheetContext);
                              previewPush(
                                context,
                                ResultPage(
                                  session: account,
                                  sessionId: placementSessionId,
                                ),
                              );
                            },
                    );
                  },
                ),
                AppSpacing.gapMd,
              ] else ...[
                CustomAppButton(
                  text: 'Lộ trình tuần đầu tiên',
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    previewPush(context, WeeklyPlanPage(model: model));
                  },
                ),
                AppSpacing.gapMd,
                CustomAppButton(
                  text: 'Đóng bản xem trước',
                  isSecondary: true,
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    Navigator.of(context).maybePop();
                  },
                ),
                AppSpacing.gapMd,
              ],
              CustomAppButton(
                key: const Key('previewLogout'),
                text: 'Đăng xuất',
                isSecondary: true,
                onPressed: loggingOut
                    ? null
                    : () {
                        Navigator.pop(sheetContext);
                        onLogout();
                      },
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
