import { Router } from 'express';
import { UserRoutes } from '../modules/user/user.route.js';
import { StudentRoutes } from '../modules/student/student.route.js';
import { AcademicSemsterRoutes } from '../modules/academicSemester/academicSemester.routes.js';
import { AcademicInstructorRoutes } from '../modules/academicInstructor/academicInstructor.route.js';
import { AcademicDepartmentRoutes } from '../modules/academicDepartment/academicDepartment.route.js';
import { InstructorRoutes } from '../modules/Instructor/Instructor.route.js';
import { AdminRoutes } from '../modules/admin/admin.routes.js';
import { SubjectRoutes } from '../modules/subject/subject.routes.js';
import { semesterRegistrationRoutes } from '../modules/semesterRegistration/semesterRegistration.routes.js';
import { offeredSubjectRoutes } from '../modules/OfferedSubject/OfferedSubject.routes.js';
import { AuthRoutes } from '../modules/Auth/auth.route.js';
import { EnrolledSubjectRoutes } from '../modules/enrolledSubject/enrolledSubject.routes.js';
import { CurriculumRoutes } from '../modules/curriculum/curriculum.routes.js';
import { SemesterEnrollmentRoutes } from '../modules/semesterEnrollment/semesterEnrollment.routes.js';
import { ClassSessionRoutes } from '../modules/classSession/classSession.route.js';
import { StudentAttendanceRoutes } from '../modules/studentAttendance/studentAttendance.route.js';
import { NoticeRoutes } from '../modules/notice/notice.route.js';
import { NotificationRoutes } from '../modules/notification/notification.route.js';

const router = Router();

const moduleRoutes = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/students',
    route: StudentRoutes,
  },
  {
    path: '/instructors',
    route: InstructorRoutes,
  },
  {
    path: '/admins',
    route: AdminRoutes,
  },
  {
    path: '/subjects',
    route: SubjectRoutes,
  },
  {
    path: '/academic-semester',
    route: AcademicSemsterRoutes,
  },
  {
    path: '/academic-instructor',
    route: AcademicInstructorRoutes,
  },
  {
    path: '/academic-department',
    route: AcademicDepartmentRoutes,
  },
    {
    path: '/semester-registrations',
    route: semesterRegistrationRoutes,
  },
  {
    path: '/offered-subject',
    route: offeredSubjectRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/enrolled-subjects',
    route: EnrolledSubjectRoutes,
  },
  {
    path: '/curriculums',
    route: CurriculumRoutes,
  },
  {
    path: '/semester-enrollments',
    route: SemesterEnrollmentRoutes,
  },
  {
    path: '/class-sessions',
    route: ClassSessionRoutes,
  },
  {
    path: '/student-attendance',
    route: StudentAttendanceRoutes,
  },
  {
    path: '/notices',
    route: NoticeRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));


export default router;
