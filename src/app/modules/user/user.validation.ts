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

const updateProfileNameSchema = z
  .object({
    firstName: z.string().trim().min(1).max(20).optional(),
    middleName: z.string().trim().max(20).optional(),
    lastName: z.string().trim().min(1).max(20).optional(),
  })
  .optional();

const updateGuardianSchema = z
  .object({
    fatherName: z.string().trim().min(1).max(20).optional(),
    fatherOccupation: z.string().trim().min(1).optional(),
    fatherContactNo: z.string().trim().min(1).optional(),
    motherName: z.string().trim().min(1).max(20).optional(),
    motherOccupation: z.string().trim().min(1).optional(),
    motherContactNo: z.string().trim().min(1).optional(),
  })
  .optional();

const updateLocalGuardianSchema = z
  .object({
    name: z.string().trim().min(1).max(20).optional(),
    occupation: z.string().trim().min(1).optional(),
    contactNo: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
  })
  .optional();

const selfUpdateProfileValidationSchema = z.object({
  body: z.object({
    profile: z.object({
      name: updateProfileNameSchema,
      designation: z.string().trim().min(1).max(60).optional(),
      gender: z.enum(['male', 'female', 'other', 'others']).optional(),
      dateOfBirth: z.string().optional(),
      contactNo: z.string().trim().min(1).optional(),
      emergencyContactNo: z.string().trim().min(1).optional(),
      bloodGroup: z
        .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
        .optional(),
      bloogGroup: z
        .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
        .optional(),
      presentAddress: z.string().trim().min(1).optional(),
      permanentAddress: z.string().trim().min(1).optional(),
      profileImg: z.string().trim().optional(),
      guardian: updateGuardianSchema,
      localGuardian: updateLocalGuardianSchema,
    }),
  }),
});

export const UserValidation = {
  userValidationSchema,
  changeStatusValidationSchema,
  selfUpdateProfileValidationSchema,
};
