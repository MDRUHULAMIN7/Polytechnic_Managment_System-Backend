import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route.js";
import { StudentRoutes } from "../modules/student/student.route.js";
import { AcademicSemsterRoutes } from "../modules/academicSemester/academicSemester.routes.js";
import { AcademicInstructorRoutes } from "../modules/academicInstructor/academicInstructor.route.js";


const router = Router()

const moduleRoutes = [
    {
        path:"/users",
        route:UserRoutes
    },
    {
        path:"/students",
        route:StudentRoutes
    },
    {
        path:"/academic-semester",
        route:AcademicSemsterRoutes
    },
    {
        path:"/academic-instructor",
        route:AcademicInstructorRoutes
    },
]
         moduleRoutes.forEach(route => router.use(route.path,route.route))
         
// router.use('/users',UserRoutes);
// router.use('/students',StudentRoutes)

export default router;