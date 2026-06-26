import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = buildServer();

const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

server.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
