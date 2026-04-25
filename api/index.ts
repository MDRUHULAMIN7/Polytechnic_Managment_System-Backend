import app from "../src/app.js";
import mongoose from "mongoose";
import config from "../src/app/config/index.js";
import { syncRoomIndexes } from "../src/app/modules/room/room.model.js";

let cached = false;

async function connectDb() {
  if (cached) return;
  await mongoose.connect(config.database_url as string);
  await syncRoomIndexes();
  cached = true;
}

export default async function handler(req: any, res: any) {
  await connectDb();
  return app(req, res);
}
