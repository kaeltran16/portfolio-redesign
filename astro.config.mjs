import { defineConfig } from 'astro/config';

export default defineConfig({
  // site is set once hosting is decided (chunk 11); og:image and og:url are only rendered when it is set
  // the toolbar sits over the scroll cue, which is part of what is being judged
  devToolbar: { enabled: false },
});
