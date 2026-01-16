import z from "zod";


const userZodValidationSchema = z.object({
    password:z.string().min(6,{message:'Password can not be less than 6 characters'}).max(20,{message:'Password can not be more than 20 characters'}).optional(),
})
export default userZodValidationSchema;