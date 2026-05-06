# apps/web

Tradeline marketing site + (future) authenticated app. Next.js 15 App Router + Tailwind v4.

## Run locally

```bash
cd apps/web
npm install
npm run dev
# http://localhost:3000
```

## Design system (2060 institutional terminal)

Defined in `app/globals.css` via Tailwind v4 `@theme` tokens:

- `--color-bg / bg-1 / bg-2` — near-black layered surfaces
- `--color-line / line-strong` — hairline borders, never shadows
- `--color-accent` (`#5cf2a4`) — performing / live state
- `--color-warn` (`#f5b050`) — lightly seasoned / amber
- `--color-danger` (`#ff6a6a`) — compliance red-line
- Mono numerics (`tick` class), `bg-grid` backdrop, subtle `shimmer` for live modules

Rules of thumb:
- Numbers in monospace, prose in sans, all-caps tracking-wide for chrome
- Sharp corners only — no `rounded-*`
- Borders > shadows
- Green is the *performing* state, never decoration
