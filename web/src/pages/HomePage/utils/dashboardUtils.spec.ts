import { describe, expect, it } from 'vitest';
import { formatUtcIsoDate } from '../../../utils/dateUtils';
import type {
  DirectoryTreeNode,
  ICompletedDashboardArtifact,
  InteractionStat,
} from '@shared-types';
import {
  buildActivityDays,
  dashboardDateRange,
  dashboardFilteredRange,
  directoryShareData,
  generationBuckets,
  HEATMAP_DAY_COUNT,
  shiftReportingDay,
} from './dashboardUtils';

function stat(overrides: Partial<InteractionStat> = {}): InteractionStat {
  return {
    id: 'root_2026-11-14',
    userId: 'u',
    directoryId: 'root',
    date: '2026-11-14',
    totalSeconds: 60,
    ownSeconds: 0,
    sessionCount: 8,
    byArtifactType: {
      document: 60,
      quiz: 0,
      flashcardSet: 0,
      slideDeck: 0,
      diagramQuiz: 0,
      sequenceQuiz: 0,
      matchQuiz: 0,
    },
    ...overrides,
  };
}
function artifact(
  overrides: Partial<ICompletedDashboardArtifact> = {},
): ICompletedDashboardArtifact {
  return {
    id: 'same',
    title: 'Quiz',
    artifactType: 'quiz',
    completedAt: '2026-11-14T23:59:59.000Z',
    ...overrides,
  };
}

describe('dashboard reporting dates', () => {
  it('uses the fixed contribution history independently of the selected range', () => {
    const history = dashboardDateRange('2026-11-14', HEATMAP_DAY_COUNT);
    expect(history).toEqual({
      startDate: '2026-06-15',
      endDate: '2026-11-14',
      dayCount: 153,
    });
    expect(dashboardFilteredRange('2026-11-14', 'week').startDate).toBe(
      '2026-11-08',
    );
    expect(dashboardFilteredRange('2026-11-14', 'day').startDate).toBe(
      '2026-11-14',
    );
    expect(history.startDate).toBe('2026-06-15');
  });
  it('crosses month, year, and leap-day boundaries as UTC date keys', () => {
    expect(shiftReportingDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftReportingDay('2024-03-01', -1)).toBe('2024-02-29');
  });
});

it('uses UTC reporting days for timestamps near a local midnight', () => {
  expect(formatUtcIsoDate('2026-11-15T00:30:00+08:00')).toBe('2026-11-14');
  expect(formatUtcIsoDate('2026-11-14T23:30:00-08:00')).toBe('2026-11-15');
});

describe('recorded activity', () => {
  it('deduplicates dates and types across ancestor rows, without weighting duration or flushes', () => {
    const range = dashboardDateRange('2026-11-14', 2);
    const rows = [
      stat(),
      stat({
        directoryId: 'child',
        ownSeconds: 60,
        sessionCount: 999,
        totalSeconds: 20_000,
      }),
      stat({
        directoryId: 'other',
        byArtifactType: { ...stat().byArtifactType, quiz: 400 },
      }),
    ];
    const days = buildActivityDays(rows, range);
    expect(days[0]).toEqual({
      date: '2026-11-13',
      hasActivity: false,
      materialTypes: [],
    });
    expect(days[1]).toEqual({
      date: '2026-11-14',
      hasActivity: true,
      materialTypes: ['document', 'quiz'],
    });
    expect(
      buildActivityDays(
        rows.map((row) => ({ ...row, totalSeconds: 1, sessionCount: 1 })),
        range,
      ),
    ).toEqual(days);
  });
  it('keeps saved activity with missing type information without inventing a type', () => {
    const days = buildActivityDays(
      [stat({ byArtifactType: { ...stat().byArtifactType, document: 0 } })],
      dashboardDateRange('2026-11-14', 1),
    );
    expect(days[0].hasActivity).toBe(true);
    expect(days[0].materialTypes).toEqual([]);
  });
  it('does not include records outside the reporting window', () => {
    expect(
      buildActivityDays(
        [stat({ date: '2026-11-15' })],
        dashboardDateRange('2026-11-14', 1),
      )[0].hasActivity,
    ).toBe(false);
  });
  it('uses top-level rollups once for Directory Share', () => {
    const tree: DirectoryTreeNode[] = [
      { directory: { id: 'root', name: 'Root' }, children: [] },
    ].map((node) => ({
      ...node,
      directory: {
        userId: 'u',
        parentId: null,
        level: 0,
        path: '/',
        documentCount: 0,
        childCount: 0,
        quizCount: 0,
        flashcardSetCount: 0,
        slideDeckCount: 0,
        diagramQuizCount: 0,
        ruleIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...node.directory,
      },
    }));
    expect(
      directoryShareData(
        [
          stat({ totalSeconds: 120 }),
          stat({ directoryId: 'child', totalSeconds: 90, ownSeconds: 90 }),
        ],
        tree,
      ),
    ).toEqual([{ directoryId: 'root', name: 'Root', value: 120 }]);
    expect(directoryShareData([stat()], [])).toEqual([]);
  });
});

describe('completed artifact counts', () => {
  it('deduplicates type + ID but keeps the same ID in different artifact collections', () => {
    const buckets = generationBuckets(
      [artifact(), artifact(), artifact({ artifactType: 'flashcardSet' })],
      dashboardDateRange('2026-11-14', 1),
      'type',
    );
    expect(buckets.reduce((sum, row) => sum + row.artifacts.length, 0)).toBe(2);
  });
  it('uses UTC completion dates and excludes the next day', () => {
    const buckets = generationBuckets(
      [
        artifact(),
        artifact({ id: 'tomorrow', completedAt: '2026-11-15T00:00:00Z' }),
        artifact({ id: 'yesterday', completedAt: '2026-11-13T23:59:59Z' }),
      ],
      dashboardDateRange('2026-11-14', 1),
      'date',
    );
    expect(buckets[0].artifacts.map((row) => row.id)).toEqual(['same']);
  });
  it('keeps by-date and by-type totals equal across 5-day groups', () => {
    const range = dashboardDateRange('2026-11-14', 30);
    const rows = [
      artifact({ id: 'first', completedAt: '2026-10-16T00:00:00Z' }),
      artifact({ id: 'boundary', completedAt: '2026-10-21T00:00:00Z' }),
      artifact(),
    ];
    const dates = generationBuckets(rows, range, 'date');
    expect(dates).toHaveLength(6);
    expect(dates[0].artifacts[0].id).toBe('first');
    expect(dates[1].artifacts[0].id).toBe('boundary');
    expect(dates.reduce((sum, row) => sum + row.artifacts.length, 0)).toBe(
      generationBuckets(rows, range, 'type').reduce(
        (sum, row) => sum + row.artifacts.length,
        0,
      ),
    );
  });
});
