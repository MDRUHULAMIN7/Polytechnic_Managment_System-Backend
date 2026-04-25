import { Types } from 'mongoose';
import type { TOfferedSubject } from '../OfferedSubject/OfferedSubject.interface.js';
import type {
  TEnrolledSubjectAuditLog,
  TEnrolledSubjectMarkEntry,
  TEnrolledSubjectMarkSummary,
  TEnrolledSubjectResultStatus,
} from './enrolledSubject.interface.js';
import { ensureAssessmentComponentsComplete } from '../subject/subject.marking.js';

export const DEFAULT_MARK_SUMMARY: TEnrolledSubjectMarkSummary = {
  theoryContinuous: 0,
  theoryFinal: 0,
  practicalContinuous: 0,
  practicalFinal: 0,
  releasedTheoryContinuous: 0,
  releasedTheoryFinal: 0,
  releasedPracticalContinuous: 0,
  releasedPracticalFinal: 0,
  total: 0,
  releasedTotal: 0,
  totalMarks: 0,
  percentage: 0,
  releasedPercentage: 0,
  releasedMarks: 0,
};

export const calculateGradeAndPoints = (
  obtainedMarks: number,
  totalSubjectMarks: number,
) => {
  let result = {
    grade: 'NA',
    gradePoints: 0,
  };

  if (
    totalSubjectMarks <= 0 ||
    obtainedMarks < 0 ||
    obtainedMarks > totalSubjectMarks
  ) {
    return result;
  }

  const percentage = (obtainedMarks / totalSubjectMarks) * 100;

  if (percentage < 40) {
    result = {
      grade: 'F',
      gradePoints: 0.0,
    };
  } else if (percentage < 50) {
    result = {
      grade: 'D',
      gradePoints: 2.0,
    };
  } else if (percentage < 60) {
    result = {
      grade: 'C',
      gradePoints: 3.0,
    };
  } else if (percentage < 80) {
    result = {
      grade: 'B',
      gradePoints: 3.5,
    };
  } else if (percentage <= 100) {
    result = {
      grade: 'A',
      gradePoints: 4.0,
    };
  }

  return result;
};

export function initializeMarkEntriesFromOfferedSubject(
  offeredSubject: Pick<
    TOfferedSubject,
    'assessmentComponentsSnapshot' | 'markingSchemeSnapshot'
  >,
): TEnrolledSubjectMarkEntry[] {
  const repairedComponents = ensureAssessmentComponentsComplete(
    offeredSubject.markingSchemeSnapshot,
    offeredSubject.assessmentComponentsSnapshot ?? [],
  ).assessmentComponents;

  return repairedComponents.map((component) => ({
    componentCode: component.code,
    componentTitle: component.title,
    bucket: component.bucket,
    componentType: component.componentType,
    fullMarks: component.fullMarks,
    order: component.order,
    isRequired: component.isRequired,
    obtainedMarks: null,
    isReleased: false,
    releasedAt: null,
    remarks: '',
    lastUpdatedAt: null,
    lastUpdatedBy: null,
  }));
}

export function syncMarkEntriesWithOfferedSubject(
  markEntries: TEnrolledSubjectMarkEntry[],
  offeredSubject: Pick<
    TOfferedSubject,
    'assessmentComponentsSnapshot' | 'markingSchemeSnapshot'
  >,
) {
  const repairedComponents = ensureAssessmentComponentsComplete(
    offeredSubject.markingSchemeSnapshot,
    offeredSubject.assessmentComponentsSnapshot ?? [],
  ).assessmentComponents;
  const existingEntryMap = new Map(
    (markEntries ?? []).map((entry) => [entry.componentCode, entry]),
  );

  let changed = false;

  const nextEntries = repairedComponents.map((component) => {
    const existingEntry = existingEntryMap.get(component.code);

    if (!existingEntry) {
      changed = true;
      return {
        componentCode: component.code,
        componentTitle: component.title,
        bucket: component.bucket,
        componentType: component.componentType,
        fullMarks: component.fullMarks,
        order: component.order,
        isRequired: component.isRequired,
        obtainedMarks: null,
        isReleased: false,
        releasedAt: null,
        remarks: '',
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      };
    }

    if (
      existingEntry.componentTitle !== component.title ||
      existingEntry.bucket !== component.bucket ||
      existingEntry.componentType !== component.componentType ||
      existingEntry.fullMarks !== component.fullMarks ||
      existingEntry.order !== component.order ||
      existingEntry.isRequired !== component.isRequired
    ) {
      changed = true;
    }

    return {
      ...existingEntry,
      componentTitle: component.title,
      bucket: component.bucket,
      componentType: component.componentType,
      fullMarks: component.fullMarks,
      order: component.order,
      isRequired: component.isRequired,
    };
  });

  if ((markEntries ?? []).length !== nextEntries.length) {
    changed = true;
  }

  return {
    markEntries: nextEntries,
    changed,
  };
}

