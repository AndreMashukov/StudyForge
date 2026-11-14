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
  heatmapActivityDescription,
  heatmapActivityLevel,
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
  it('uses duration for intensity even when the same five material types were recorded', () => {
    const types = {
      ...stat().byArtifactType,
      document: 1,
      quiz: 1,
      flashcardSet: 1,
      slideDeck: 1,
      diagramQuiz: 1,
    };
    const range = dashboardDateRange('2026-11-14', 1);
    const brief = buildActivityDays(
      [stat({ ownSeconds: 60, byArtifactType: types })],
      range,
    );
    const longer = buildActivityDays(
      [
        stat({
          totalSeconds: 100_000,
          ownSeconds: 100_000,
          byArtifactType: {
            ...types,
            document: 80_000,
            quiz: 10_000,
            flashcardSet: 8_000,
            slideDeck: 1_000,
            diagramQuiz: 1_000,
          },
        }),
      ],
      range,
    );
    expect(brief[0].materialTypes).toHaveLength(5);
    expect(longer[0].materialTypes).toEqual(brief[0].materialTypes);
    expect(heatmapActivityLevel(brief[0])).toBe(1);
    expect(heatmapActivityLevel(longer[0])).toBe(4);
  });
  it('deduplicates dates and types and ignores ancestor durations and flush counts', () => {
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
      recordedSeconds: 0,
    });
    expect(days[1]).toEqual({
      date: '2026-11-14',
      hasActivity: true,
      materialTypes: ['document', 'quiz'],
      recordedSeconds: 60,
    });
    expect(
      buildActivityDays(
        rows.map((row) => ({ ...row, totalSeconds: 1, sessionCount: 1 })),
        range,
      ),
    ).toEqual(days);
  });
  it('counts direct directory activity once without parent or duplicate inflation', () => {
    const range = dashboardDateRange('2026-11-14', 1);
    const parent = stat({
      directoryId: 'parent',
      ownSeconds: 30,
      totalSeconds: 630,
    });
    const child = stat({
      directoryId: 'child',
      ownSeconds: 600,
      totalSeconds: 600,
    });
    const day = buildActivityDays(
      [
        parent,
        child,
        child,
        stat({ directoryId: 'grandparent', totalSeconds: 630, ownSeconds: 0 }),
      ],
      range,
    )[0];
    expect(day.recordedSeconds).toBe(630);
    expect(heatmapActivityLevel(day)).toBe(2);
  });
  it('uses stable monotonic duration bands and qualitative descriptions', () => {
    const range = dashboardDateRange('2026-11-14', 1);
    const levels = [1, 300, 301, 900, 901, 1800, 1801].map((ownSeconds) =>
      heatmapActivityLevel(buildActivityDays([stat({ ownSeconds })], range)[0]),
    );
    expect(levels).toEqual([1, 1, 2, 2, 3, 3, 4]);
    const high = buildActivityDays([stat({ ownSeconds: 3600 })], range)[0];
    expect(heatmapActivityDescription(high)).toBe(
      'Very high recorded activity',
    );
    expect(heatmapActivityDescription(high)).not.toMatch(
      /\d|seconds|minutes|hours/,
    );
  });
  it('ignores invalid durations and labels activity with unavailable duration', () => {
    const range = dashboardDateRange('2026-11-14', 1);
    const day = buildActivityDays(
      [
        stat({ ownSeconds: NaN }),
        stat({ directoryId: 'other', ownSeconds: -100 }),
      ],
      range,
    )[0];
    expect(day.recordedSeconds).toBe(0);
    expect(heatmapActivityDescription(day)).toBe(
      'Activity recorded; intensity unavailable',
    );
    expect(heatmapActivityLevel(buildActivityDays([], range)[0])).toBe(0);
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
  it('groups the 30-day view into Monday–Sunday weeks with clipped edge weeks', () => {
    const range = dashboardDateRange('2026-11-14', 30);
    const rows = [
      artifact({ id: 'first', completedAt: '2026-10-16T00:00:00Z' }),
      artifact({ id: 'sunday', completedAt: '2026-10-18T23:59:59Z' }),
      artifact({ id: 'boundary', completedAt: '2026-10-19T00:00:00Z' }),
      artifact(),
    ];
    const dates = generationBuckets(rows, range, 'date');
    expect(dates.map((bucket) => bucket.label)).toEqual([
      'Oct 16–Oct 18',
      'Oct 19–Oct 25',
      'Oct 26–Nov 1',
      'Nov 2–Nov 8',
      'Nov 9–Nov 14',
    ]);
    expect(dates[0].artifacts.map((row) => row.id)).toEqual([
      'first',
      'sunday',
    ]);
    expect(dates[0].artifacts[0].id).toBe('first');
    expect(dates[1].artifacts[0].id).toBe('boundary');
    expect(dates.reduce((sum, row) => sum + row.artifacts.length, 0)).toBe(
      generationBuckets(rows, range, 'type').reduce(
        (sum, row) => sum + row.artifacts.length,
        0,
      ),
    );
  });
  it('allows six calendar buckets when a 30-day range starts on Sunday', () => {
    const range = dashboardDateRange('2026-11-30', 30);
    const buckets = generationBuckets([], range, 'date');
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      'Nov 1',
      'Nov 2–Nov 8',
      'Nov 9–Nov 15',
      'Nov 16–Nov 22',
      'Nov 23–Nov 29',
      'Nov 30',
    ]);
  });
  it('keeps the 7-day view grouped by individual days', () => {
    const buckets = generationBuckets(
      [],
      dashboardDateRange('2026-11-14', 7),
      'date',
    );
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      'Nov 8',
      'Nov 9',
      'Nov 10',
      'Nov 11',
      'Nov 12',
      'Nov 13',
      'Nov 14',
    ]);
  });
  it('aligns weeks across year boundaries without including out-of-range completions', () => {
    const range = dashboardDateRange('2027-01-14', 30);
    const buckets = generationBuckets(
      [
        artifact({ id: 'before', completedAt: '2026-12-15T23:59:59Z' }),
        artifact({ id: 'sunday', completedAt: '2027-01-03T23:59:59Z' }),
        artifact({ id: 'monday', completedAt: '2027-01-04T00:00:00Z' }),
        artifact({ id: 'after', completedAt: '2027-01-15T00:00:00Z' }),
      ],
      range,
      'date',
    );
    expect(
      buckets
        .find((bucket) => bucket.label === 'Dec 28–Jan 3')
        ?.artifacts.map((row) => row.id),
    ).toEqual(['sunday']);
    expect(
      buckets
        .find((bucket) => bucket.label === 'Jan 4–Jan 10')
        ?.artifacts.map((row) => row.id),
    ).toEqual(['monday']);
    expect(
      buckets.flatMap((bucket) => bucket.artifacts).map((row) => row.id),
    ).toEqual(['sunday', 'monday']);
  });
});
