# Suggest a Price — Offer Flow Prototype

Interactive prototype for the buyer offer flow, including:
- Recommended / lowball nudge / min offer block states
- Seller-side validation (min offer depth, sale/min offer gap rules)
- Option C: platform rec silently floored at seller's min offer
- All buyer error states (above list, above sale, below min offer, lowball floor)

## Files

```
suggest-a-price/
├── index.html   — markup and layout
├── style.css    — all styles
├── logic.js     — all state logic and rendering
└── README.md
```

## Run locally

No build step needed. Just open `index.html` in a browser, or run a local server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. Vercel auto-detects a static site — no config needed.

### Option B — GitHub → Vercel (recommended)

1. Push this folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial prototype"
   gh repo create suggest-a-price --public --push
   ```
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo — Vercel detects it as static, deploy with defaults
4. Every push to `main` redeploys automatically

## Logic summary

| Threshold         | Rule                              |
|-------------------|-----------------------------------|
| Recommended       | 5% off effective price (sale or list) |
| Nudge             | 10% off effective price           |
| Platform block    | 30% off list price                |
| Min offer floor   | Must be ≥ 40% off list            |
| Sale/min gap      | Must stay ≥ 20% of list apart     |
| Option C flooring | rec/nudge = max(platform, minOffer) — buyer never sees conflict |
