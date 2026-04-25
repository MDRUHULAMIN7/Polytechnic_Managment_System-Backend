import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import type {
  TAssessmentBucket,
  TAssessmentComponent,
  TAssessmentComponentType,
  TSubjectMarkingScheme,
} from './subject.interface.js';

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

function sanitizeCodeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
  return assessmentComponents.map((component) => ({
    ...component,
  }));
}

export function cloneMarkingScheme(markingScheme: TSubjectMarkingScheme) {
  return {
    ...markingScheme,
  };
}

export function ensureAssessmentComponentsComplete(
  markingScheme: TSubjectMarkingScheme,
  assessmentComponents: TAssessmentComponent[],
) {
  const normalized = cloneAssessmentComponents(assessmentComponents ?? []).sort(
    (left, right) => left.order - right.order,
  );
  const usedCodes = new Set(normalized.map((component) => component.code));
  let changed = false;
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
