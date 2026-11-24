import 'dart:ui';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';

const speakingIssueLabels = {
  'Mispronunciation': 'Phát âm sai',
  'Omission': 'Bỏ sót',
  'Insertion': 'Đọc thêm',
  'UnexpectedBreak': 'Ngắt nghỉ sai',
  'MissingBreak': 'Thiếu ngắt nghỉ',
  'Monotone': 'Giọng đều',
};

double? assessmentScore(dynamic value) =>
    value is num && value.isFinite && value >= 0 && value <= 100
    ? value.toDouble()
    : null;
String assessmentScoreText(dynamic value) =>
    assessmentScore(value)?.toStringAsFixed(1) ?? 'Chưa có dữ liệu';

Color scoreColor(double? value) {
  if (value == null) return AppColors.grey500;
  if (value < 60) return AppColors.error200;
  if (value < 80) return AppColors.warning300;
  return AppColors.primary700;
}

({num start, num end})? spokenTiming(Json unit) {
  final start = unit['offsetMs'];
  final length = unit['durationMs'];
  if (start is! num ||
      length is! num ||
      !start.isFinite ||
      !length.isFinite ||
      start < 0 ||
      length <= 0) {
    return null;
  }
  return (start: start, end: start + length);
}

/// Provider offsets share a timeline. Keep phonemes without a reliable match
/// visible separately so that partial or legacy results remain readable.
({List<List<Json>> groups, List<Json> unassigned}) groupWordPhonemes(
  List<Json> syllables,
  List<Json> phonemes,
) {
  final boundaries = syllables.map(spokenTiming).toList();
  final groups = [for (final _ in syllables) <Json>[]];
  final unassigned = <Json>[];
  for (final phoneme in phonemes) {
    final timing = spokenTiming(phoneme);
    final midpoint = timing == null ? null : (timing.start + timing.end) / 2;
    final index = midpoint == null
        ? -1
        : boundaries.indexWhere(
            (boundary) =>
                boundary != null &&
                boundary.start <= midpoint &&
                midpoint < boundary.end,
          );
    if (index == -1) {
      unassigned.add(phoneme);
    } else {
      groups[index].add(phoneme);
    }
  }
  return (groups: groups, unassigned: unassigned);
}

final _suggestionLeadIn = RegExp(
  r'^(?:Bạn có thể nói|Gợi ý(?: diễn đạt)?|You (?:can|could) say|Try saying|Suggested (?:answer|sentence)|A better way to say it is)\s*[:：]\s*',
  caseSensitive: false,
);
final _quotedSuggestion = RegExp(r'^["“]([^"”]+)["”]');
final _sentenceEnd = RegExp(r'[.!?]+(?=\s|$)');
final _titleAbbreviation = RegExp(
  r'\b(?:Mr|Mrs|Ms|Dr|Prof|St)\.$',
  caseSensitive: false,
);
final _dottedAbbreviation = RegExp(r'(?:\b[A-Za-z]\.){2,}$');

/// Older scores may include a lead-in, translations or several examples.
String? conversationSuggestionSentence(String raw) {
  var text = raw.trim().replaceFirst(_suggestionLeadIn, '');
  text = _quotedSuggestion.firstMatch(text)?.group(1) ?? text;
  text = text.replaceAll(RegExp(r'\([^()]*\)'), '').trim();
  text = text.replaceAll(RegExp(r'\s+'), ' ');
  for (final end in _sentenceEnd.allMatches(text)) {
    final candidate = text.substring(0, end.end);
    final rest = text.substring(end.end).trimLeft();
    if (rest.isNotEmpty &&
        (_titleAbbreviation.hasMatch(candidate) ||
            (_dottedAbbreviation.hasMatch(candidate) &&
                RegExp(r'^[a-z]').hasMatch(rest)))) {
      continue;
    }
    text = candidate;
    break;
  }
  if (!RegExp(r'[a-zA-Z]').hasMatch(text)) return null;
  if (!RegExp(r'[.!?]$').hasMatch(text)) text = '$text.';
  return text.length <= 300 ? text : null;
}

