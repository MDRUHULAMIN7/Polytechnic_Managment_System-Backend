import { z } from 'zod';

const requiredPositiveInteger = (fieldName: string) =>
  z
    .number({
      error: `${fieldName} must be a valid number.`,
    })
    .int(`${fieldName} must be a whole number.`)
    .positive(`${fieldName} must be greater than 0.`);

const createRoomValidationSchema = z.object({
  body: z.object({
    roomName: z.string().trim().min(1, 'Room name is required.'),
    roomNumber: requiredPositiveInteger('Room number'),
    buildingNumber: requiredPositiveInteger('Building number'),
    capacity: requiredPositiveInteger('Capacity'),
    floor: z
      .number({
        error: 'Floor must be a valid number.',
      })
      .int('Floor must be a whole number.')
      .min(0, 'Floor can not be negative.')
      .optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateRoomValidationSchema = z.object({
  body: z.object({
    roomName: z.string().trim().min(1, 'Room name is required.').optional(),
    roomNumber: requiredPositiveInteger('Room number').optional(),
    buildingNumber: requiredPositiveInteger('Building number').optional(),
    capacity: requiredPositiveInteger('Capacity').optional(),
    floor: z
      .number({
        error: 'Floor must be a valid number.',
      })
      .int('Floor must be a whole number.')
      .min(0, 'Floor can not be negative.')
      .optional(),
    isActive: z.boolean().optional(),
  }),
});

export const RoomValidations = {
  createRoomValidationSchema,
  updateRoomValidationSchema,
};
