import express, { type Express } from "express";

export function buildServer(): Express {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
