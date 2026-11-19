import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import 'vocabulary_controller.dart';

class VocabularyImageHelper {
  static final ImagePicker _picker = ImagePicker();

  /// Mở trực tiếp thư viện ảnh (Gallery) của thiết bị và tải lên đám mây.
  /// Trả về URL ảnh nếu upload thành công, hoặc null nếu người dùng hủy/lỗi.
  static Future<String?> pickImageFromGallery({
    required BuildContext context,
    required VocabularyController controller,
  }) async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (picked == null || !context.mounted) return null;

      return await _uploadWithLoading(context, controller, picked.path);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Không thể chọn ảnh: ${controller.message(e)}'),
            backgroundColor: AppColors.error100,
          ),
        );
      }
      return null;
    }
  }

  static Future<String?> _uploadWithLoading(
    BuildContext context,
    VocabularyController controller,
    String filePath,
  ) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: Card(
          shape: RoundedRectangleBorder(borderRadius: AppRadius.cardRadius),
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(strokeWidth: 3),
                SizedBox(height: AppSpacing.md),
                Text('Đang tải ảnh lên đám mây...', style: TextStyle(fontSize: 14)),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final url = await controller.uploadImage(filePath);
      if (context.mounted) Navigator.pop(context);
      return url;
    } catch (e) {
      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi tải ảnh lên: ${controller.message(e)}'),
            backgroundColor: AppColors.error100,
          ),
        );
      }
      return null;
    }
  }
}
