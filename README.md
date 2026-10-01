# Vela

A scroll-driven WebGL story for a fictional knowledge product. One particle system made of about 17k faceted shards (about 9k on phones) runs from the first frame to the last. It never resets: each chapter morphs it into the next metaphor.

The design direction follows Dala by Unseen Studio: a black void, white neo-grotesk type at weight 400 with tight tracking, ultra-light body copy, one Electric Iris violet (`#8052ff`) for actions and amber (`#ffb829`) sparks. All code, copy and assets here are original.

## Run

```bash
npm install
npm start        # finds a free port starting at 5173 and starts Vite on it
npm run build    # production build into dist/
npm run serve    # preview the production build on a free port
npm run lint     # typecheck
```

## The story

| # | Chapter    | Formation                                         |
|---|------------|---------------------------------------------------|
| 1 | Origin     | brain                                             |
| 2 | Entropy    | deep shard field, camera flies through it         |
| 3 | Silos      | seven clusters with 3D-tracked labels             |
| 4 | Orbit      | spiral vortex, ring text locked to the disc       |
| 5 | Question   | sculpted `?`, question typed as you scroll        |
| 6 | Answer     | flowing ribbons                                   |
| 7 | Hive       | network sphere                                    |
| 8 | Principles | vault → helix → knot, horizontal track            |
| 9 | Mark       | the logo shards (the same polygons as the SVG)    |
| 10 | Begin     | the brain again, closing the loop                 |

## How it works

- **`src/gl/shapes.ts`**: generates one target position per particle for every formation. All of them are packed into a single float texture.
- **`src/gl/particles.ts`**: an instanced tetrahedron shader. It reads two formations from the texture and morphs between them per particle, with a staggered sweep, a swirl and a burst. It also handles each formation's idle motion, cursor repulsion and hold-to-gather, faceted lighting and depth falloff.
- **`src/story.ts`**: turns scroll position into one continuous coordinate over the formations. Holds sit on whole numbers and morphs happen between them. Camera, pose, bloom and focus all interpolate along that coordinate.
- **`src/main.ts`**: runs Lenis smooth scroll and drives the DOM choreography: masked word reveals, scattering letters, scroll-typed text, a reading highlight, counters, the principles track and the wordmark. All of it hangs off the same story coordinate.
