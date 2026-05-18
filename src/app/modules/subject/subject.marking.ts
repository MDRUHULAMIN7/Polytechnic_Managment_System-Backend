import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
} from './subject.constant.js';
import type {
  TAssessmentBucket,
  TAssessmentComponent,
  TAssessmentComponentType,
  TSubjectMarkingScheme,
} from './subject.interface.js';

const BUCKET_TO_SCHEME_KEY: Record<
  TAssessmentBucket,
  keyof TSubjectMarkingScheme
> = {
  THEORY_CONTINUOUS: 'theoryContinuous',
  THEORY_FINAL: 'theoryFinal',
  PRACTICAL_CONTINUOUS: 'practicalContinuous',
  PRACTICAL_FINAL: 'practicalFinal',
};

const FALLBACK_BUCKET_META: Record<
  TAssessmentBucket,
  {
    codePrefix: string;
    title: string;
    componentType: TAssessmentComponentType;
  }
> = {
  THEORY_CONTINUOUS: {
    codePrefix: 'theory_continuous',
    title: 'Theory Continuous',
    componentType: 'teacher_assessment',
  },
  THEORY_FINAL: {
    codePrefix: 'theory_final',
    title: 'Theory Final',
    componentType: 'written_exam',
  },
  PRACTICAL_CONTINUOUS: {
    codePrefix: 'practical_continuous',
    title: 'Practical Continuous',
    componentType: 'lab_performance',
  },
  PRACTICAL_FINAL: {
    codePrefix: 'practical_final',
    title: 'Practical Final',
    componentType: 'practical_exam',
  },
};

const BUCKET_BY_COMPONENT_TYPE: Record<
  TAssessmentComponentType,
  TAssessmentBucket
> = {
  class_test: 'THEORY_CONTINUOUS',
  attendance: 'THEORY_CONTINUOUS',
  assignment: 'THEORY_CONTINUOUS',
  presentation: 'THEORY_CONTINUOUS',
  teacher_assessment: 'THEORY_CONTINUOUS',
  written_exam: 'THEORY_FINAL',
  lab_performance: 'PRACTICAL_CONTINUOUS',
  lab_report: 'PRACTICAL_CONTINUOUS',
  viva: 'PRACTICAL_FINAL',
  practical_exam: 'PRACTICAL_FINAL',
  project_review: 'PRACTICAL_FINAL',
  industry_evaluation: 'PRACTICAL_FINAL',
};

function isAssessmentBucket(value: unknown): value is TAssessmentBucket {
  return (
    typeof value === 'string' &&
    (AssessmentBuckets as readonly string[]).includes(value)
  );
}

function isAssessmentComponentType(
  value: unknown,
): value is TAssessmentComponentType {
  return (
    typeof value === 'string' &&
    (AssessmentComponentTypes as readonly string[]).includes(value)
  );
}

/**
 * Resolves the appropriate bucket for an assessment component based on its title or type.
 */
function resolveComponentBucket(
  component: Partial<TAssessmentComponent>,
): TAssessmentBucket {
  if (isAssessmentBucket(component.bucket)) {
    return component.bucket;
  }

  if (isAssessmentComponentType(component.componentType)) {
    return BUCKET_BY_COMPONENT_TYPE[component.componentType];
  }

  const normalizedTitle = component.title?.trim().toLowerCase() || '';
  const hasPracticalHint =
    normalizedTitle.includes('practical') || normalizedTitle.includes('lab');
  const hasFinalHint =
    normalizedTitle.includes('final') ||
    normalizedTitle.includes('written') ||
    normalizedTitle.includes('exam');

  if (hasPracticalHint && hasFinalHint) return 'PRACTICAL_FINAL';
  if (hasPracticalHint) return 'PRACTICAL_CONTINUOUS';
  if (hasFinalHint) return 'THEORY_FINAL';

  return 'THEORY_CONTINUOUS';
}

/**
 * Internal helper to normalize assessment components fields without strict bucket total validation.
 */
function normalizeComponentsBasic(
  components: TAssessmentComponent[],
): TAssessmentComponent[] {
  return (components || []).map((comp, index) => {
    const bucket = resolveComponentBucket(comp);
    return {
      ...comp,
      bucket,
      fullMarks: Number(comp.fullMarks || 0),
      title: comp.title?.trim() || '',
      code:
        comp.code?.trim() ||
        `${FALLBACK_BUCKET_META[bucket].codePrefix}_${index + 1}`,
      order: Number(comp.order || index + 1),
      isRequired: comp.isRequired ?? true,
    };
  });
}

/**
 * Normalizes and validates the marking payload for a subject.
 * Ensures that component totals match scheme bucket totals.
 */
