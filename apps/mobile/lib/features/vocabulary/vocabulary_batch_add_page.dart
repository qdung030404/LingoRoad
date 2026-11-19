import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'vocabulary_controller.dart';
import 'vocabulary_image_helper.dart';

class WordCardData {
  WordCardData({required this.id}) {
    englishController.addListener(_onEnglishChanged);
  }

  final String id;
  final TextEditingController englishController = TextEditingController();
  final TextEditingController meaningController = TextEditingController();
  final TextEditingController exampleController = TextEditingController();
  final FocusNode englishFocusNode = FocusNode();

  String? selectedPos;
  List<String> availablePos = [];
  Map<String, List<Map<String, String?>>> meaningsByPos = {};
  String? phonetic;
  String? imageUrl;

  List<Map<String, String>> suggestions = [];
  bool showSuggestions = false;
  bool isSearching = false;
  Timer? debounceTimer;
  VoidCallback? onStateChanged;

  void _onEnglishChanged() {
    onStateChanged?.call();
  }

  void dispose() {
    debounceTimer?.cancel();
    englishController.removeListener(_onEnglishChanged);
    englishController.dispose();
    meaningController.dispose();
    exampleController.dispose();
    englishFocusNode.dispose();
  }

  bool get isEmpty =>
      englishController.text.trim().isEmpty &&
      meaningController.text.trim().isEmpty &&
      exampleController.text.trim().isEmpty;

  bool get isValid =>
      englishController.text.trim().isNotEmpty &&
      meaningController.text.trim().isNotEmpty;
}

class VocabularyBatchAddPage extends StatefulWidget {
  const VocabularyBatchAddPage({
    super.key,
    required this.controller,
    required this.deckId,
  });

  final VocabularyController controller;
  final String deckId;

  @override
  State<VocabularyBatchAddPage> createState() => _VocabularyBatchAddPageState();
}

class _VocabularyBatchAddPageState extends State<VocabularyBatchAddPage> {
  final List<WordCardData> _cards = [];
  final ScrollController _scrollController = ScrollController();
  bool _isSaving = false;
  int _cardIdCounter = 0;

  static const List<String> _fallbackPosList = [
    'Danh từ',
    'Động từ',
    'Tính từ',
    'Trạng từ',
    'Cụm từ',
    'Từ vựng',
  ];

  @override
  void initState() {
    super.initState();
    _addNewCard();
  }

  @override
  void dispose() {
    for (final card in _cards) {
      card.dispose();
    }
    _scrollController.dispose();
    super.dispose();
  }

