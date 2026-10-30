import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PreviewWord {
  const PreviewWord(
    this.id,
    this.word,
    this.meaning,
    this.phonetic,
    this.example, {
    this.translation = '',
    this.partOfSpeech = '',
  });
  final String id, word, meaning, phonetic, example, translation, partOfSpeech;
}

class WordDeck {
  const WordDeck(this.id, this.name, this.words);
  final String id, name;
  final List<PreviewWord> words;
}

/// UI demo state, isolated from assessment scores and backend learning records.
/// Ratings are manual labels; this is not a spaced-repetition scheduler.
class WordLibrary extends ChangeNotifier {
  static const storageKey = 'lingoroad.uiPreview.wordLibrary.v1';
  final List<WordDeck> decks = List.of(sampleWordDecks);
  final Map<String, String> ratings = {};
  bool _disposed = false;

  int get totalWords =>
      decks.fold(0, (total, deck) => total + deck.words.length);
  int get rememberedWords =>
      decks.fold(0, (total, deck) => total + remembered(deck));

  int remembered(WordDeck deck) => deck.words.where(isRemembered).length;
  bool isRemembered(PreviewWord word) =>
      (ratings[word.id] ?? (word.id.endsWith('-known') ? 'remember' : '')) ==
      'remember';
  List<PreviewWord> due(WordDeck deck) =>
      deck.words.where((w) => !isRemembered(w)).toList();

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(storageKey);
    if (raw != null) {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      ratings.addAll(Map<String, String>.from(json['ratings'] as Map));
      for (final item in json['decks'] as List) {
        final data = item as Map<String, dynamic>;
        final id = data['id'] as String;
        final words = (data['words'] as List)
            .map(
              (w) => PreviewWord(
                w['id'] as String,
                w['word'] as String,
                w['meaning'] as String,
                w['phonetic'] as String,
                w['example'] as String,
                translation: w['translation'] as String? ?? '',
                partOfSpeech: w['partOfSpeech'] as String? ?? '',
              ),
            )
            .toList();
        final index = decks.indexWhere((d) => d.id == id);
        final deck = WordDeck(id, data['name'] as String, words);
        if (index < 0) {
          decks.add(deck);
        } else {
          decks[index] = deck;
        }
      }
    }
    if (!_disposed) notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      storageKey,
      jsonEncode({
        'ratings': ratings,
        'decks': decks
            .map(
              (d) => {
                'id': d.id,
                'name': d.name,
                'words': d.words
                    .map(
                      (w) => {
                        'id': w.id,
                        'word': w.word,
                        'meaning': w.meaning,
                        'phonetic': w.phonetic,
                        'example': w.example,
                        'translation': w.translation,
                        'partOfSpeech': w.partOfSpeech,
                      },
                    )
                    .toList(),
              },
            )
            .toList(),
      }),
    );
    if (!_disposed) notifyListeners();
  }

  Future<void> rate(PreviewWord word, String rating) async {
    if (!['remember', 'hard', 'forgot'].contains(rating)) return;
    final previous = ratings[word.id];
    ratings[word.id] = rating;
    try {
      await _save();
    } catch (_) {
      if (previous == null) {
        ratings.remove(word.id);
      } else {
        ratings[word.id] = previous;
      }
      rethrow;
    }
  }

  Future<void> addDeck(String name) async {
    if (name.trim().isEmpty) return;
    decks.add(
      WordDeck(
        'custom-${DateTime.now().microsecondsSinceEpoch}',
        name.trim(),
        [],
      ),
    );
    await _save();
  }

  Future<void> addWord(String deckId, String word, String meaning) async {
    final index = decks.indexWhere((d) => d.id == deckId);
    if (index < 0 || word.trim().isEmpty || meaning.trim().isEmpty) return;
    final deck = decks[index];
    decks[index] = WordDeck(deck.id, deck.name, [
      ...deck.words,
      PreviewWord(
        'word-${DateTime.now().microsecondsSinceEpoch}',
        word.trim(),
        meaning.trim(),
        '',
        '',
      ),
    ]);
    await _save();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

List<PreviewWord> _words(String deck, List<List<String>> rows) => [
  for (var i = 0; i < rows.length; i++)
    PreviewWord(
      '$deck-$i${i >= 12 ? '-known' : ''}',
      rows[i][0],
      rows[i][1],
      rows[i][2],
      rows[i][3],
      translation: rows[i].length > 4 ? rows[i][4] : '',
      partOfSpeech: rows[i][0] == 'work' ? 'động từ' : 'danh từ',
    ),
];

final sampleWordDecks = [
  WordDeck(
    'work',
    'Công việc',
    _words('work', const [
      [
        'Serendipity',
        'Sự tình cờ may mắn',
        '/ˌser.ənˈdɪp.ə.ti/',
        'Meeting her is pure serendipity.',
      ],
      [
        'colleague',
        'đồng nghiệp',
        '/ˈkɒl.iːɡ/',
        'My colleague is very helpful.',
      ],
      ['meeting', 'cuộc họp', '/ˈmiː.tɪŋ/', 'We have a meeting today.'],
      ['office', 'văn phòng', '/ˈɒf.ɪs/', 'I work in an office.'],
      ['project', 'dự án', '/ˈprɒdʒ.ekt/', 'Our project starts today.'],
      ['manager', 'quản lý', '/ˈmæn.ɪ.dʒər/', 'The manager is friendly.'],
      ['deadline', 'hạn chót', '/ˈded.laɪn/', 'The deadline is Friday.'],
      ['career', 'sự nghiệp', '/kəˈrɪər/', 'She loves her career.'],
      ['salary', 'tiền lương', '/ˈsæl.ər.i/', 'He earns a good salary.'],
      ['interview', 'phỏng vấn', '/ˈɪn.tə.vjuː/', 'My interview is tomorrow.'],
      ['team', 'nhóm', '/tiːm/', 'Our team works together.'],
      ['task', 'nhiệm vụ', '/tɑːsk/', 'This task is important.'],
      ['job', 'công việc', '/dʒɒb/', 'I like my job.'],
      ['work', 'làm việc', '/wɜːk/', 'I work every day.'],
      ['company', 'công ty', '/ˈkʌm.pə.ni/', 'The company is growing.'],
      ['email', 'thư điện tử', '/ˈiː.meɪl/', 'Please send an email.'],
      ['break', 'giờ nghỉ', '/breɪk/', 'Let us take a break.'],
    ]),
  ),
  WordDeck(
    'family',
    'Gia đình',
    _words('family', const [
      [
        'mother',
        'mẹ',
        '/ˈmʌðə(r)/',
        'My mother is a teacher.',
        'Mẹ tôi là giáo viên.',
      ],
      ['Father', 'bố, cha', '/ˈfɑː.ðər/', 'My father works very well.'],
      ['sister', 'chị, em gái', '/ˈsɪs.tər/', 'My sister is a student.'],
      ['brother', 'anh, em trai', '/ˈbrʌð.ər/', 'My brother likes football.'],
      ['parents', 'bố mẹ', '/ˈpeə.rənts/', 'My parents are kind.'],
      ['grandmother', 'bà', '/ˈɡræn.mʌð.ər/', 'My grandmother tells stories.'],
      ['grandfather', 'ông', '/ˈɡræn.fɑː.ðər/', 'My grandfather has a garden.'],
      ['daughter', 'con gái', '/ˈdɔː.tər/', 'Their daughter is five.'],
      ['son', 'con trai', '/sʌn/', 'Their son loves music.'],
      ['family', 'gia đình', '/ˈfæm.əl.i/', 'I love my family.'],
      ['cousin', 'anh chị em họ', '/ˈkʌz.ən/', 'My cousin lives nearby.'],
      ['uncle', 'chú, bác, cậu', '/ˈʌŋ.kəl/', 'My uncle is a doctor.'],
      ['aunt', 'cô, dì', '/ɑːnt/', 'My aunt is a nurse.'],
      ['child', 'đứa trẻ', '/tʃaɪld/', 'The child is happy.'],
      ['husband', 'chồng', '/ˈhʌz.bənd/', 'Her husband is a teacher.'],
      ['wife', 'vợ', '/waɪf/', 'His wife is an engineer.'],
      ['relative', 'họ hàng', '/ˈrel.ə.tɪv/', 'We visit our relatives.'],
    ]),
  ),
  WordDeck(
    'school',
    'Trường học',
    _words('school', const [
      ['student', 'học sinh', '/ˈstjuː.dənt/', 'I am a student.'],
      ['teacher', 'giáo viên', '/ˈtiː.tʃər/', 'Our teacher is kind.'],
      ['classroom', 'lớp học', '/ˈklɑːs.ruːm/', 'The classroom is clean.'],
      ['lesson', 'bài học', '/ˈles.ən/', 'The lesson starts now.'],
      ['homework', 'bài tập về nhà', '/ˈhəʊm.wɜːk/', 'I do my homework.'],
      ['library', 'thư viện', '/ˈlaɪ.brər.i/', 'We read in the library.'],
      ['book', 'sách', '/bʊk/', 'This book is interesting.'],
      ['notebook', 'vở', '/ˈnəʊt.bʊk/', 'Write in your notebook.'],
      ['pencil', 'bút chì', '/ˈpen.səl/', 'Use a pencil.'],
      ['exam', 'kỳ thi', '/ɪɡˈzæm/', 'The exam is next week.'],
      [
        'subject',
        'môn học',
        '/ˈsʌb.dʒekt/',
        'English is my favourite subject.',
      ],
      ['classmate', 'bạn cùng lớp', '/ˈklɑːs.meɪt/', 'My classmate helps me.'],
      ['school', 'trường học', '/skuːl/', 'I go to school.'],
      ['desk', 'bàn học', '/desk/', 'My desk is tidy.'],
      ['pen', 'bút mực', '/pen/', 'This is my pen.'],
      ['board', 'bảng', '/bɔːd/', 'Look at the board.'],
      ['break', 'giờ ra chơi', '/breɪk/', 'We play during the break.'],
    ]),
  ),
];
