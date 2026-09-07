# Base Structure for `src-private`

To set up a custom instance, create `src-private` in the workspace root following this directory structure:

```
├── api
│   ├── controllers
│   └── services
│       ├── interfaces
│       ├── sheets
│       └── supabase
├── assets
├── branding.json
├── rooms.json
├── routes
│   ├── admin
│   ├── api
│   └── resident
├── server
├── services.ts
└── types
```

Leave an empty file (e.g. `.gitignore`) in empty directories to preserve them in git.

## Repository Setup

`src-private` should be hosted as an independent private repository (e.g. named along the lines of `haone-data-<initials_of_rha>`). Clone it into the project root as `src-private/`.

## Cloudflare Pages Deployment

When deploying to Cloudflare Pages, configure the build settings:

- **Build command**:
  ```bash
  git clone --depth 1 https://$GH_TOKEN@github.com/<username>/<repo>.git src-private && pnpm build
  ```
- **Build output directory**:
  ```
  .svelte-kit/cloudflare
  ```
- **Environment variables**:
  - `GH_TOKEN`: GitHub personal access token with read access to the private repository.
