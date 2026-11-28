import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import 'grammar_repository.dart';

class GrammarFilteredGroup {
  const GrammarFilteredGroup({
    required this.group,
    required this.topics,
  });

  final GrammarTreeNode group;
  final List<GrammarTreeNode> topics;
}

class GrammarController extends ChangeNotifier {
  GrammarController({required this.repository});

  static const Duration cacheTtl = Duration(minutes: 10);

  static int cefrRank(String? level) => kCefrLevels.indexOf(level ?? '');

  final GrammarRepository repository;

  bool _disposed = false;
  bool _loading = false;
  bool _loaded = false;
  Future<void>? _inFlight;
  int _loadEpoch = 0;
  DateTime? _loadedAt;
  String? _error;
  String? _selectedCefr;
  String? _minimumVisibleCefr;
  String _searchQuery = '';
  List<GrammarLevelSummary> _levels = const <GrammarLevelSummary>[];
  List<GrammarTreeNode> _groups = const <GrammarTreeNode>[];
  final Set<String> _expandedGroupCodes = <String>{};
  final Map<String, GrammarTopicDetail> _detailCache =
      <String, GrammarTopicDetail>{};

  bool get loading => _loading;
  bool get loaded => _loaded;
  String? get error => _error;
  String? get selectedCefr => _selectedCefr;
  String? get minimumVisibleCefr => _minimumVisibleCefr;
  String get searchQuery => _searchQuery;
  List<GrammarLevelSummary> get levels => _levels;

  bool _passesMinimumVisibleCefr(GrammarTreeNode leaf) {
    final int minRank = cefrRank(_minimumVisibleCefr);
    if (minRank <= 0) return true;
    final int leafRank = cefrRank(leaf.cefrLevel);
    return leafRank < 0 || leafRank >= minRank;
  }

  int get totalLeafCount {
    int count = 0;
    for (final GrammarTreeNode group in _groups) {
      count += _collectLeaves(group).length;
    }
    return count;
  }

  int get visibleLeafCount {
    int count = 0;
    for (final GrammarTreeNode group in _groups) {
      count += _collectLeaves(group).where(_passesMinimumVisibleCefr).length;
    }
    return count;
  }

  List<GrammarTreeNode> topicsForLevel(String cefrLevel) {
    final List<GrammarTreeNode> result = <GrammarTreeNode>[];
    for (final GrammarTreeNode group in _groups) {
      for (final GrammarTreeNode leaf in _collectLeaves(group)) {
        if (leaf.cefrLevel == cefrLevel) {
          result.add(leaf);
        }
      }
    }
    return result;
  }

  int countForLevel(String level) {
    for (final GrammarLevelSummary summary in _levels) {
      if (summary.cefrLevel == level) {
        return summary.topicCount;
      }
    }
    int count = 0;
    for (final GrammarTreeNode group in _groups) {
      count += _collectLeaves(group)
          .where((GrammarTreeNode n) => n.cefrLevel == level)
          .length;
    }
    return count;
  }

  int? completedCountForLevel(String level) {
    for (final GrammarLevelSummary summary in _levels) {
      if (summary.cefrLevel == level) {
        return summary.completedCount;
      }
    }
    return null;
  }

  bool isGroupExpanded(String code) => _expandedGroupCodes.contains(code);

  Iterable<GrammarTreeNode> _collectLeaves(GrammarTreeNode node) sync* {
    if (node.isLeaf) {
      yield node;
      return;
    }
    for (final GrammarTreeNode child in node.children) {
      yield* _collectLeaves(child);
    }
  }

  GrammarTreeNode? findTopicByCode(String code) {
    for (final GrammarTreeNode group in _groups) {
      for (final GrammarTreeNode node in _collectLeaves(group)) {
        if (node.code == code) return node;
      }
    }
    return null;
  }

  List<GrammarTreeNode> uncompletedPrerequisites(
    GrammarTreeNode topic, {
    String? minimumBlockingCefr,
  }) {
    final int minRank = cefrRank(minimumBlockingCefr);
    final List<GrammarTreeNode> remaining = <GrammarTreeNode>[];
    for (final String code in topic.prerequisiteCodes) {
      final GrammarTreeNode? node = findTopicByCode(code);
      if (node == null) continue;
      final int nodeRank = cefrRank(node.cefrLevel);
      if (minRank > 0 && nodeRank >= 0 && nodeRank < minRank) {
        continue;
      }
      if (node.learnerStatus != 'COMPLETED') {
        remaining.add(node);
      }
    }
    return remaining;
  }

  List<GrammarFilteredGroup> get visibleGroups {
    final String needle = _searchQuery.trim().toLowerCase();
    final List<GrammarFilteredGroup> result = <GrammarFilteredGroup>[];

    for (final GrammarTreeNode group in _groups) {
      final List<GrammarTreeNode> matchingLeaves = _collectLeaves(group).where((
        GrammarTreeNode leaf,
      ) {
        if (!_passesMinimumVisibleCefr(leaf)) {
          return false;
        }
        if (_selectedCefr != null && leaf.cefrLevel != _selectedCefr) {
          return false;
        }
        if (needle.isNotEmpty) {
          final bool hit =
              leaf.titleVi.toLowerCase().contains(needle) ||
              leaf.titleEn.toLowerCase().contains(needle) ||
              leaf.summaryVi.toLowerCase().contains(needle) ||
              leaf.code.toLowerCase().contains(needle);
          if (!hit) return false;
        }
        return true;
      }).toList();

      if (matchingLeaves.isNotEmpty) {
        result.add(GrammarFilteredGroup(group: group, topics: matchingLeaves));
      }
    }

    return result;
  }