export function buildEnrolledSubjectSeed(input: {
  offeredSubject: Pick<
    TOfferedSubject,
    | 'semesterRegistration'
    | 'academicSemester'
    | 'academicInstructor'
    | 'academicDepartment'
    | 'subject'
    | 'instructor'
    | 'markingSchemeSnapshot'
    | 'assessmentComponentsSnapshot'
  > & { _id: Types.ObjectId };
  student: Types.ObjectId;
}) {
  const { offeredSubject, student } = input;
  const markEntries = initializeMarkEntriesFromOfferedSubject(offeredSubject);
  const markSummary = calculateMarkSummary(
    markEntries,
    offeredSubject.markingSchemeSnapshot.totalMarks,
  );

  return {
    semesterRegistration: offeredSubject.semesterRegistration,
    academicSemester: offeredSubject.academicSemester,
    academicInstructor: offeredSubject.academicInstructor,
    academicDepartment: offeredSubject.academicDepartment,
    offeredSubject: offeredSubject._id,
    subject: offeredSubject.subject,
    student,
    instructor: offeredSubject.instructor,
    isEnrolled: true,
    markingSchemeSnapshot: offeredSubject.markingSchemeSnapshot,
    markEntries,
    markSummary,
    auditLogs: [],
    resultStatus: 'IN_PROGRESS' as const,
    grade: 'NA' as const,
    gradePoints: 0,
    finalResultPublishedAt: null,
    isCompleted: false,
  };
}

export function calculateMarkSummary(
  markEntries: TEnrolledSubjectMarkEntry[],
  totalMarks: number,
): TEnrolledSubjectMarkSummary {
  const summary = { ...DEFAULT_MARK_SUMMARY, totalMarks };

  for (const entry of markEntries) {
    const obtained = entry.obtainedMarks ?? 0;

    switch (entry.bucket) {
      case 'THEORY_CONTINUOUS':
        summary.theoryContinuous += obtained;
        if (entry.isReleased) summary.releasedTheoryContinuous += obtained;
        break;
      case 'THEORY_FINAL':
        summary.theoryFinal += obtained;
        if (entry.isReleased) summary.releasedTheoryFinal += obtained;
        break;
      case 'PRACTICAL_CONTINUOUS':
        summary.practicalContinuous += obtained;
        if (entry.isReleased) summary.releasedPracticalContinuous += obtained;
        break;
      case 'PRACTICAL_FINAL':
        summary.practicalFinal += obtained;
        if (entry.isReleased) summary.releasedPracticalFinal += obtained;
        break;
      default:
        break;
    }

    if (entry.isReleased) {
      summary.releasedMarks += entry.fullMarks;
    }
  }

  summary.total =
    summary.theoryContinuous +
    summary.theoryFinal +
    summary.practicalContinuous +
    summary.practicalFinal;
  summary.releasedTotal =
    summary.releasedTheoryContinuous +
    summary.releasedTheoryFinal +
    summary.releasedPracticalContinuous +
    summary.releasedPracticalFinal;
  summary.percentage = totalMarks > 0 ? (summary.total / totalMarks) * 100 : 0;
  summary.releasedPercentage =
    summary.releasedMarks > 0
      ? (summary.releasedTotal / summary.releasedMarks) * 100
      : 0;

  return summary;
}

export function determineResultStatus(
  markEntries: TEnrolledSubjectMarkEntry[],
  finalResultPublishedAt?: Date | null,
): TEnrolledSubjectResultStatus {
  if (finalResultPublishedAt) {
    return 'FINAL_PUBLISHED';
  }

  const requiredEntries = markEntries.filter((entry) => entry.isRequired);
  const allRequiredEntered = requiredEntries.every(
    (entry) => entry.obtainedMarks !== null,
  );
  const anyReleased = markEntries.some((entry) => entry.isReleased);

  if (allRequiredEntered) {
    return 'FINAL_READY';
  }

  if (anyReleased) {
    return 'PARTIAL_RELEASED';
  }

  return 'IN_PROGRESS';
}

export function appendAuditLogs(
  auditLogs: TEnrolledSubjectAuditLog[],
  newLogs: TEnrolledSubjectAuditLog[],
) {
  const combined = [...auditLogs, ...newLogs];
  return combined.slice(-200);
}

export function getReleasedMarkEntries(
  markEntries: TEnrolledSubjectMarkEntry[],
) {
  return markEntries.filter((entry) => entry.isReleased);
}
