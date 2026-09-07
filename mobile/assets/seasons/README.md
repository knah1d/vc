# Seasonal assets

`forest-leaf.png` was generated with the built-in image generation tool and visually inspected. It is an RGBA botanical sprite used by `season-scene.tsx`; no native dependency is required.

Prompt: One single realistic fresh green mango leaf with short stem, isolated on genuinely transparent background, full leaf visible, diagonal across a square frame with small margin. Macro botanical photography, detailed natural veins, subtly curled edges, forest-green surface with gentle daylight highlights. No ground plane, no cast shadow outside the leaf, no text, no watermark, no other objects.

The other seasonal environments are lightweight code-rendered shapes, not photorealistic 3D environments. Full enables falling particles, Subtle keeps scenery static with interaction feedback, Still disables motion and leaf gestures. Device reduced-motion and app background state override animation. Interactive leaves are limited to screen gutters outside content and the larger Appearance preview.

## monsoon-forest.jpg

Real photograph, not generated. Source: [Wikimedia Commons — "Hoh mist forest trees Hoh NPS Photo j preston (17115216790).jpg"](https://commons.wikimedia.org/wiki/File:Hoh_mist_forest_trees_Hoh_NPS_Photo_j_preston_(17115216790).jpg), photographed by NPS staff in the Hoh Rain Forest, Olympic National Park. Licensed **PD-USGov** (public domain — a work of the U.S. federal government); no attribution is legally required, though the source is credited here for provenance. Original was 3872×2592 (2.6 MB); resized to 1600×1071 and re-compressed to ~210 KB for the app bundle via `convert -resize 1600x -quality 82 -strip`.

Used in `season-scene.tsx` as the monsoon "distant landscape" layer — a real rain-soaked forest with baked-in atmospheric mist, overlaid with code-rendered animated rain and a soft scrim for text readability.