Set<String> speakingWordIssues(Json word) {
  final issues = <String>{};
  final error = word['errorType'];
  if (speakingIssueLabels.containsKey(error)) issues.add(error as String);
  final prosody = word['prosody'];
  if (prosody is Map) {
    final unexpected = prosody['unexpectedBreakConfidence'];
    final missing = prosody['missingBreakConfidence'];
    if (unexpected is num && unexpected.isFinite && unexpected > .75) {
      issues.add('UnexpectedBreak');
    }
    if (missing is num && missing.isFinite && missing > .75) {
      issues.add('MissingBreak');
    }
    if (prosody['monotone'] == true) issues.add('Monotone');
  }
  return issues;
}

bool speakingIssueAvailable(List<Json> words, String issue) {
  const fields = {
    'UnexpectedBreak': 'unexpectedBreakConfidence',
    'MissingBreak': 'missingBreakConfidence',
    'Monotone': 'monotone',
  };
  final field = fields[issue];
  if (field == null) return true;
  return words.any(
    (word) =>
        word['errorType'] == issue ||
        word['prosody'] is Map && (word['prosody'] as Map)[field] != null,
  );
}

class AssessmentToken {
  const AssessmentToken(this.text, [this.wordIndex]);
  final String text;
  final int? wordIndex;
}

/// Aligns provider words to reference positions, preserving punctuation/spacing.
/// Insertions consume no reference position. Equal-cost matches prefer order.
List<AssessmentToken> assessmentReferenceTokens(
  String reference,
  List<Json> words,
) {
  final matches = RegExp(
    r"[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*",
    unicode: true,
  ).allMatches(reference).toList();
  final spoken = [
    for (var i = 0; i < words.length; i++)
      if (words[i]['errorType'] != 'Insertion') i,
  ];
  final costs = List.generate(
    matches.length + 1,
    (_) => List<int>.filled(spoken.length + 1, 0),
  );
  for (var i = matches.length; i >= 0; i--) {
    for (var j = spoken.length; j >= 0; j--) {
      if (i == matches.length) {
        costs[i][j] = spoken.length - j;
        continue;
      }
      if (j == spoken.length) {
        costs[i][j] = matches.length - i;
        continue;
      }
      final same =
          matches[i].group(0)!.toLowerCase() ==
          words[spoken[j]]['word']?.toString().toLowerCase();
      final choices = [
        costs[i + 1][j + 1] + (same ? 0 : 1),
        costs[i + 1][j] + 1,
        costs[i][j + 1] + 1,
      ]..sort();
      costs[i][j] = choices.first;
    }
  }
  final positions = <int, int>{};
  var i = 0, j = 0;
  while (i < matches.length && j < spoken.length) {
    final same =
        matches[i].group(0)!.toLowerCase() ==
        words[spoken[j]]['word']?.toString().toLowerCase();
    if (costs[i][j] == costs[i + 1][j + 1] + (same ? 0 : 1)) {
      positions[spoken[j]] = i;
      i++;
      j++;
    } else if (costs[i][j] == costs[i + 1][j] + 1) {
      i++;
    } else {
      j++;
    }
  }
  final atPosition = <int, int>{
    for (final entry in positions.entries) entry.value: entry.key,
  };
  final extras = <int, List<int>>{};
  for (var wordIndex = 0; wordIndex < words.length; wordIndex++) {
    if (positions.containsKey(wordIndex)) continue;
    var anchor = matches.length;
    for (var next = wordIndex + 1; next < words.length; next++) {
      if (positions.containsKey(next)) {
        anchor = positions[next]!;
        break;
      }
    }
    extras.putIfAbsent(anchor, () => []).add(wordIndex);
  }
  final tokens = <AssessmentToken>[];
  var cursor = 0;
  for (var position = 0; position <= matches.length; position++) {
    final start = position == matches.length
        ? reference.length
        : matches[position].start;
    if (start > cursor) {
      tokens.add(AssessmentToken(reference.substring(cursor, start)));
    }
    for (final extra in extras[position] ?? <int>[]) {
      tokens.add(AssessmentToken('${words[extra]['word']} ', extra));
    }
    if (position < matches.length) {
      tokens.add(
        AssessmentToken(matches[position].group(0)!, atPosition[position]),
      );
      cursor = matches[position].end;
    }
  }
  return tokens;
}
