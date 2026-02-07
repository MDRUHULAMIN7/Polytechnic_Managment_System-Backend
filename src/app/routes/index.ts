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
    path: '/offered-courses',
    route: offeredSubjectRoutes,
  },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

// router.use('/users',UserRoutes);
// router.use('/students',StudentRoutes)

export default router;
