# Nivara — website

Marketing site for **Nivara** and its product **Nivara Bioform**, a PHA (polyhydroxyalkanoate) bio-polymer grown by microbes from waste, built to replace plastic in packaging.

Plain HTML, CSS and JavaScript. No build step, no `npm install`.

## Run it locally

```bash
python .claude/dev_server.py 5173
```

Then open http://127.0.0.1:5173. The dev server turns caching off so edits show up on reload. Any static server works, and double-clicking `index.html` works too.

## Files

| File | What it does |
| --- | --- |
| `index.html` | All page content and sections |
| `assets/css/style.css` | Colours, type, layout, responsive rules. Brand tokens are at the top in `:root` |
| `assets/js/scene.js` | The 3D particle story (Three.js): cell → waste → microbes → pellets → bottle → seedling |
| `assets/js/main.js` | Loader, smooth scroll, scroll animations, decay slider, cursor, gallery, contact form |
| `assets/img/favicon.svg` | Logo mark |

Libraries load from jsDelivr at pinned versions: Three.js 0.169.0, GSAP 3.13.0 (with ScrollTrigger) and Lenis 1.1.13.

## Before going live

1. **Contact form.** Set `FORM_ENDPOINT` at the top of `assets/js/main.js` to a form service URL (for example Formspree or Getform) or your own API. Until then the form says it isn't connected, rather than pretending to send.
2. **Claims.** Biodegradability and certification wording is written as *design targets* ("Designed for", "on our roadmap"). Update it as you get real test results and certifications.
3. **Founder details.** The bios for Darshan and Rudra are short placeholders. Add photos and LinkedIn links if you want.
4. **Name check.** Run a proper trademark search on "Nivara" and "Nivara Bioform" in your target markets.

## Deploy

Upload the folder as-is to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). The `.claude/` folder is only for local development and doesn't need to be deployed.

## Accessibility & fallbacks

- Respects `prefers-reduced-motion`: no smooth scroll, and the particles calm down.
- Touch devices skip the custom cursor, tilt and magnetic effects.
- If WebGL is unavailable, the 3D layer is skipped and the page still works.
- If the CDN scripts fail to load, the page falls back to a static layout.
