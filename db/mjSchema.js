import { config } from "dotenv";
config();

import mongoose from "mongoose";

mongoose.connect('mongodb://127.0.0.1/midjourney_DB');

import { MJ } from "./models/mjModel.js";

export { MJ };
