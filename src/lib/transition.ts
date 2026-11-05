// which link clicks play the page transition; no dom, so it is unit tested

// sessionStorage key the leaving page sets, so the page it opens starts covered (Base.astro) and uncovers itself
export const ARRIVE_KEY = 'transition-arrive';

// a file other than an html page, such as /cv.pdf, never shows a page to uncover
const FILE = /\.(?!html?$)[a-z0-9]+$/i;

export function isPageChange(to: URL, here: URL): boolean {
  return to.origin === here.origin && to.pathname !== here.pathname && !FILE.test(to.pathname);
}
