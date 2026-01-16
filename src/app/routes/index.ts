import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route.js";
import { StudentRoutes } from "../modules/student/student.route.js";


const router = Router()

router.use('/users',UserRoutes);
router.use('/students',StudentRoutes)

export default router;