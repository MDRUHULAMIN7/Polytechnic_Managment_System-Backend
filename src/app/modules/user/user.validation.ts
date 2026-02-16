import z from "zod";
import { UserStatus } from "./user.constant.js";


const userValidationSchema = z.object({
    password:z.string().min(6,{message:'Password can not be less than 6 characters'}).max(20,{message:'Password can not be more than 20 characters'}).optional(),
})
const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum([...UserStatus] as [string, ...string[]]),
  }),
});

export const UserValidation = {
  userValidationSchema,
  changeStatusValidationSchema,
};