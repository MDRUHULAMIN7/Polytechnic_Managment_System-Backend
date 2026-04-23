export type TRoom = {
  roomName: string;
  roomNumber: number;
  buildingNumber: number;
  capacity: number;
  floor?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TRoomListFilters = {
  searchTerm?: string;
  page?: number;
  limit?: number;
  sort?: string;
  isActive?: string;
  buildingNumber?: string;
  fields?: string;
};
