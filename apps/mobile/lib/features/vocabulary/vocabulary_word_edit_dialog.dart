import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/figma_widgets.dart';
import 'vocabulary_controller.dart';
import 'vocabulary_image_helper.dart';
import 'vocabulary_models.dart';

class VocabularyWordEditDialog extends StatefulWidget {
  const VocabularyWordEditDialog({
    super.key,
    required this.controller,
    required this.deckId,
    this.word,
  });

  final VocabularyController controller;
  final String deckId;
  final VocabularyWord? word;

  @override
  State<VocabularyWordEditDialog> createState() =>
      _VocabularyWordEditDialogState();
}

class _VocabularyWordEditDialogState extends State<VocabularyWordEditDialog> {
  late final TextEditingController _englishController;
  late final TextEditingController _meaningController;
  late final TextEditingController _exampleController;
  final FocusNode _englishFocusNode = FocusNode();

  String? _selectedPos;
  String? _imageUrl;
  String? _phonetic;
  String? _translation;
  List<String> _aliases = [];
  List<String> _availablePos = [];
  Map<String, List<Map<String, String?>>> _meaningsByPos = {};

  List<Map<String, String>> _suggestions = [];
  bool _showSuggestions = false;
  bool _isSearching = false;
  bool _isLoadingDict = false;
  Timer? _debounceTimer;

