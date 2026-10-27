// the toggle lives on every page; home listens for 'themechange' to retint the sphere and replay the intro
const root = document.documentElement;

document.querySelector('[data-theme-toggle]')!.addEventListener('click', () => {
  const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  document.dispatchEvent(new Event('themechange'));
});
