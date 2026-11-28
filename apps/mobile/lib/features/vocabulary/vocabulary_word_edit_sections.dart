part of 'vocabulary_word_edit_dialog.dart';

extension _VocabularyWordEditSections on _VocabularyWordEditDialogState {
  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: AppColors.grey800,
        ),
      ),
    );
  }

  Widget _buildSuggestionsList() {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.grey200),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F000000),
            offset: Offset(0, 4),
            blurRadius: 10,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final item in _suggestions)
            InkWell(
              onTap: () => _selectSuggestion(item['word'] ?? ''),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    const Icon(Icons.search, size: 16, color: AppColors.grey500),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        item['word'] ?? '',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.grey900,
                        ),
                      ),
                    ),
                    if (item['pos'] != null && item['pos']!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primary100),
                        ),
                        child: Text(
                          item['pos']!,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.primary700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildImageArea() {
    final hasImage = _isValidImageUrl(_imageUrl);

    if (hasImage) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.grey200),
        ),
        child: Column(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                _imageUrl!,
                height: 120,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  height: 100,
                  color: const Color(0xFFF1F4F8),
                  alignment: Alignment.center,
                  child: const Text(
                    'Không thể tải ảnh minh họa',
                    style: TextStyle(fontSize: 12, color: AppColors.grey600),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: _showImageUrlDialog,
                  icon: const Icon(Icons.edit, size: 16),
                  label: const Text('Đổi ảnh', style: TextStyle(fontSize: 13)),
                ),
                TextButton.icon(
                  onPressed: () => _updateState(() => _imageUrl = null),
                  icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.error100),
                  label: const Text(
                    'Xóa',
                    style: TextStyle(fontSize: 13, color: AppColors.error100),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return CustomPaint(
      painter: _DottedBorderPainter(
        color: const Color(0xFFD1D5DB),
        strokeWidth: 1.2,
        dash: 6.0,
        gap: 4.0,
        radius: 16.0,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F4F8),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.insert_drive_file_outlined,
                size: 20,
                color: AppColors.grey600,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Chọn ảnh cho ví dụ cho từ vựng',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.grey700,
              ),
            ),
            const SizedBox(height: 10),
            InkWell(
              onTap: _showImageUrlDialog,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFD1D5DB)),
                ),
                child: const Text(
                  'Chọn ảnh',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.grey900,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DottedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double gap;
  final double dash;
  final double radius;

  _DottedBorderPainter({
    required this.color,
    this.strokeWidth = 1.0,
    this.dash = 5.0,
    this.gap = 3.0,
    this.radius = 16.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0.0;
      while (distance < metric.length) {
        final length =
            (distance + dash <= metric.length) ? dash : metric.length - distance;
        final extractPath = metric.extractPath(distance, distance + length);
        canvas.drawPath(extractPath, paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DottedBorderPainter oldDelegate) =>
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth ||
      dash != oldDelegate.dash ||
      gap != oldDelegate.gap ||
      radius != oldDelegate.radius;
}

