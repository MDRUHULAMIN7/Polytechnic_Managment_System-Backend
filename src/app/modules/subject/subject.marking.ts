import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import type {
  TAssessmentBucket,
  TAssessmentComponent,
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
