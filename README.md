# flypea.tech

Portfolio and web development learning lab for `flypea.tech`.

## Stack

- Astro 7
- TypeScript
- Tailwind CSS v4
- Biome
- GitHub Actions

構成をやさしい日本語で読む: [docs/frontend-foundation.md](docs/frontend-foundation.md)

## Commands

```sh
npm install
npm run dev
npm run verify
```

## Development URL

```text
http://127.0.0.1:4321
```

## Deployment

Astro builds this site as static files into `dist/`.
The contents of `dist/` can be uploaded to Lolipop via SFTP/FTP.

GitHub Actions deployment is prepared in `.github/workflows/deploy.yml`.
See [docs/deployment.md](docs/deployment.md) before enabling automatic deployment.

## Notes

See [docs/setup.md](docs/setup.md) for setup and GitHub publishing steps.
