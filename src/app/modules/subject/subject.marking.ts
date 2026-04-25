import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import type {
  TAssessmentBucket,
  TAssessmentComponent,
  TAssessmentComponentType,
  TSubjectMarkingScheme,
} from './subject.interface.js';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
} from './subject.constant.js';

type TMarkingPayload = {
  markingScheme: TSubjectMarkingScheme;
  assessmentComponents: TAssessmentComponent[];
};

const bucketToSchemeKey: Record<
  TAssessmentBucket,
  keyof TSubjectMarkingScheme
> = {
  THEORY_CONTINUOUS: 'theoryContinuous',
  THEORY_FINAL: 'theoryFinal',
  PRACTICAL_CONTINUOUS: 'practicalContinuous',
  PRACTICAL_FINAL: 'practicalFinal',
};

const fallbackBucketMeta: Record<
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

const bucketByComponentType: Record<
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

function sanitizeCodeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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

function guessBucketFromText(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  const hasPracticalHint =
    normalizedValue.includes('practical') || normalizedValue.includes('lab');
  const hasFinalHint =
    normalizedValue.includes('final') ||
    normalizedValue.includes('written') ||
    normalizedValue.includes('exam');

  if (hasPracticalHint && hasFinalHint) {
    return 'PRACTICAL_FINAL' as const;
  }

  if (hasPracticalHint) {
    return 'PRACTICAL_CONTINUOUS' as const;
  }

  if (hasFinalHint) {
    return 'THEORY_FINAL' as const;
  }

  return 'THEORY_CONTINUOUS' as const;
}

function resolveComponentBucket(
  component: Partial<TAssessmentComponent>,
): TAssessmentBucket {
  if (isAssessmentBucket(component.bucket)) {
    return component.bucket;
  }

  if (isAssessmentComponentType(component.componentType)) {
    return bucketByComponentType[component.componentType];
  }

  return (
    guessBucketFromText(component.title) ??
    guessBucketFromText(component.code) ??
    'THEORY_CONTINUOUS'
  );
}

function normalizeSingleAssessmentComponent(
  component: Partial<TAssessmentComponent>,
  index: number,
): TAssessmentComponent {
  const bucket = resolveComponentBucket(component);
  const fallback = fallbackBucketMeta[bucket];
  const title = component.title?.trim() || `${fallback.title} ${index + 1}`;
  const code =
    component.code?.trim() ||
    `${fallback.codePrefix}_${sanitizeCodeSegment(title) || index + 1}`;
  const fullMarks = Number(component.fullMarks ?? 0);
  const order = Number(component.order ?? index + 1);

  return {
    code,
    title,
    bucket,
    componentType: isAssessmentComponentType(component.componentType)
      ? component.componentType
      : fallback.componentType,
    fullMarks: Number.isFinite(fullMarks) && fullMarks >= 0 ? fullMarks : 0,
    order: Number.isFinite(order) && order > 0 ? order : index + 1,
    isRequired: component.isRequired ?? true,
  };
}

