# Dependencies and visual references

The nutrition dataset and original interaction originate from the user-supplied `index.html`; its exact values are preserved.

## Reused open-source libraries

- Three.js — MIT. https://github.com/mrdoob/three.js . Used renderer, geometry, GLTFLoader, OrbitControls, RoomEnvironment, EffectComposer, UnrealBloomPass and OutputPass.
- Vue — MIT. https://github.com/vuejs/core . Existing application's framework, now bundled locally.
- Vite — MIT. https://github.com/vitejs/vite . Build and development tooling.
- Lucide — ISC, including Feather-derived icons under MIT. https://lucide.dev/license . Icons via lucide-vue-next.
- Barlow Condensed — SIL Open Font License. https://fonts.google.com/specimen/Barlow+Condensed . License at public/fonts/Barlow-OFL.txt.
- DM Sans — SIL Open Font License. https://fonts.google.com/specimen/DM+Sans . License at public/fonts/DM-Sans-OFL.txt.

Full third-party license text is included in `public/licenses/` and `public/fonts/`, and dependency distributions retain their notices.

## References, not copied application code

- RhineLabUI, LBEILC (MIT): https://github.com/LBEILC/RhineLabUI . Material, camera and model-to-browser workflow discussed earlier; no application source or model assets copied into FUEL.
- Three.js physical transmission example: https://threejs.org/examples/webgl_materials_physical_transmission.html . Material inspiration.
- React Three Fiber community: https://github.com/pmndrs/react-three-fiber . Reviewed as an ecosystem reference; not a dependency because this application preserves Vue.

## Original assets

- Kinetic core: custom Blender Python construction, `art/build_core.py` / `art/fuel-core.blend`; exported as `public/models/fuel-core.glb`.
- Food artwork: one built-in imagegen request. Exact prompt and generation details in `art/IMAGE_PROMPT.md`. No site text baked into the image.
- Orbital progress geometry, shaders/material composition, decorative fragments, particle injection and app visual design: original code for this project.
