import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { historyRouter } from "./routes/historyRoute.js";
import { speakRouter } from "./routes/speakRoute.js";
import { summariseRouter } from "./routes/summariseRoute.js";
import { voicesRouter } from "./routes/voicesRoute.js";

export const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/summarise", summariseRouter);
app.use("/speak", speakRouter);
app.use("/voices", voicesRouter);
app.use("/history", historyRouter);

app.use(notFoundHandler);
app.use(errorHandler);
