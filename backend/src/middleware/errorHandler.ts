import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "Endpoint not found." });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ detail: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ detail: "Internal server error." });
}
