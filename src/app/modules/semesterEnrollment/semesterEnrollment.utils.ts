import { Subject } from '../subject/subject.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';

export const getMissingOfferedSubjectReasons = async ({
  subjectIds,
  semesterRegistration,
  academicSemester,
  academicDepartment,
  academicInstructor,
}: {
  subjectIds: string[];
  semesterRegistration: string;
  academicSemester: string;
  academicDepartment: string;
  academicInstructor: string;
}) => {
  const subjectDocs = await Subject.find({
    _id: { $in: subjectIds },
  }).select('_id title');
  
  const offeredSubjectDocs = await OfferedSubject.find({
    subject: { $in: subjectIds },
  }).select(
    'subject semesterRegistration academicSemester academicDepartment academicInstructor maxCapacity',
  );

  const subjectTitleMap = new Map(
    subjectDocs.map((subject) => [subject._id.toString(), subject.title]),
  );
  
  const offeredBySubjectId = new Map<string, (typeof offeredSubjectDocs)>();

  for (const offeredSubjectDoc of offeredSubjectDocs) {
    const bucket = offeredBySubjectId.get(offeredSubjectDoc.subject.toString()) ?? [];
    bucket.push(offeredSubjectDoc);
    offeredBySubjectId.set(offeredSubjectDoc.subject.toString(), bucket);
  }

  const reasons: string[] = [];

  for (const subjectId of subjectIds) {
    const subjectLabel = `${subjectTitleMap.get(subjectId) || 'Subject'} (${subjectId})`;
    const subjectOfferings = offeredBySubjectId.get(subjectId) ?? [];
    const hasAnyOffered = subjectOfferings.length > 0;

    if (!hasAnyOffered) {
      reasons.push(`${subjectLabel}: not offered yet`);
      continue;
    }

    const hasSameSemester = subjectOfferings.some(
      (offeredSubjectDoc) =>
        offeredSubjectDoc.semesterRegistration.toString() === semesterRegistration &&
        offeredSubjectDoc.academicSemester.toString() === academicSemester,
    );

    if (!hasSameSemester) {
      reasons.push(
        `${subjectLabel}: offered but not in this curriculum semester/registration`,
      );
      continue;
    }

    const hasDepartmentInstructorMatch = subjectOfferings.some(
      (offeredSubjectDoc) =>
        offeredSubjectDoc.semesterRegistration.toString() === semesterRegistration &&
        offeredSubjectDoc.academicSemester.toString() === academicSemester &&
        offeredSubjectDoc.academicDepartment.toString() === academicDepartment &&
        offeredSubjectDoc.academicInstructor.toString() === academicInstructor,
    );

    if (!hasDepartmentInstructorMatch) {
      reasons.push(
        `${subjectLabel}: offered but does not match your department/instructor`,
      );
      continue;
    }

    const hasSeat = subjectOfferings.some(
      (offeredSubjectDoc) =>
        offeredSubjectDoc.semesterRegistration.toString() === semesterRegistration &&
        offeredSubjectDoc.academicSemester.toString() === academicSemester &&
        offeredSubjectDoc.academicDepartment.toString() === academicDepartment &&
        offeredSubjectDoc.academicInstructor.toString() === academicInstructor &&
        offeredSubjectDoc.maxCapacity > 0,
    );

    if (!hasSeat) {
      reasons.push(`${subjectLabel}: seat full (maxCapacity = 0)`);
      continue;
    }

    reasons.push(`${subjectLabel}: offered subject resolution failed`);
  }

  return reasons;
};
