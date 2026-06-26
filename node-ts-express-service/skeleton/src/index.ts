import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = buildServer();

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
