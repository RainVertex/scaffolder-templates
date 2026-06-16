import { createSchema } from "graphql-yoga";

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      hello(name: String): String!
    }
  `,
  resolvers: {
    Query: {
      hello: (_parent: unknown, args: { name?: string }) => `Hello, ${args.name ?? "world"}`,
    },
  },
});
