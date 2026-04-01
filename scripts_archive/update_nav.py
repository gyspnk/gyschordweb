with open('docs/js/06-navigation.js', 'r', encoding='utf-8') as f:
    text = f.read()

search_str = 'document.querySelector(".app-header").style.display = "flex";'
replacement_str = search_str + '''

  const miniPlayerContainer = document.getElementById('mini-player');
  if (page === "pengaturan" || page === "report-bug" || page === "about-project") {
    if (miniPlayerContainer) miniPlayerContainer.classList.add('is-hidden');
  }
'''

if search_str in text:
    with open('docs/js/06-navigation.js', 'w', encoding='utf-8') as f:
        f.write(text.replace(search_str, replacement_str))
    print('Updated navigateTo')
else:
    print('Not found')
