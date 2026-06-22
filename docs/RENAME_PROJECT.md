# Rename project to Les cocottes de Diane

This document tracks the safe migration from the old public name `LocalCo` / `localco` to the new public name `Les cocottes de Diane`.

## Target names

- Public project name: `Les cocottes de Diane`
- Recommended GitHub slug: `les-cocottes-de-diane`
- Current repository: `Sylapho/localco`
- Future repository: `Sylapho/les-cocottes-de-diane`

## What should be renamed

### Rename first

These references are public-facing and should use the new name:

- Root README title and presentation text.
- App READMEs titles and descriptions.
- Frontend metadata titles and descriptions.
- Visible UI labels in the back-office and shop.
- GitHub badge URLs after the repository is renamed.
- Documentation examples that tell recruiters what the project is.

### Rename with caution

These references can be renamed, but only if all dependent files are updated together:

- Root `package.json` name and description.
- Docker Compose database defaults such as `localco_db`, `localco`, and `localco_dev`.
- Docker image names, container names, volume names, and GHCR image paths if they are introduced or referenced elsewhere.
- Playwright project labels and test storage keys.
- Test fixtures that include `localco` in URLs, database names, or identifiers.

### Do not rename unless there is a real technical reason

Keep these stable for now to avoid unnecessary breakage:

- Folders: `apps/api`, `apps/web`, `apps/shop`.
- Environment variable names such as `DATABASE_URL`, `FRONTEND_URL`, `SHOP_PUBLIC_URL`, `API_CORS_ORIGINS`, `STRIPE_*`, `RESEND_*`.
- API routes and public paths.
- Prisma model names and migrations.
- Internal package scopes such as `@localco/api`, `@localco/web`, and `@localco/shop` until a dedicated technical rename is planned.

## GitHub repository rename procedure

1. Go to the repository page on GitHub.
2. Open `Settings`.
3. In the repository name field, replace `localco` with `les-cocottes-de-diane`.
4. Confirm with `Rename`.
5. Do not recreate a new repository named `localco`, otherwise GitHub redirects from the old URL may stop working.

GitHub redirects most repository traffic after a rename, including issues, stars, followers, and Git operations. Local clones should still update their remote URL to avoid confusion.

## Local remote update

HTTPS:

```bash
git remote -v
git remote set-url origin https://github.com/Sylapho/les-cocottes-de-diane.git
git remote -v
git fetch origin
```

SSH:

```bash
git remote -v
git remote set-url origin git@github.com:Sylapho/les-cocottes-de-diane.git
git remote -v
git fetch origin
```

## Files to check after rename

Run searches from the repository root:

```bash
git grep -n "localco"
git grep -n "LocalCo"
git grep -n "LOCALCO"
git grep -n "Sylapho/localco"
git grep -n "@localco"
```

Expected remaining occurrences:

- `@localco/*` package names, if intentionally kept.
- Local PostgreSQL defaults, if intentionally kept.
- Historical documentation that explicitly explains the former name.

## Verification commands

```bash
pnpm install
pnpm db:generate
pnpm lint
pnpm test
pnpm build
pnpm docker:dev:build
```

Use `pnpm check` if it remains the main all-in-one command.

## Recommended branch and commit

Branch:

```bash
git checkout -b chore/rename-project-branding
```

Commit:

```bash
git commit -m "chore: rename project branding"
```
