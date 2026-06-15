# scaffolder-templates

Skeleton fixtures for the HiveDP self-service scaffolder. Each top-level directory holds one
template's `skeleton/`, which the `fetch:remote-template` action renders into a new repository.

Files are rendered with Nunjucks using the HiveDP `${{ }}` dialect. A trailing `.tmpl` is
stripped from output filenames, and `__PASCAL__` markers in paths are substituted.

## Templates

- `react-ts-spa` Vite, React and TypeScript single-page app.
- `node-ts-service` Node, TypeScript and Fastify HTTP service.
- `strapi-cms-react` Strapi headless CMS plus a React frontend monorepo.

Templates pin a tag (for example `v1.0.0`). Cut a new tag whenever a skeleton changes.
