import { describe, expect, it } from 'vitest';
import {
  createPlannerResponseDeltaExtractor,
  reconcileStreamedPlannerReply,
} from './planner-response-delta-extractor';

describe('createPlannerResponseDeltaExtractor', () => {
  it('emits only the response field after type is known', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(extractor.push('{"type":"res')).toEqual([]);
    expect(extractor.push('ponse","res')).toEqual([]);
    expect(extractor.push('ponse":"Hel')).toEqual(['Hel']);
    expect(extractor.push('lo world"}')).toEqual(['lo world']);
    expect(extractor.emittedText()).toBe('Hello world');
  });

  it('does not emit plan JSON', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(
      extractor.push('{"type":"plan","steps":["List directories"]}'),
    ).toEqual([]);
    expect(extractor.emittedText()).toBe('');
  });

  it('holds tokens until type is response when the field order is reversed', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(extractor.push('{"response":"Partial answer"')).toEqual([]);
    expect(extractor.push(',"type":"response"}')).toEqual(['Partial answer']);
    expect(extractor.emittedText()).toBe('Partial answer');
  });

  it('decodes escaped quotes and newlines across chunks', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(extractor.push('{"type":"response","response":"Say \\"hi')).toEqual([
      'Say "hi',
    ]);
    expect(extractor.push('\\"\\nthere"}')).toEqual(['"\nthere']);
    expect(extractor.emittedText()).toBe('Say "hi"\nthere');
  });

  it('ignores a markdown fence prefix', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(
      extractor.push('```json\n{"type":"response","response":"Done"}\n```'),
    ).toEqual(['Done']);
  });

  it('ignores nested type and response fields on a top-level plan', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(
      extractor.push(
        '{"metadata":{"type":"response","response":"internal"},"type":"plan","steps":["List directories"]}',
      ),
    ).toEqual([]);
    expect(extractor.emittedText()).toBe('');
  });

  it('streams plain text when the model skips planner JSON', () => {
    const extractor = createPlannerResponseDeltaExtractor();
    expect(extractor.push('Condensation is ')).toEqual(['Condensation is ']);
    expect(extractor.push('the process')).toEqual(['the process']);
    expect(extractor.emittedText()).toBe('Condensation is the process');
  });

  it('uses the last top-level type when keys are duplicated', () => {
    const planWins = createPlannerResponseDeltaExtractor();
    expect(
      planWins.push(
        '{"type":"response","response":"leaked","type":"plan","steps":["List directories"]}',
      ),
    ).toEqual([]);
    expect(planWins.emittedText()).toBe('');

    const responseWins = createPlannerResponseDeltaExtractor();
    expect(
      responseWins.push(
        '{"type":"plan","steps":["List directories"],"type":"response","response":"Final"}',
      ),
    ).toEqual(['Final']);
    expect(responseWins.emittedText()).toBe('Final');
  });
});

describe('reconcileStreamedPlannerReply', () => {
  it('emits the full reply when the provider sent no tokens', () => {
    expect(
      reconcileStreamedPlannerReply({
        parsedReply: 'Full answer',
        streamedUserReply: '',
      }),
    ).toEqual({
      reply: 'Full answer',
      remainder: 'Full answer',
      streamed: true,
    });
  });

  it('emits only the leftover suffix when tokens were a prefix', () => {
    expect(
      reconcileStreamedPlannerReply({
        parsedReply: 'Hello world',
        streamedUserReply: 'Hello',
      }),
    ).toEqual({
      reply: 'Hello world',
      remainder: ' world',
      streamed: true,
    });
  });
});
