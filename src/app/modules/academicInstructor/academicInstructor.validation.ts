import z from 'zod';

const academicInstructorValidationSchema = z.object({
  name: z.string(),
});
export default academicInstructorValidationSchema;
