import { z } from 'zod';
const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const userNameZodValidationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First Name is Required')
    .max(20, 'First Name cannot be more than 20 characters')
    .refine((value) => value === capitalize(value), {
      message: 'First Name must start with a capital letter',
    }),

  middleName: z
    .string()
    .trim()
    .max(20, 'Middle Name cannot be more than 20 characters')
    .optional(),

  lastName: z
    .string()
    .trim()
    .min(1, 'Last Name is Required')
    .max(20, 'Last Name cannot be more than 20 characters')
    .regex(/^[A-Za-z]+$/, 'Last Name must contain only letters'),
});

const guardianZodValidationSchema = z.object({
  fatherName: z
    .string()
    .trim()
    .min(1, 'Father Name is Required')
    .max(20, 'Name cannot be more than 20 characters'),

  fatherOccupation: z.string().min(1, 'Father Occupation is Required'),

  fatherContactNo: z.string().min(1, 'Father Contact Number is Required'),

  motherName: z
    .string()
    .trim()
    .min(1, 'Mother Name is Required')
    .max(20, 'Name cannot be more than 20 characters'),

  motherOccupation: z.string().min(1, 'Mother Occupation is Required'),

  motherContactNo: z.string().min(1, 'Mother Contact Number is Required'),
});

const localGuardianZodValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Local Guardian Name is Required')
    .max(20, 'Name cannot be more than 20 characters'),

  occupation: z.string().min(1, 'Local Guardian Occupation is Required'),

  contactNo: z.string().min(1, 'Local Guardian Contact Number is Required'),

  address: z.string().min(1, 'Local Guardian Address is Required'),
});

const studentZodValidationSchema = z.object({
  id: z.string().min(1, 'Student ID is Required'),

  name: userNameZodValidationSchema,

  gender: z.enum(['male', 'female', 'others']),

  dateOfBirth: z.string().optional(),

  email: z.string().email('Email is not valid'),

  contactNo: z.string().min(1, 'Contact Number is Required'),

  emergencyContactNo: z.string().min(1, 'Emergency Contact Number is Required'),

  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .optional(),

  presentAddress: z.string().min(1, 'Present Address is Required'),

  permanentAddress: z.string().min(1, 'Permanent Address is Required'),

  guardian: guardianZodValidationSchema,

  localGuardian: localGuardianZodValidationSchema,

  profileImg: z.string().optional(),

  isActive: z.enum(['active', 'blocked']),
});

export default studentZodValidationSchema;
