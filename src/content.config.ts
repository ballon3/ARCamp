import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const artists = defineCollection({
  loader: glob({ pattern: '**/*.md', base: "./src/data/artists" }),
  schema: z.object({
    name: z.string(),
    stage_name: z.string(),
    genre: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    performances: z.array(
      z.object({
        stage: z.string(),
        day: z.string(),
        programming_time: z.string(),
        soundcheck_time: z.string(),
        set_start: z.string(),
        set_end: z.string(),
        confirmed_greenrooms: z.string(),
        green_room_sched: z.string(),
        greenroom_start: z.string(),
        greenroom_end: z.string(),
      }),
    ).default([]),
    stages: z.array(z.string()).default([]),
    show_days: z.array(z.string()).default([]),
  }),
});
 
const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: "./src/data/albums" }),
  schema: z.object({
    name: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    publishDate: z.date(), // e.g. 2024-09-17
    tracks: z.array(z.string()),
    artist: z.string(),
  }),
});

// Export all collections
export const collections = {artists, albums};