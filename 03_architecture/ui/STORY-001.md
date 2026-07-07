# STORY-001 — Landing Page First Impression & Navigation

## Layout & Regions
- **Region:** Full-viewport centered content zone (`display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center`)
- **Ant Components:** `Typography.Title` (level 1), `Button` (`type="primary"`), wrapper `div`

## Content Hierarchy
1. Primary heading (product name)
2. Subtext placeholder (optional, excluded per Gherkin)
3. Primary CTA button

## Exact Visible Copy
- Heading: `'My Local Agent App'`
- Button: `'Get Started'`

## States
- **Default:** Centered layout, full viewport height on mobile, `min-height: 60vh` on desktop.
- **Loading:** N/A (static client route)
- **Error:** None required per feature scope; if fetch fails for route data, fallback to same default layout.

## Accessibility
- `<h1>` wraps product name with `colorTextBase`
- Button uses Ant `focusRing` token, includes `aria-label="Get Started"`
- Focus trap disabled on landing; standard tab flow preserved
- Contrast ratio ≥ 4.5:1 for all text/interactive elements