  void _addNewCard({bool autoFocus = false}) {
    final card = WordCardData(id: 'card_${++_cardIdCounter}');
    card.onStateChanged = () {
      if (mounted) setState(() {});
    };
    _cards.add(card);
    setState(() {});

    if (autoFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 260,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
        card.englishFocusNode.requestFocus();
      });
    }
  }

  void _removeCard(WordCardData card) {
    if (_cards.length <= 1) return;
    setState(() {
      _cards.remove(card);
      card.dispose();
    });
  }

  void _onEnglishInputChanged(WordCardData card, String text) {
    card.debounceTimer?.cancel();
    final query = text.trim();
    if (query.isEmpty) {
      setState(() {
        card.suggestions = [];
        card.showSuggestions = false;
        card.isSearching = false;
      });
      return;
    }

    card.debounceTimer = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => card.isSearching = true);
      try {
        final list = await widget.controller.suggestWords(query);
        if (!mounted) return;
        setState(() {
          card.suggestions = list;
          card.showSuggestions = list.isNotEmpty;
          card.isSearching = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => card.isSearching = false);
      }
    });
  }

  Future<void> _selectSuggestion(WordCardData card, String word) async {
    card.debounceTimer?.cancel();
    card.englishController.text = word;
    setState(() {
      card.showSuggestions = false;
      card.suggestions = [];
      card.isSearching = true;
    });

    try {
      final lookup = await widget.controller.lookupWord(word);
      if (!mounted) return;
      if (lookup != null) {
        card.phonetic = lookup['phonetic'] as String? ?? '';
        final available =
            (lookup['availablePos'] as List?)
                ?.map((e) => e.toString())
                .where((s) => s.isNotEmpty)
                .toList() ??
            [];
        card.availablePos = available.isEmpty ? _fallbackPosList : available;

        // Group definitions by part of speech
        final rawByPos = lookup['meaningsByPos'] as Map? ?? {};
        card.meaningsByPos = rawByPos.map((key, value) {
          final items =
              (value as List?)?.map((item) {
                final map = item as Map? ?? {};
                return {
                  'definition': map['definition'] as String? ?? '',
                  'example': map['example'] as String?,
                };
              }).toList() ??
              [];
          return MapEntry(key.toString(), items);
        });

        // Set initial POS and fill definition
        final initialPos = card.availablePos.first;
        card.selectedPos = initialPos;

        final defs = card.meaningsByPos[initialPos];
        if (defs != null && defs.isNotEmpty) {
          card.meaningController.text = defs.first['definition'] ?? '';
          card.exampleController.text = defs.first['example'] ?? '';
        } else {
          final meanings = lookup['meanings'] as List?;
          if (meanings != null && meanings.isNotEmpty) {
            final first = meanings.first as Map? ?? {};
            card.meaningController.text = first['definition'] as String? ?? '';
            card.exampleController.text = first['example'] as String? ?? '';
          }
        }
      }
    } finally {
      if (mounted) setState(() => card.isSearching = false);
    }
  }

  void _onPosChanged(WordCardData card, String? newPos) {
    if (newPos == null) return;
    setState(() {
      card.selectedPos = newPos;
      final defs = card.meaningsByPos[newPos];
      if (defs != null && defs.isNotEmpty) {
        card.meaningController.text = defs.first['definition'] ?? '';
        card.exampleController.text = defs.first['example'] ?? '';
      }
    });
  }

  Future<void> _showImageDialog(WordCardData card) async {
    final result = await VocabularyImageHelper.pickImageFromGallery(
      context: context,
      controller: widget.controller,
    );

    if (result != null && mounted) {
      setState(() {
        card.imageUrl = result;
      });
    }
  }

  bool _isValidImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final uri = Uri.tryParse(url.trim());
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
  }

  Future<void> _saveAll() async {
    final validCards = _cards.where((c) => !c.isEmpty).toList();
    if (validCards.isEmpty) {
      previewMessage(context, 'Nhập ít nhất 1 từ tiếng Anh và nghĩa.');
      return;
    }

    final invalidCard = validCards.where((c) => !c.isValid).firstOrNull;
    if (invalidCard != null) {
      previewMessage(
        context,
        'Vui lòng nhập đủ từ tiếng Anh và nghĩa cho tất cả các thẻ.',
      );
      invalidCard.englishFocusNode.requestFocus();
      return;
    }

    // Kiểm tra trùng lặp trong nội bộ batch
    final seenKeys = <String>{};
    for (final c in validCards) {
      final eng = c.englishController.text.trim().toLowerCase();
      final pos = (c.selectedPos ?? '').trim().toLowerCase();
      final key = '$eng:::$pos';
      if (seenKeys.contains(key)) {
        previewMessage(
          context,
          'Từ "$eng"${pos.isNotEmpty ? ' ($pos)' : ''} bị nhập trùng lặp trong danh sách này.',
        );
        c.englishFocusNode.requestFocus();
        return;
      }
      seenKeys.add(key);
    }

    setState(() => _isSaving = true);
    final wordsPayload = validCards.map((c) {
      return <String, dynamic>{
        'english': c.englishController.text.trim(),
        'meaning': c.meaningController.text.trim(),
        'phonetic': c.phonetic ?? '',
        'partOfSpeech': (c.selectedPos ?? 'Từ vựng').trim(),
        'example': c.exampleController.text.trim(),
        if (_isValidImageUrl(c.imageUrl)) 'imageUrl': c.imageUrl!.trim(),
      };
    }).toList();

    try {
      await widget.controller.createBatchWords(widget.deckId, wordsPayload);
      if (!mounted) return;
      previewMessage(context, 'Đã lưu ${validCards.length} từ thành công.');
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        previewMessage(context, widget.controller.message(e));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final validCount = _cards.where((c) => c.isValid).length;
    final saveLabel = validCount > 0 ? 'Lưu từ ($validCount từ)' : 'Lưu từ';

    return FigmaPage(
      title: 'Thêm từ',
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, size: 20),
        tooltip: 'Quay lại',
        onPressed: () => Navigator.pop(context),
      ),
      trailing: Container(
        margin: const EdgeInsets.only(right: AppSpacing.sm),
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.grey200),
        ),
        child: IconButton(
          icon: const Icon(Icons.add, size: 20, color: AppColors.grey900),
          tooltip: 'Thêm thẻ',
          onPressed: _isSaving ? null : () => _addNewCard(autoFocus: true),
        ),
      ),
      bottom: Container(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.md),
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Color(0x0A000000),
              offset: Offset(0, -4),
              blurRadius: 12,
            ),
          ],
        ),
        child: CustomAppButton(
          text: saveLabel,
          isLoading: _isSaving,
          onPressed: _isSaving ? null : _saveAll,
        ),
      ),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.xl * 2,
        ),
        itemCount: _cards.length + 1,
        itemBuilder: (context, index) {
          if (index == _cards.length) {
            return _buildAddCardButton();
          }
          final card = _cards[index];
          return _buildWordCard(card, index);
        },
      ),
    );
  }

  Widget _buildAddCardButton() {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xl),
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          side: const BorderSide(color: AppColors.grey300, width: 1.2),
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.cardRadius),
          backgroundColor: Colors.white,
        ),
        onPressed: _isSaving ? null : () => _addNewCard(autoFocus: true),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add_circle_outline, size: 20, color: AppColors.primary700),
            const SizedBox(width: AppSpacing.sm),
            Text(
              'Thêm từ tiếp theo',
              style: designText(15, weight: FontWeight.w600, color: AppColors.primary700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWordCard(WordCardData card, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: const Color(0xFFE5E9F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            offset: Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Từ #${index + 1}',
                style: designText(14, weight: FontWeight.w600, color: AppColors.grey500),
              ),
              if (_cards.length > 1)
                IconButton(
                  tooltip: 'Xóa thẻ',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.close, size: 20, color: AppColors.grey500),
                  onPressed: _isSaving ? null : () => _removeCard(card),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Từ tiếng anh
          _buildFieldLabel('Từ tiếng anh *'),
          TextField(
            focusNode: card.englishFocusNode,
            controller: card.englishController,
            enabled: !_isSaving,
            style: designText(15),
            decoration: InputDecoration(
              hintText: 'Nhập từ tiếng Anh...',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: const OutlineInputBorder(borderRadius: AppRadius.inputRadius),
              suffixIcon: card.isSearching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : (card.englishController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () => card.englishController.clear(),
                        )
                      : null),
            ),
            onChanged: (text) => _onEnglishInputChanged(card, text),
            textInputAction: TextInputAction.search,
            onSubmitted: (text) {
              final q = text.trim();
              if (q.isNotEmpty) _selectSuggestion(card, q);
            },
          ),

          // Gợi ý từ (Suggestions list)
          if (card.showSuggestions && card.suggestions.isNotEmpty)
            _buildSuggestionsList(card),

          const SizedBox(height: AppSpacing.md),

          // Nghĩa tiếng việt
          _buildFieldLabel('Nghĩa tiếng việt *'),
          TextField(
            controller: card.meaningController,
            enabled: !_isSaving,
            minLines: 1,
            maxLines: 3,
            style: designText(15),
            decoration: const InputDecoration(
              hintText: 'Nhập nghĩa tiếng Việt...',
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: AppRadius.inputRadius),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Ví dụ (không bắt buộc)
          _buildFieldLabel('Ví dụ ( không bắt buộc )'),
          TextField(
            controller: card.exampleController,
            enabled: !_isSaving,
            minLines: 1,
            maxLines: 3,
            style: designText(15),
            decoration: const InputDecoration(
              hintText: 'Ví dụ câu minh họa...',
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: AppRadius.inputRadius),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Loại từ
          _buildFieldLabel('Loại từ'),
          _buildPosDropdown(card),

          const SizedBox(height: AppSpacing.md),

          // Ảnh (không bắt buộc)
          _buildFieldLabel('Ảnh ( không bắt buộc )'),
          _buildImagePickerArea(card),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: designText(13, weight: FontWeight.w500, color: AppColors.grey700),
      ),
    );
  }

  Widget _buildSuggestionsList(WordCardData card) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
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
          for (final suggestion in card.suggestions)
            InkWell(
              onTap: () => _selectSuggestion(card, suggestion['word'] ?? ''),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    const Icon(Icons.search, size: 16, color: AppColors.grey500),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        suggestion['word'] ?? '',
                        style: designText(14, weight: FontWeight.w500),
                      ),
                    ),
                    if (suggestion['pos'] != null && suggestion['pos']!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primary100),
                        ),
                        child: Text(
                          suggestion['pos']!,
                          style: designText(
                            12,
                            weight: FontWeight.w500,
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

  Widget _buildPosDropdown(WordCardData card) {
    final posOptions = card.availablePos.isNotEmpty ? card.availablePos : _fallbackPosList;
    final currentPos = card.selectedPos ?? posOptions.first;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        borderRadius: AppRadius.inputRadius,
        border: Border.all(color: AppColors.grey300),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: posOptions.contains(currentPos) ? currentPos : posOptions.first,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.grey700),
          style: designText(15),
          items: posOptions.map((pos) {
            return DropdownMenuItem<String>(
              value: pos,
              child: Text(pos),
            );
          }).toList(),
          onChanged: _isSaving ? null : (newPos) => _onPosChanged(card, newPos),
        ),
      ),
    );
  }

  Widget _buildImagePickerArea(WordCardData card) {
    final hasImage = _isValidImageUrl(card.imageUrl);

    return InkWell(
      onTap: _isSaving ? null : () => _showImageDialog(card),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: hasImage ? AppColors.primary500 : const Color(0xFFD1D5DB),
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              hasImage ? Icons.image : Icons.add_photo_alternate_outlined,
              size: 32,
              color: hasImage ? AppColors.primary700 : AppColors.grey500,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              hasImage ? 'Đã liên kết ảnh minh họa' : 'Chọn ảnh cho ví dụ cho từ vựng',
              style: designText(
                13,
                color: hasImage ? AppColors.primary700 : AppColors.grey600,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                shape: const RoundedRectangleBorder(borderRadius: AppRadius.buttonRadius),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              onPressed: _isSaving ? null : () => _showImageDialog(card),
              child: Text(
                hasImage ? 'Đổi ảnh' : 'Chọn ảnh',
                style: designText(13, weight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
