const themeswitcher = document.getElementById('themeswitcher')!;
themeswitcher.onclick = () => {
  const root = document.getElementById('root')!;
  console.log(root);
  if (root.className === 'theme-dark') {
    root.className = 'theme-light';
    themeswitcher.innerHTML = '<span class="fa-solid fa-sun"></span>';
    localStorage.setItem('dinnik-theme', 'light');
  } else {
    root.className = 'theme-dark';
    themeswitcher.innerHTML = '<span class="fa-solid fa-moon"></span>';
    localStorage.setItem('dinnik-theme', 'dark');
  }
};
if (localStorage.getItem('dinnik-theme') === 'dark') {
  document.getElementById('root')!.className = 'theme-dark';
  themeswitcher.innerHTML = '<span class="fa-solid fa-moon"></span>';
}
