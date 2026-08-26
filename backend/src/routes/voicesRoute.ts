import { Router } from "express";
import { listVoices } from "../services/elevenLabsService.js";

export const voicesRouter = Router();

voicesRouter.get("/", async (_req, res, next) => {
  try {
    const voices = await listVoices();
    return res.status(200).json(voices);
  } catch (error) {
    return next(error);
  }
});
