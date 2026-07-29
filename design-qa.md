# Liquid Glass Web Component Design QA

## Scope

The supplied iPhone Photos screenshot is used as the visual reference for the shared liquid lens only. The surrounding application layout is intentionally preserved.

## Comparison

- With no hover or keyboard focus, every original control remains complete and no lens is visible: passed.
- The lens contains no copied label or icon; it only refracts the real content beneath it: passed.
- The lens remains continuous while moving and stretches across adjacent controls: passed.
- Cyan, pink, and white edge highlights communicate optical thickness: passed.
- Right-to-left and diagonal paths contain no rotation keyframes: passed.
- Bookmark and folder lenses are larger than their cards and keep the card radius instead of shrinking inside them: passed.
- Dynamic bookmark rendering recreates the component-owned lens without global selector repair code: passed.
- The optical implementation is authored in TypeScript and packaged as a native Web Component: passed.

## Residual Difference

Chromium SVG backdrop filtering cannot exactly reproduce Apple's private renderer. The component follows the article's two-map magnification/refraction structure and specular composition, while generating original maps at runtime rather than copying the site's unlicensed build assets.

final result: passed