export const normalizeMarkingPayload = (payload: {
  markingScheme: TSubjectMarkingScheme;
  assessmentComponents: TAssessmentComponent[];
}) => {
  const { markingScheme, assessmentComponents } = payload;

  // 1. Basic Type Conversions & Validation
  const normalizedScheme: TSubjectMarkingScheme = {
    theoryContinuous: Number(markingScheme.theoryContinuous || 0),
    theoryFinal: Number(markingScheme.theoryFinal || 0),
    practicalContinuous: Number(markingScheme.practicalContinuous || 0),
    practicalFinal: Number(markingScheme.practicalFinal || 0),
    totalMarks: Number(markingScheme.totalMarks || 0),
  };

  const schemeSum =
    normalizedScheme.theoryContinuous +
    normalizedScheme.theoryFinal +
    normalizedScheme.practicalContinuous +
    normalizedScheme.practicalFinal;

  if (schemeSum !== normalizedScheme.totalMarks) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Marking scheme total must equal the sum of all buckets.',
    );
  }

  if (!assessmentComponents?.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one assessment component is required.',
    );
  }

  // 2. Normalize Components
  const normalizedComponents = normalizeComponentsBasic(assessmentComponents);

  // 3. Verify that each bucket total matches the scheme
  const bucketTotals: Record<TAssessmentBucket, number> = {
    THEORY_CONTINUOUS: 0,
    THEORY_FINAL: 0,
    PRACTICAL_CONTINUOUS: 0,
    PRACTICAL_FINAL: 0,
  };

  normalizedComponents.forEach((comp) => {
    bucketTotals[comp.bucket] += comp.fullMarks;
  });

  for (const [bucket, total] of Object.entries(bucketTotals) as [
    TAssessmentBucket,
    number,
  ][]) {
    const schemeKey = BUCKET_TO_SCHEME_KEY[bucket];
    if (normalizedScheme[schemeKey] !== total) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `${bucket.replace(
          '_',
          ' ',
        )} total (${total}) does not match scheme (${
          normalizedScheme[schemeKey]
        }).`,
      );
    }
  }

  return {
    markingScheme: normalizedScheme,
    assessmentComponents: normalizedComponents.sort(
      (a, b) => a.order - b.order,
    ),
  };
};

/**
 * Creates plain objects for assessment components, handling Mongoose documents if present.
 */
export function cloneAssessmentComponents(
  assessmentComponents: TAssessmentComponent[],
) {
  return (assessmentComponents ?? []).map((component) => {
    if (component && typeof component === 'object' && 'toObject' in component) {
      return (component as any).toObject();
    }
    return { ...component };
  });
}

/**
 * Creates plain objects for marking scheme, handling Mongoose documents if present.
 */
export function cloneMarkingScheme(markingScheme: TSubjectMarkingScheme) {
  if (
    markingScheme &&
    typeof markingScheme === 'object' &&
    'toObject' in markingScheme
  ) {
    return (markingScheme as any).toObject();
  }
  return { ...markingScheme };
}

/**
 * Ensures that all buckets defined in the marking scheme have corresponding assessment components.
 * Auto-generates missing components if necessary.
 */
export function ensureAssessmentComponentsComplete(
  markingScheme: TSubjectMarkingScheme,
  assessmentComponents: TAssessmentComponent[],
) {
  const normalized = normalizeComponentsBasic(
    cloneAssessmentComponents(
      assessmentComponents ?? [],
    ) as TAssessmentComponent[],
  ).sort((left, right) => left.order - right.order);

  const usedCodes = new Set(normalized.map((component) => component.code));
  let changed = false;
  let nextOrder =
    normalized.reduce(
      (maxOrder, component) => Math.max(maxOrder, component.order),
      0,
    ) + 1;

  for (const bucket of AssessmentBuckets) {
    const schemeKey = BUCKET_TO_SCHEME_KEY[bucket];
    const expectedMarks = Number(markingScheme?.[schemeKey] ?? 0);

    if (expectedMarks <= 0) continue;

    const currentTotal = normalized
      .filter((component) => component.bucket === bucket)
      .reduce((sum, component) => sum + Number(component.fullMarks ?? 0), 0);

    if (currentTotal >= expectedMarks) continue;

    changed = true;
    const fallback = FALLBACK_BUCKET_META[bucket];
    const missingMarks = expectedMarks - currentTotal;
    let code = `${fallback.codePrefix}_auto`;
    let suffix = 1;

    while (usedCodes.has(code)) {
      suffix += 1;
      code = `${fallback.codePrefix}_auto_${suffix}`;
    }

    usedCodes.add(code);
    normalized.push({
      code,
      title: currentTotal > 0 ? `${fallback.title} Additional` : fallback.title,
      bucket,
      componentType: fallback.componentType,
      fullMarks: missingMarks,
      order: nextOrder,
      isRequired: true,
    });
    nextOrder += 1;
  }

  const nextComponents = normalized
    .sort((left, right) => left.order - right.order)
    .map((component, index) => ({
      ...component,
      order: index + 1,
    }));

  return {
    assessmentComponents: nextComponents,
    changed: changed || nextComponents.length !== assessmentComponents?.length,
  };
}
