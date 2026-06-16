import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const yoga = createYoga({ schema });
const server = createServer(yoga);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

server.listen(port, host, () => {
  console.log(`GraphQL API ready at http://${host}:${port}/graphql`);
});
