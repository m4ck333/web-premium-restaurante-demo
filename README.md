# Web Premium — Restaurante (demo)

Pieza de portfolio: landing premium de restaurante ("Brasa Norte", caso ficticio) construida
como demostración del estándar de entrega de webs premium — scroll cinemático (GSAP +
ScrollTrigger + Lenis), tipografía fluida y diseño responsive.

> Caso ficticio con fines de demostración. Las imágenes son placeholders CSS a la espera de
> generación de assets reales.

## Stack

- HTML estático autocontenido (un único `index.html`)
- GSAP 3.12 + ScrollTrigger + Lenis (vía CDN) para el motion
- Google Fonts (Fraunces + Inter)
- Sin build: se sirve tal cual

## Desarrollo local

```bash
# cualquier servidor estático sirve; por ejemplo:
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Deploy

Sitio estático: el `index.html` de la raíz se sirve directamente (Vercel, Netlify,
Cloudflare Pages o GitHub Pages, todos en free-tier).

## Estructura

```
index.html            la página completa
assets/manifest.json  inventario de assets (sistema pending/stock/ready)
```
