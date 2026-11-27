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

  final GrammarRepository repository;

  bool _disposed = false;
  bool _loading = false;
  bool _loaded = false;
  String? _error;
  String? _selectedCefr;
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
  String get searchQuery => _searchQuery;
  List<GrammarLevelSummary> get levels => _levels;

  int get totalLeafCount {
    int count = 0;
    for (final GrammarTreeNode group in _groups) {
      count += _collectLeaves(group).length;
    }
    return count;
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

  List<GrammarTreeNode> uncompletedPrerequisites(GrammarTreeNode topic) {
    final List<GrammarTreeNode> resolved = <GrammarTreeNode>[];
    for (final String code in topic.prerequisiteCodes) {
      final GrammarTreeNode? node = findTopicByCode(code);
      if (node != null) {
        resolved.add(node);
      }
    }
    final List<GrammarTreeNode> uncompleted = resolved
        .where((GrammarTreeNode n) => n.learnerStatus != 'COMPLETED')
        .toList();
    return uncompleted.isNotEmpty ? uncompleted : resolved;
  }

  List<GrammarFilteredGroup> get visibleGroups {
    final String needle = _searchQuery.trim().toLowerCase();
    final List<GrammarFilteredGroup> result = <GrammarFilteredGroup>[];

    for (final GrammarTreeNode group in _groups) {
      final List<GrammarTreeNode> matchingLeaves = _collectLeaves(group).where((
        GrammarTreeNode leaf,
      ) {
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

  Future<void> load({bool force = false}) async {
    if (_loading) return;
    if (_loaded && !force && _groups.isNotEmpty) return;

    _loading = true;
    _error = null;
    _notify();

    try {
      final List<Object> results = await Future.wait<Object>(<Future<Object>>[
        repository.fetchLevels(),
        repository.fetchTree(),
      ]);
      final List<GrammarLevelSummary> fetchedLevels =
          results[0] as List<GrammarLevelSummary>;
      final List<GrammarTreeNode> roots = results[1] as List<GrammarTreeNode>;

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

      _levels = fetchedLevels;
      _groups = extractedGroups;
      if (force) {
        _detailCache.clear();
      }
      _loaded = true;
      if (_expandedGroupCodes.isEmpty && _groups.isNotEmpty) {
        _expandedGroupCodes.add(_groups.first.code);
      }
    } catch (e) {
      _error = formatError(e);
    } finally {
      _loading = false;
      _notify();
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
