import { Router } from "express";
import { listRecentHistory } from "../db/historyRepository.js";

export const historyRouter = Router();

historyRouter.get("/", async (_req, res, next) => {
  try {
    const history = await listRecentHistory();
    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
});
