with open("docs/js/13-playlist-ui.js", "r", encoding="utf-8") as f:
    text = f.read()

bad_str = """        circle.style.width = circle.style.height = \px\;
        circle.style.left = \px\;
        circle.style.top = \px\;"""

good_str = """        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;"""

with open("docs/js/13-playlist-ui.js", "w", encoding="utf-8") as f:
    f.write(text.replace(bad_str, good_str))