  void setMinimumVisibleCefr(String? level, {bool notify = true}) {
    if (_minimumVisibleCefr == level) return;
    _minimumVisibleCefr = level;
    if (_selectedCefr != null && cefrRank(_selectedCefr) < cefrRank(level)) {
      _selectedCefr = null;
    }
    if (notify) {
      _notify();
    }
  }

  void setSelectedCefr(String? level) {
    if (_selectedCefr == level) return;
    _selectedCefr = level;
    if (level != null) {
      for (final GrammarFilteredGroup item in visibleGroups) {
        _expandedGroupCodes.add(item.group.code);
      }
    }
    _notify();
  }

  void setSearchQuery(String query) {
    if (_searchQuery == query) return;
    _searchQuery = query;
    if (query.trim().isNotEmpty) {
      for (final GrammarFilteredGroup item in visibleGroups) {
        _expandedGroupCodes.add(item.group.code);
      }
    }
    _notify();
  }

  void clearFilters() {
    _selectedCefr = null;
    _searchQuery = '';
    _notify();
  }

  void toggleGroup(String code) {
    if (_expandedGroupCodes.contains(code)) {
      _expandedGroupCodes.remove(code);
    } else {
      _expandedGroupCodes.add(code);
    }
    _notify();
  }

  List<GrammarTreeNode> _extractGroups(List<GrammarTreeNode> roots) {
    final List<GrammarTreeNode> extractedGroups = <GrammarTreeNode>[];
    for (final GrammarTreeNode root in roots) {
      if (!root.isLeaf && root.code == 'grammar') {
        extractedGroups.addAll(
          root.children.where((GrammarTreeNode c) => !c.isLeaf),
        );
        final List<GrammarTreeNode> directLeaves = root.children
            .where((GrammarTreeNode c) => c.isLeaf)
            .toList();
        if (directLeaves.isNotEmpty) {
          extractedGroups.add(
            GrammarTreeNode(
              id: root.id,
              code: root.code,
              parentCode: null,
              cefrLevel: root.cefrLevel,
              isLeaf: false,
              titleEn: root.titleEn,
              titleVi: root.titleVi,
              summaryVi: root.summaryVi,
              orderIndex: root.orderIndex,
              prerequisiteCodes: const <String>[],
              lessonCount: root.lessonCount,
              learnerStatus: null,
              children: directLeaves,
            ),
          );
        }
      } else if (!root.isLeaf) {
        extractedGroups.add(root);
      }
    }
    return extractedGroups;
  }

  Future<void> load({bool force = false}) {
    if (_disposed) return Future<void>.value();
    if (!force) {
      if (_inFlight != null) {
        return _inFlight!;
      }
      final DateTime? loadedAt = _loadedAt;
      if (_loaded &&
          _groups.isNotEmpty &&
          loadedAt != null &&
          DateTime.now().difference(loadedAt) < cacheTtl) {
        return Future<void>.value();
      }
    }

    final int epoch = ++_loadEpoch;
    _inFlight = null;
    final Future<void> task = _performLoad(epoch, force: force);
    _inFlight = task;
    return task;
  }

  Future<void> _performLoad(int epoch, {required bool force}) async {
    _loading = true;
    _error = null;
    // Defer loading notification to a microtask so calling load() from initState
    // does not trigger setState/markNeedsBuild during another listener's build.
    Future<void>.microtask(() {
      if (!_disposed && epoch == _loadEpoch && _loading) {
        _notify();
      }
    });

    try {
      final List<Object> results = await Future.wait<Object>(<Future<Object>>[
        repository.fetchLevels(),
        repository.fetchTree(),
      ]);
      if (_disposed || epoch != _loadEpoch) return;

      final List<GrammarLevelSummary> fetchedLevels =
          results[0] as List<GrammarLevelSummary>;
      final List<GrammarTreeNode> roots = results[1] as List<GrammarTreeNode>;

      _levels = fetchedLevels;
      _groups = _extractGroups(roots);
      if (force) {
        _detailCache.clear();
      }
      _loaded = true;
      _loadedAt = DateTime.now();
      if (_expandedGroupCodes.isEmpty && _groups.isNotEmpty) {
        _expandedGroupCodes.add(_groups.first.code);
      }
    } catch (e) {
      if (_disposed || epoch != _loadEpoch) return;
      _error = formatError(e);
    } finally {
      if (epoch == _loadEpoch) {
        _loading = false;
        _inFlight = null;
        _notify();
      }
    }
  }

  Future<GrammarTopicDetail> loadTopicDetail(
    String code, {
    bool force = false,
  }) async {
    if (!force && _detailCache.containsKey(code)) {
      return _detailCache[code]!;
    }
    final GrammarTopicDetail detail = await repository.fetchTopicDetail(code);
    _detailCache[code] = detail;
    return detail;
  }

  String formatError(Object error) {
    if (error is ApiFailure) return error.message;
    return error.toString();
  }

  void _notify() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