export function normalizeMarkingPayload({
  markingScheme,
  assessmentComponents,
}: TMarkingPayload): TMarkingPayload {
  const normalizedMarkingScheme: TSubjectMarkingScheme = {
    theoryContinuous: Number(markingScheme?.theoryContinuous ?? 0),
    theoryFinal: Number(markingScheme?.theoryFinal ?? 0),
    practicalContinuous: Number(markingScheme?.practicalContinuous ?? 0),
    practicalFinal: Number(markingScheme?.practicalFinal ?? 0),
    totalMarks: Number(markingScheme?.totalMarks ?? 0),
  };

  const expectedTotal =
    normalizedMarkingScheme.theoryContinuous +
    normalizedMarkingScheme.theoryFinal +
    normalizedMarkingScheme.practicalContinuous +
    normalizedMarkingScheme.practicalFinal;

  if (expectedTotal !== normalizedMarkingScheme.totalMarks) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Marking scheme total must equal the sum of all assessment buckets.',
    );
  }

  if (!assessmentComponents?.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one assessment component is required.',
    );
  }

  const bucketTotals: Record<TAssessmentBucket, number> = {
    THEORY_CONTINUOUS: 0,
    THEORY_FINAL: 0,
    PRACTICAL_CONTINUOUS: 0,
    PRACTICAL_FINAL: 0,
  };

  const usedCodes = new Set<string>();

  const normalizedComponents = assessmentComponents.map((component, index) => {
    const generatedCode =
      component.code?.trim() ||
      `${sanitizeCodeSegment(component.bucket)}_${sanitizeCodeSegment(
        component.title,
      )}_${index + 1}`;

    if (usedCodes.has(generatedCode)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Duplicate assessment component code: ${generatedCode}`,
      );
    }

    usedCodes.add(generatedCode);

    const normalizedComponent: TAssessmentComponent = {
      code: generatedCode,
      title: component.title.trim(),
      bucket: component.bucket,
      componentType: component.componentType,
      fullMarks: Number(component.fullMarks ?? 0),
      order: Number(component.order ?? index + 1),
      isRequired: component.isRequired ?? true,
    };

    bucketTotals[normalizedComponent.bucket] += normalizedComponent.fullMarks;

    return normalizedComponent;
  });

  for (const [bucket, total] of Object.entries(bucketTotals) as [
    TAssessmentBucket,
    number,
  ][]) {
    const schemeKey = bucketToSchemeKey[bucket];
    if (normalizedMarkingScheme[schemeKey] !== total) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `${bucket} component marks must equal ${schemeKey} in the marking scheme.`,
      );
    }
  }

  return {
    markingScheme: normalizedMarkingScheme,
    assessmentComponents: normalizedComponents,
  };
}

export function cloneAssessmentComponents(
  assessmentComponents: TAssessmentComponent[],
) {
  return (assessmentComponents ?? []).map((component) => {
    if (component && typeof component === 'object' && 'toObject' in component) {
      const plainComponent = (
        component as TAssessmentComponent & {
          toObject?: () => TAssessmentComponent;
        }
      ).toObject?.();

      if (plainComponent) {
        return {
          ...plainComponent,
        };
      }
    }

    return {
      ...component,
    };
  });
}

export function cloneMarkingScheme(markingScheme: TSubjectMarkingScheme) {
  if (markingScheme && typeof markingScheme === 'object' && 'toObject' in markingScheme) {
    const plainMarkingScheme = (
      markingScheme as TSubjectMarkingScheme & {
        toObject?: () => TSubjectMarkingScheme;
      }
    ).toObject?.();

    if (plainMarkingScheme) {
      return {
        ...plainMarkingScheme,
      };
    }
  }

  return {
    ...markingScheme,
  };
}

export function ensureAssessmentComponentsComplete(
  markingScheme: TSubjectMarkingScheme,
  assessmentComponents: TAssessmentComponent[],
) {
  const normalized = cloneAssessmentComponents(assessmentComponents ?? [])
    .map((component, index) =>
      normalizeSingleAssessmentComponent(
        component as Partial<TAssessmentComponent>,
        index,
      ),
    )
    .sort((left, right) => left.order - right.order);
  const usedCodes = new Set(normalized.map((component) => component.code));
  let changed = normalized.some((component, index) => {
    const originalComponent = assessmentComponents?.[index] as
      | Partial<TAssessmentComponent>
      | undefined;

    return (
      component.code !== originalComponent?.code ||
      component.title !== originalComponent?.title ||
      component.bucket !== originalComponent?.bucket ||
      component.componentType !== originalComponent?.componentType ||
      component.fullMarks !== Number(originalComponent?.fullMarks ?? 0) ||
      component.order !== Number(originalComponent?.order ?? index + 1) ||
      component.isRequired !== (originalComponent?.isRequired ?? true)
    );
  });
  let nextOrder =
    normalized.reduce((maxOrder, component) => Math.max(maxOrder, component.order), 0) + 1;

  for (const bucket of Object.keys(bucketToSchemeKey) as TAssessmentBucket[]) {
    const schemeKey = bucketToSchemeKey[bucket];
    const expectedMarks = Number(markingScheme?.[schemeKey] ?? 0);

    if (expectedMarks <= 0) {
      continue;
    }

    const currentTotal = normalized
      .filter((component) => component.bucket === bucket)
      .reduce((sum, component) => sum + Number(component.fullMarks ?? 0), 0);

    if (currentTotal >= expectedMarks) {
      continue;
    }

    changed = true;

    const fallback = fallbackBucketMeta[bucket];
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
      title:
        currentTotal > 0 ? `${fallback.title} Additional` : fallback.title,
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
    changed,
  };
}
