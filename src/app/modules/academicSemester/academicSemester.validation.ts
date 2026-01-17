import z from "zod";
import { AcademicSemesterCodes, AcademicSemesterNames, Months } from "./academicSemester.constant.js";


const createAcademicSemesterValidationSchema = z.object({
    body:z.object({
        name:z.enum([...AcademicSemesterNames]),
        year:z.string(),
        code:z.enum([...AcademicSemesterCodes]),
        startMonth:z.enum([...Months]),
        endMonth:z.enum([...Months]),
    })
})
export const academicSemesterValidationSchema = {
    createAcademicSemesterValidationSchema,
};