import app from "../src/app.js";
import mongoose from "mongoose";
import config from "../src/app/config/index.js";

let cached = false;

async function connectDb() {
  if (cached) return;
  await mongoose.connect(config.database_url as string);
  cached = true;
}

export default async function handler(req: any, res: any) {
  await connectDb();
  return app(req, res);
}