  bool _isValidImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final uri = Uri.tryParse(url.trim());
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
  }

  bool _busy = false;
  String? _error;

  static const List<String> _defaultPosList = [
    'Danh từ',
    'Động từ',
    'Tính từ',
    'Trạng từ',
    'Giới từ',
    'Liên từ',
    'Đại từ',
    'Thán từ',
    'Cụm từ',
  ];

  @override
  void initState() {
    super.initState();
    final w = widget.word;
    _englishController = TextEditingController(text: w?.english ?? '');
    _meaningController = TextEditingController(text: w?.meaning ?? '');
    _exampleController = TextEditingController(text: w?.field('example') ?? '');

    if (w != null) {
      final pos = w.field('partOfSpeech');
      _selectedPos = pos.isNotEmpty ? pos : null;
      final img = w.field('imageUrl');
      _imageUrl = img.isNotEmpty ? img : null;
      final phon = w.field('phonetic');
      _phonetic = phon.isNotEmpty ? phon : null;
      final trans = w.field('translation');
      _translation = trans.isNotEmpty ? trans : null;
      _aliases = (w.json['acceptedAnswers'] as List? ?? [])
          .map((e) => e.toString())
          .toList();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && w.english.trim().isNotEmpty) {
          _loadDictionaryForWord(w.english.trim());
        }
      });
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _englishController.dispose();
    _meaningController.dispose();
    _exampleController.dispose();
    _englishFocusNode.dispose();
    super.dispose();
  }

  void _onEnglishChanged(String text) {
    _debounceTimer?.cancel();
    final query = text.trim();
    if (query.isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
        _isSearching = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => _isSearching = true);
      try {
        final list = await widget.controller.suggestWords(query);
        if (!mounted) return;
        setState(() {
          _suggestions = list;
          _showSuggestions = list.isNotEmpty;
          _isSearching = false;
        });
      } catch (_) {
        if (mounted) setState(() => _isSearching = false);
      }
    });
  }

  Future<void> _selectSuggestion(String word) async {
    _debounceTimer?.cancel();
    _englishController.text = word;
    setState(() {
      _showSuggestions = false;
      _suggestions = [];
      _isSearching = true;
    });

    try {
      final lookup = await widget.controller.lookupWord(word);
      if (!mounted) return;
      if (lookup != null) {
        _phonetic = lookup['phonetic'] as String? ?? _phonetic;
        final available = (lookup['availablePos'] as List?)
            ?.map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList() ?? [];
        _availablePos = available;

        final rawByPos = lookup['meaningsByPos'] as Map? ?? {};
        _meaningsByPos = rawByPos.map((key, value) {
          final items = (value as List?)?.map((item) {
            final map = item as Map? ?? {};
            return {
              'definition': map['definition'] as String? ?? '',
              'example': map['example'] as String?,
            };
          }).toList() ?? [];
          return MapEntry(key.toString(), items);
        });

        if (_availablePos.isNotEmpty) {
          _selectedPos = _availablePos.first;
          final defs = _meaningsByPos[_selectedPos];
          if (defs != null && defs.isNotEmpty) {
            _meaningController.text = defs.first['definition'] ?? '';
            _exampleController.text = defs.first['example'] ?? '';
          }
        } else {
          final meanings = lookup['meanings'] as List?;
          if (meanings != null && meanings.isNotEmpty) {
            final first = meanings.first as Map? ?? {};
            _meaningController.text = first['definition'] as String? ?? '';
            _exampleController.text = first['example'] as String? ?? '';
          }
        }

        final remoteImg = lookup['imageUrl'] as String?;
        if (_isValidImageUrl(remoteImg)) {
          _imageUrl = remoteImg!.trim();
        }
      }
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  Future<void> _loadDictionaryForWord(String english) async {
    if (mounted) setState(() => _isLoadingDict = true);
    try {
      final lookup = await widget.controller.lookupWord(english);
      if (!mounted || lookup == null) return;

      final available = (lookup['availablePos'] as List?)
          ?.map((e) => e.toString())
          .where((s) => s.isNotEmpty)
          .toList() ?? [];

      final rawByPos = lookup['meaningsByPos'] as Map? ?? {};
      final meaningsMap = rawByPos.map((key, value) {
        final items = (value as List?)?.map((item) {
          final map = item as Map? ?? {};
          return {
            'definition': map['definition'] as String? ?? '',
            'example': map['example'] as String?,
          };
        }).toList() ?? [];
        return MapEntry(key.toString(), items);
      });

      if (!mounted) return;
      setState(() {
        _availablePos = available;
        _meaningsByPos = meaningsMap;
        if (_phonetic == null || _phonetic!.isEmpty) {
          final phon = lookup['phonetic'] as String?;
          if (phon != null && phon.isNotEmpty) _phonetic = phon;
        }
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoadingDict = false);
    }
  }

  Future<void> _onPosSelected(String pos) async {
    final defs = _meaningsByPos[pos];
    final newDef = (defs != null && defs.isNotEmpty) ? (defs.first['definition'] ?? '') : '';
    final newEx = (defs != null && defs.isNotEmpty) ? (defs.first['example'] ?? '') : '';

    if (newDef.isEmpty || _meaningController.text.trim().isEmpty) {
      setState(() {
        _selectedPos = pos;
        if (newDef.isNotEmpty) {
          _meaningController.text = newDef;
          _exampleController.text = newEx;
        }
      });
      return;
    }

    if (_meaningController.text.trim() == newDef.trim()) {
      setState(() => _selectedPos = pos);
      return;
    }

    final shouldUpdate = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.dialogRadius),
        title: const Text('Cập nhật nghĩa theo loại từ?'),
        content: Text(
          'Bạn vừa chọn "$pos". Bạn có muốn cập nhật định nghĩa và ví dụ từ từ điển cho loại từ này không?',
          style: const TextStyle(fontSize: 14, color: AppColors.grey700),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Giữ nguyên'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.primary600),
            child: const Text('Cập nhật'),
          ),
        ],
      ),
    );

    if (!mounted) return;
    setState(() {
      _selectedPos = pos;
      if (shouldUpdate == true) {
        _meaningController.text = newDef;
        if (newEx.isNotEmpty || _exampleController.text.trim().isEmpty) {
          _exampleController.text = newEx;
        }
      }
    });
  }

  void _openPosPicker() {
    final displayList = _availablePos.isNotEmpty ? _availablePos : _defaultPosList;

    showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.bottomSheetRadius),
      backgroundColor: Colors.white,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.xs,
                ),
                child: Text(
                  'Chọn loại từ',
                  style: designHeading(18, color: AppColors.grey900),
                ),
              ),
              const Divider(),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: displayList.map((pos) {
                    final isSelected = _selectedPos == pos;
                    return ListTile(
                      title: Text(
                        pos,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          color: isSelected ? AppColors.primary700 : AppColors.grey900,
                        ),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_rounded, color: AppColors.primary600)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx, pos);
                      },
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((pos) {
      if (pos != null && mounted) {
        _onPosSelected(pos);
      }
    });
  }

  Future<void> _showImageUrlDialog() async {
    final result = await VocabularyImageHelper.pickImageFromGallery(
      context: context,
      controller: widget.controller,
    );

    if (result != null && mounted) {
      setState(() {
        _imageUrl = result;
      });
    }
  }

  Future<void> _save() async {
    final eng = _englishController.text.trim();
    final mean = _meaningController.text.trim();
    if (eng.isEmpty || mean.isEmpty) {
      setState(() => _error = 'Nhập từ tiếng Anh và nghĩa tiếng Việt.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    final body = <String, dynamic>{
      'english': eng,
      'meaning': mean,
      'partOfSpeech': (_selectedPos ?? '').trim(),
      'example': _exampleController.text.trim(),
      if (_phonetic != null && _phonetic!.isNotEmpty) 'phonetic': _phonetic,
      if (_translation != null && _translation!.isNotEmpty) 'translation': _translation,
      if (_isValidImageUrl(_imageUrl)) 'imageUrl': _imageUrl!.trim(),
      'acceptedAnswers': _aliases,
    };

    try {
      if (widget.word == null) {
        await widget.controller.createWord(widget.deckId, body);
      } else {
        await widget.controller.updateWord(widget.word!, body);
      }
      if (mounted && widget.controller.active) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) setState(() => _error = widget.controller.message(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.dialogRadius),
      backgroundColor: Colors.white,
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Chỉnh sửa + nút X
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.word == null ? 'Thêm từ' : 'Chỉnh sửa',
                    style: designHeading(20, color: AppColors.grey900),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.grey600),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: _busy ? null : () => Navigator.pop(context, false),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Từ tiếng anh
              _buildFieldLabel('Từ tiếng anh'),
              TextField(
                controller: _englishController,
                focusNode: _englishFocusNode,
                enabled: !_busy,
                style: const TextStyle(fontSize: 15, color: AppColors.grey900),
                decoration: InputDecoration(
                  hintText: 'Nhập từ tiếng Anh...',
                  hintStyle: const TextStyle(fontSize: 14, color: AppColors.grey500),
                  filled: true,
                  fillColor: const Color(0xFFF1F4F8),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary500, width: 1.2),
                  ),
                  suffixIcon: _isSearching
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : (_englishController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: AppColors.grey600),
                              onPressed: () {
                                _englishController.clear();
                                _onEnglishChanged('');
                              },
                            )
                          : null),
                ),
                onChanged: _onEnglishChanged,
                textInputAction: TextInputAction.search,
                onSubmitted: (text) {
                  final q = text.trim();
                  if (q.isNotEmpty) _selectSuggestion(q);
                },
              ),

              // Autocomplete suggestions
              if (_showSuggestions && _suggestions.isNotEmpty)
                _buildSuggestionsList(),

              const SizedBox(height: 14),

              // Nghĩa tiếng việt
              _buildFieldLabel('Nghĩa tiếng việt'),
              TextField(
                controller: _meaningController,
                enabled: !_busy,
                minLines: 1,
                maxLines: 3,
                style: const TextStyle(fontSize: 15, color: AppColors.grey900),
                decoration: InputDecoration(
                  hintText: 'Nhập nghĩa tiếng Việt...',
                  hintStyle: const TextStyle(fontSize: 14, color: AppColors.grey500),
                  filled: true,
                  fillColor: const Color(0xFFF1F4F8),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary500, width: 1.2),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Ví dụ ( không bắt buộc )
              _buildFieldLabel('Ví dụ ( không bắt buộc )'),
              TextField(
                controller: _exampleController,
                enabled: !_busy,
                minLines: 1,
                maxLines: 3,
                style: const TextStyle(fontSize: 15, color: AppColors.grey900),
                decoration: InputDecoration(
                  hintText: 'Nhập câu ví dụ minh họa...',
                  hintStyle: const TextStyle(fontSize: 14, color: AppColors.grey500),
                  filled: true,
                  fillColor: const Color(0xFFF1F4F8),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary500, width: 1.2),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Loại từ
              _buildFieldLabel('Loại từ'),
              InkWell(
                onTap: (_busy || _isLoadingDict || _isSearching) ? null : _openPosPicker,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F4F8),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _isLoadingDict || _isSearching
                              ? 'Đang tải gợi ý từ điển...'
                              : (_selectedPos != null && _selectedPos!.trim().isNotEmpty
                                  ? _selectedPos!.trim()
                                  : 'Chọn loại từ'),
                          style: TextStyle(
                            fontSize: 15,
                            color: (_selectedPos != null &&
                                    _selectedPos!.trim().isNotEmpty &&
                                    !_isLoadingDict &&
                                    !_isSearching)
                                ? AppColors.grey900
                                : AppColors.grey500,
                          ),
                        ),
                      ),
                      if (_isLoadingDict || _isSearching)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary500,
                          ),
                        )
                      else
                        const Icon(
                          Icons.keyboard_arrow_down,
                          color: AppColors.grey700,
                          size: 22,
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Ảnh ( không bắt buộc )
              _buildFieldLabel('Ảnh ( không bắt buộc )'),
              _buildImageArea(),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 13, color: AppColors.error100),
                ),
              ],

              const SizedBox(height: 20),

              // Nút Lưu từ
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.grey900,
                    foregroundColor: Colors.white,
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius,
                    ),
                    elevation: 0,
                  ),
                  onPressed: _busy ? null : _save,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Lưu từ',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

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
                  onPressed: () => setState(() => _imageUrl = null),
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
