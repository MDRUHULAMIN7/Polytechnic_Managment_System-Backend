import Joi from "Joi";

   const capitalizeValidator = (value: string, helpers: Joi.CustomHelpers) => {
      const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
      if (value !== capitalized) {
        return helpers.message({ custom: 'must start with a capital letter' });
      }
      return value;
    };

    const userNameJoiValidationSchema = Joi.object({
      firstName: Joi.string()
        .trim()
        .max(20)
        .required()
        .custom(capitalizeValidator)
        .messages({
          'string.empty': 'First Name is Required',
          'string.max': 'First Name cannot be more than 20 characters',
        }),

      middleName: Joi.string().trim().max(20).optional().messages({
        'string.max': 'Middle Name cannot be more than 20 characters',
      }),

      lastName: Joi.string()
        .trim()
        .max(20)
        .pattern(/^[A-Za-z]+$/)
        .required()
        .messages({
          'string.empty': 'Last Name is Required',
          'string.pattern.base': 'Last Name must contain only letters',
          'string.max': 'Last Name cannot be more than 20 characters',
        }),
    });

    const guardianJoiValidationSchema = Joi.object({
      fatherName: Joi.string().trim().max(20).required().messages({
        'string.empty': 'Father Name is Required',
        'string.max': 'Name cannot be more than 20 characters',
      }),

      fatherOccupation: Joi.string().required().messages({
        'string.empty': 'Father Occupation is Required',
      }),

      fatherContactNo: Joi.string().required().messages({
        'string.empty': 'Father Contact Number is Required',
      }),

      motherName: Joi.string().trim().max(20).required().messages({
        'string.empty': 'Mother Name is Required',
        'string.max': 'Name cannot be more than 20 characters',
      }),

      motherOccupation: Joi.string().required().messages({
        'string.empty': 'Mother Occupation is Required',
      }),

      motherContactNo: Joi.string().required().messages({
        'string.empty': 'Mother Contact Number is Required',
      }),
    });

    const localGuardianJoiValidationSchema = Joi.object({
      name: Joi.string().trim().max(20).required().messages({
        'string.empty': 'Local Guardian Name is Required',
        'string.max': 'Name cannot be more than 20 characters',
      }),

      occupation: Joi.string().required().messages({
        'string.empty': 'Local Guardian Occupation is Required',
      }),

      contactNo: Joi.string().required().messages({
        'string.empty': 'Local Guardian Contact Number is Required',
      }),

      address: Joi.string().required().messages({
        'string.empty': 'Local Guardian Address is Required',
      }),
    });

   const studentJoiValidationSchema = Joi.object({
      id: Joi.string().required().messages({
        'string.empty': 'Student ID is Required',
      }),

      name: userNameJoiValidationSchema.required().messages({
        'any.required': 'Student Name is Required',
      }),

      gender: Joi.string()
        .valid('male', 'female', 'others')
        .required()
        .messages({
          'any.only': "Gender must be one of 'male', 'female', or 'others'",
          'string.empty': 'Gender is Required',
        }),

      dateOfBirth: Joi.string().optional(),

      email: Joi.string().email().required().messages({
        'string.email': 'Email is not valid',
        'string.empty': 'Email is Required',
      }),

      contactNo: Joi.string().required().messages({
        'string.empty': 'Contact Number is Required',
      }),

      emergencyContactNo: Joi.string().required().messages({
        'string.empty': 'Emergency Contact Number is Required',
      }),

      bloodGroup: Joi.string()
        .valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
        .optional(),

      presentAddress: Joi.string().required().messages({
        'string.empty': 'Present Address is Required',
      }),

      permanentAddress: Joi.string().required().messages({
        'string.empty': 'Permanent Address is Required',
      }),

      guardian: guardianJoiValidationSchema.required().messages({
        'any.required': 'Guardian Information is Required',
      }),

      localGuardian: localGuardianJoiValidationSchema.required().messages({
        'any.required': 'Local Guardian Information is Required',
      }),

      profileImg: Joi.string().optional(),

      isActive: Joi.string().valid('active', 'blocked').optional(),
    });
export default studentJoiValidationSchema;