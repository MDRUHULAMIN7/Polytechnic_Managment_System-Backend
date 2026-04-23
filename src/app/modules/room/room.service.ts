import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import AppError from '../../errors/AppError.js';
import type { TRoom } from './room.interface.js';
import { Room } from './room.model.js';

const normalizeRoomName = (value: string) => value.trim();

const assertCompoundRoomUnique = async (
  payload: Partial<TRoom>,
  excludeId?: string,
) => {
  if (
    payload.buildingNumber === undefined ||
    payload.roomNumber === undefined
  ) {
    return;
  }

  const duplicate = await Room.findOne({
    buildingNumber: payload.buildingNumber,
    roomNumber: payload.roomNumber,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('_id');

  if (duplicate) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Another room already exists with the same building and room number.',
    );
  }
};

const createRoomIntoDB = async (payload: TRoom) => {
  const normalizedPayload: TRoom = {
    ...payload,
    roomName: normalizeRoomName(payload.roomName),
  };

  if (!normalizedPayload.roomName) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Room name is required.');
  }

  const duplicateName = await Room.findOne({
    roomName: normalizedPayload.roomName,
  }).select('_id');

  if (duplicateName) {
    throw new AppError(StatusCodes.CONFLICT, 'This room name already exists.');
  }

  await assertCompoundRoomUnique(normalizedPayload);

  return Room.create(normalizedPayload);
};

const getAllRoomsFromDB = async (query: Record<string, unknown>) => {
  const queryObj = { ...query };

  if (queryObj.isActive === '') {
    delete queryObj.isActive;
  }

  if (typeof queryObj.isActive === 'string') {
    if (queryObj.isActive === 'true') {
      queryObj.isActive = true;
    } else if (queryObj.isActive === 'false') {
      queryObj.isActive = false;
    } else {
      delete queryObj.isActive;
    }
  }

  if (queryObj.buildingNumber === '') {
    delete queryObj.buildingNumber;
  }

  if (typeof queryObj.buildingNumber === 'string') {
    const buildingNumber = Number(queryObj.buildingNumber);
    if (Number.isFinite(buildingNumber)) {
      queryObj.buildingNumber = buildingNumber;
    } else {
      delete queryObj.buildingNumber;
    }
  }

  const roomQuery = new QueryBuilder(Room.find(), queryObj)
    .search(['roomName'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await roomQuery.modelQuery;
  const meta = await roomQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSingleRoomFromDB = async (id: string) => {
  const result = await Room.findById(id);

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Room not found.');
  }

  return result;
};

const updateRoomIntoDB = async (id: string, payload: Partial<TRoom>) => {
  const existing = await Room.findById(id);

  if (!existing) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Room not found.');
  }

  const updatedPayload: Partial<TRoom> = { ...payload };

  if (payload.roomName !== undefined) {
    const roomName = normalizeRoomName(payload.roomName);
    if (!roomName) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Room name can not be empty.');
    }

    updatedPayload.roomName = roomName;

    const duplicate = await Room.findOne({
      roomName,
      _id: { $ne: id },
    }).select('_id');

    if (duplicate) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'Another room already exists with this name.',
      );
    }
  }

  await assertCompoundRoomUnique(
    {
      buildingNumber:
        updatedPayload.buildingNumber ?? existing.buildingNumber,
      roomNumber: updatedPayload.roomNumber ?? existing.roomNumber,
    },
    id,
  );

  const result = await Room.findByIdAndUpdate(id, updatedPayload, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update room.');
  }

  return result;
};

export const RoomServices = {
  createRoomIntoDB,
  getAllRoomsFromDB,
  getSingleRoomFromDB,
  updateRoomIntoDB,
};
