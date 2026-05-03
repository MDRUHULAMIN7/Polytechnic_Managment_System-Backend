import app from "../src/app.js";
import mongoose from "mongoose";
import config from "../src/app/config/index.js";
import { syncRoomIndexes } from "../src/app/modules/room/room.model.js";
import type { Request, Response } from "express";

let cached = false;

async function connectDb() {
  if (cached) return;
  await mongoose.connect(config.database_url as string);
  await syncRoomIndexes();
  cached = true;
}

export default async function handler(req: Request, res: Response) {
  await connectDb();
  return app(req, res);
}
