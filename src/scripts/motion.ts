// read once: every motion module keys off the same answer, so none of them can disagree mid-page
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
