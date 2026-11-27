'use client';

import React from 'react';
import { RotateCcw, Search } from 'lucide-react';
import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type {
  AdminAssessmentGroup,
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';

export const ITEM_TYPES: readonly ItemType[] = [
  'MULTIPLE_CHOICE',
  'CLOZE',
  'GAP_FILL',
  'SENTENCE_REORDER',
  'MATCHING',
  'ESSAY',
  'SPEAKING_PROMPT',
];
export const ASSESSMENT_SKILLS: readonly AssessmentSkill[] = [
  'READING',
  'LISTENING',
  'WRITING',
  'SPEAKING',
];
export const CEFR_LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];
export const USAGE_SCOPES: readonly ItemUsageScope[] = [
  'ALL',
  'PLACEMENT',
  'MOCK_EXAM',
  'PRACTICE',
];
export const PAGE_LIMITS = [10, 20, 50] as const;
export const ITEMS_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

export function readInitialItemsFilters(): {
  page: number;
  limit: number;
  search: string;
  skill: AssessmentSkill | '';
  cefr: CefrLevel | '';
  type: ItemType | '';
  scope: ItemUsageScope | '';
  groupId: string;
} {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  const parsedLimit = parsePositiveIntParam(sp?.get('limit'), 10);
  const limit = (PAGE_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 10;
  return {
    page: parsePositiveIntParam(sp?.get('page'), 1),
    limit,
    search: sp?.get('search')?.trim() ?? '',
    skill: parseEnumParam(sp?.get('skill'), ASSESSMENT_SKILLS),
    cefr: parseEnumParam(sp?.get('cefr'), CEFR_LEVELS),
    type: parseEnumParam(sp?.get('type'), ITEM_TYPES),
    scope: parseEnumParam(sp?.get('scope'), USAGE_SCOPES),
    groupId: sp?.get('groupId')?.trim() ?? '',
  };
}

interface ItemsFilterBarProps {
  activeTab: 'items' | 'groups';
  searchInput: string;
  setSearchInput: (value: string) => void;
  setSearchQuery: (value: string) => void;
  typeFilter: ItemType | '';
  setTypeFilter: (value: ItemType | '') => void;
  usageScopeFilter: ItemUsageScope | '';
  setUsageScopeFilter: (value: ItemUsageScope | '') => void;
  skillFilter: AssessmentSkill | '';
  setSkillFilter: (value: AssessmentSkill | '') => void;
  cefrFilter: CefrLevel | '';
  setCefrFilter: (value: CefrLevel | '') => void;
  groupIdFilter: string;
  setGroupIdFilter: (value: string) => void;
  allGroupsForSelect: AdminAssessmentGroup[];
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
  setPage: (page: number) => void;
  setGroupsPage: (page: number) => void;
}

export function ItemsFilterBar({
  activeTab,
  searchInput,
  setSearchInput,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  usageScopeFilter,
  setUsageScopeFilter,
  skillFilter,
  setSkillFilter,
  cefrFilter,
  setCefrFilter,
  groupIdFilter,
  setGroupIdFilter,
  allGroupsForSelect,
  hasActiveFilters,
  handleResetFilters,
  setPage,
  setGroupsPage,
}: ItemsFilterBarProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setGroupsPage(1);
          setSearchQuery(searchInput);
        }}
        className="grid grid-cols-1 items-end gap-3 lg:grid-cols-12"
      >
        <div className="lg:col-span-4">
          <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
            Tìm kiếm
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ID, đề bài hoặc skill..."
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {activeTab === 'items' && (
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Loại
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as ItemType | '');
              }}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">Tất cả loại</option>
              <option value="MULTIPLE_CHOICE">MCQ</option>
              <option value="CLOZE">Cloze</option>
              <option value="GAP_FILL">Gap Fill</option>
              <option value="SENTENCE_REORDER">Reorder</option>
              <option value="MATCHING">Matching</option>
              <option value="ESSAY">Essay</option>
              <option value="SPEAKING_PROMPT">Speaking</option>
            </select>
          </div>
        )}

        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
            Phạm vi
          </label>
          <select
            value={usageScopeFilter}
            onChange={(e) => {
              setPage(1);
              setGroupsPage(1);
              setUsageScopeFilter(e.target.value as ItemUsageScope | '');
            }}
            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tất cả phạm vi</option>
            <option value="ALL">ALL</option>
            <option value="PLACEMENT">PLACEMENT</option>
            <option value="MOCK_EXAM">MOCK_EXAM</option>
            <option value="PRACTICE">PRACTICE</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
            Kỹ năng
          </label>
          <select
            value={skillFilter}
            onChange={(e) => {
              setPage(1);
              setGroupsPage(1);
              setSkillFilter(e.target.value as AssessmentSkill | '');
            }}
            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tất cả skill</option>
            <option value="READING">Reading</option>
            <option value="LISTENING">Listening</option>
            <option value="WRITING">Writing</option>
            <option value="SPEAKING">Speaking</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
            CEFR
          </label>
          <select
            value={cefrFilter}
            onChange={(e) => {
              setPage(1);
              setGroupsPage(1);
              setCefrFilter(e.target.value as CefrLevel | '');
            }}
            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-2.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">Tất cả</option>
            {CEFR_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'items' && (
          <div className="lg:col-span-8">
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Nhóm đề (Group)
            </label>
            <select
              value={groupIdFilter}
              onChange={(e) => {
                setPage(1);
                setGroupIdFilter(e.target.value);
              }}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">Tất cả nhóm đề</option>
              {allGroupsForSelect.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  [{grp.skill} {grp.cefrLevel} P{grp.partNumber}]{' '}
                  {grp.title || grp.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          className={`flex flex-wrap items-center justify-end gap-2 ${
            activeTab === 'items' ? 'lg:col-span-4' : 'lg:col-span-2'
          }`}
        >
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-2.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
          <button
            type="submit"
            className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
          >
            Lọc
          </button>
        </div>
      </form>
    </div>
  );
}
