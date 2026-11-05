# portfolio-redesign

Throwaway first screen for Khang Tran's new portfolio, built close to hamishw.com to judge the feel live.

```sh
npm install
npm run dev     # http://localhost:4321
npm test        # unit tests for the name decode
npm run shots   # screenshots of the running dev server (desktop, phone, light, reduced motion, projects)
```

- The dark/light toggle sits top right. Under `prefers-reduced-motion` every effect stops and the content shows in its final state.
- `public/cv.pdf` is the real CV, built from `job-search/resume_v2.md`. Experience on Home gives one-line summaries; the full wording lives in `public/cv.pdf`, and every number on the site must match it.

## Credit

The layout, intro motion, theme toggle, decoder text and displacement sphere are ported from
[Hamish Williams' portfolio](https://github.com/HamishMW/portfolio) (hamishw.com), MIT licensed. His notice is in
[LICENSE-hamishw](LICENSE-hamishw). The sphere's noise GLSL is Stefan Gustavson's (MIT), via the same repo.
