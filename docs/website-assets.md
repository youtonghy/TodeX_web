# Website assets and content

- Website: `/`; existing workbench: `/app`.
- Content sources: `../README.md`, `../TodeX_desktop/README.md`, `../TodeX_backend/README.md`, and this project's README.
- Design reference: https://www.aura.build/templates/aviation-flight-49 (powder-blue sky, pill navigation, large typography, warm orange actions).
- Brand: existing `src/renderer/assets/brand/t-icon-light.png`.
- Agent marks: the existing `ProviderIcon` and locally installed `@lobehub/icons-static-svg` assets.
- The workbench illustration uses example content, explicitly labeled on the page, and is built from HTML/CSS. It does not represent a live session.
- Download catalog: fetched live from GitHub Releases by the Node server at `GET /api/releases` (10-minute cache, stale fallback, optional `GITHUB_TOKEN` for higher rate limits). Visitors never call the GitHub API. Historical versions and actual file names are retained.

## Sky image

`public/images/cloud-sky.jpg` is an original image generated with the built-in image generation tool, then encoded as a JPEG for the website. No third-party fonts, scripts, or image requests are required.

Generation prompt:

> Use case: photorealistic-natural. Asset type: full-width background for a premium coding software landing page, 1536x1024 landscape. Generate a serene, cinematic open sky viewed at cloud altitude. Muted powder blue sky fills the upper 70 percent, with thin delicate cirrus and broad clean negative space for dark typography. Soft, sunlit white cumulus cloud banks enter from the left and right edges in the bottom third; a luminous hazy pale ivory horizon at the bottom. Subtle analog film grain, refined editorial photography, beautifully natural cloud textures. Color palette desaturated light steel blue, periwinkle haze, soft warm white. Quiet, expansive, optimistic morning atmosphere. NO text, no typography, no logos, no UI, no plane, no birds, no mountains, no dark dramatic storm clouds. The center must remain low contrast and clear.
