import { createHash } from 'node:crypto';
import {
  NARRATION_SCHEMA_VERSION,
  narrationCreditUnits,
  type INarrationPartPlan,
  type INarrationScript,
  type NarrationPart,
  type NarrationRecord,
} from '@shared-types';

/** A planned part with the key that names its audio. */
export interface IKeyedNarrationPart extends INarrationPartPlan {
  key: string;
}

/** Identifies the spoken text a narratable check or a narration was made from. */
export function narrationContentHash(script: INarrationScript): string {
  const hash = createHash('sha256');
  hash.update(`v${NARRATION_SCHEMA_VERSION}\n`);
  for (const segment of script.segments) {
    hash.update(`${segment.blockIndex}\u0000${segment.text}\u0001`);
  }
  return hash.digest('hex');
}

/** Part identity: the same text in the same voice and model is the same audio. */
export function narrationPartKey(
  text: string,
  voice: string,
  model: string,
): string {
  return createHash('sha256')
    .update(
      `v${NARRATION_SCHEMA_VERSION}\u0000${model}\u0000${voice}\u0000${text}`,
    )
    .digest('hex')
    .slice(0, 32);
}

export function keyNarrationParts(
  plan: INarrationPartPlan[],
  voice: string,
  model: string,
): IKeyedNarrationPart[] {
  return plan.map((part) => ({
    ...part,
    key: narrationPartKey(part.text, voice, model),
  }));
}

export interface INarrationWork {
  /** The narration's parts after this run is planned, in document order. */
  parts: NarrationPart[];
  /** Parts that need audio generated. */
  toGenerate: IKeyedNarrationPart[];
  /** Stored parts no longer in the plan; their audio is deleted. */
  obsolete: NarrationPart[];
  chargedCharCount: number;
  creditUnits: number;
  /** The stored narration was made in another voice or model, so all of it is redone. */
  voiceChanged: boolean;
}

/**
 * Compares the current plan with the stored narration. Ready parts whose key
 * is still planned are kept; everything else in the plan is generated.
 */
export function planNarrationWork(
  planned: IKeyedNarrationPart[],
  record: Pick<
    NarrationRecord,
    'parts' | 'voice' | 'model' | 'schemaVersion'
  > | null,
  route: { voice: string; model: string },
): INarrationWork {
  const voiceChanged = Boolean(
    record &&
      record.parts.some((part) => part.status === 'ready') &&
      (record.voice !== route.voice ||
        record.model !== route.model ||
        record.schemaVersion !== NARRATION_SCHEMA_VERSION),
  );
  const readyByKey = new Map(
    (record?.parts ?? [])
      .filter((part) => part.status === 'ready' && part.storagePath)
      .map((part) => [part.key, part]),
  );

  const toGenerate: IKeyedNarrationPart[] = [];
  const toGenerateKeys = new Set<string>();
  const parts: NarrationPart[] = planned.map((plan) => {
    const ready = readyByKey.get(plan.key);
    if (ready) {
      return {
        ...ready,
        index: plan.index,
        blockStart: plan.blockStart,
        blockEnd: plan.blockEnd,
        charCount: plan.charCount,
      };
    }
    // Repeated text shares one key: it is generated, stored and charged once.
    if (!toGenerateKeys.has(plan.key)) {
      toGenerateKeys.add(plan.key);
      toGenerate.push(plan);
    }
    return {
      index: plan.index,
      key: plan.key,
      blockStart: plan.blockStart,
      blockEnd: plan.blockEnd,
      charCount: plan.charCount,
      status: 'pending',
    };
  });

  const plannedKeys = new Set(planned.map((plan) => plan.key));
  const obsolete = (record?.parts ?? []).filter(
    (part) => !plannedKeys.has(part.key),
  );
  const chargedCharCount = toGenerate.reduce(
    (sum, part) => sum + part.charCount,
    0,
  );

  return {
    parts,
    toGenerate,
    obsolete,
    chargedCharCount,
    creditUnits: narrationCreditUnits(chargedCharCount),
    voiceChanged,
  };
}

/**
 * After an edit: keeps stored parts whose key is still planned, moved to their
 * new index and block range, and returns the rest as dropped.
 */
export function remapNarrationParts(
  stored: NarrationPart[],
  planned: IKeyedNarrationPart[],
): { kept: NarrationPart[]; dropped: NarrationPart[] } {
  const byKey = new Map<string, NarrationPart>();
  for (const part of stored) {
    const existing = byKey.get(part.key);
    if (!existing || (part.status === 'ready' && existing.status !== 'ready')) {
      byKey.set(part.key, part);
    }
  }
  const kept: NarrationPart[] = [];
  for (const plan of planned) {
    const part = byKey.get(plan.key);
    if (part) {
      kept.push({
        ...part,
        index: plan.index,
        blockStart: plan.blockStart,
        blockEnd: plan.blockEnd,
        charCount: plan.charCount,
      });
    }
  }
  const plannedKeys = new Set(planned.map((plan) => plan.key));
  const dropped = stored.filter((part) => !plannedKeys.has(part.key));
  return { kept, dropped };
}
