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
const updateAcademicSemesterValidationSchema = z.object({
  body: z.object({
    name: z.enum([...AcademicSemesterNames] as [string, ...string[]]).optional(),
    year: z.string().optional(),
    code: z.enum([...AcademicSemesterCodes] as [string, ...string[]]).optional(),
    startMonth: z.enum([...Months] as [string, ...string[]]).optional(),
    endMonth: z.enum([...Months] as [string, ...string[]]).optional(),
  }),
});
export const academicSemesterValidationSchema = {
    createAcademicSemesterValidationSchema,
    updateAcademicSemesterValidationSchema,
};