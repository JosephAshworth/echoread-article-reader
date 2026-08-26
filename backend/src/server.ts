import { env } from "./config/env.js";
import { initializeDatabase, pool } from "./db/pool.js";
import { app } from "./app.js";

async function startServer(): Promise<void> {
  await initializeDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`EchoRead backend listening on http://127.0.0.1:${env.PORT}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
