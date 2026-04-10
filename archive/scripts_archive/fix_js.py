import re
with open('docs/js/05-events.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_code = '''// Custom MIDI Controls Logic

  if (customInstrumentSelect && cisMenu && customPlayBtn && mainMidiPlayer) {   

    // Dropdown toggle

    customInstrumentSelect.addEventListener("click", (e) => {

      // prevent closing immediately if clicking inside menu but not on option  

      if (e.target.closest('.cis-menu') && !e.target.closest('.cis-option')) return;

      customInstrumentSelect.classList.toggle("is-open");

    });



    // Close dropdown on outside click

    document.addEventListener("click", (e) => {

      if (!customInstrumentSelect.contains(e.target)) {

        customInstrumentSelect.classList.remove("is-open");

      }

    });'''

new_code = '''// Custom MIDI Controls Logic
  if (customInstrumentSelect && cisMenu && customPlayBtn && mainMidiPlayer) {   
    
    // Toggle Animated Collapsible Dropdown
    customInstrumentSelect.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById('custom-midi-player').classList.toggle("is-open");
      const isOpen = document.getElementById('custom-midi-player').classList.contains("is-open");
      customInstrumentSelect.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        customInstrumentSelect.classList.add("active");
      } else {
        customInstrumentSelect.classList.remove("active");
      }
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      const playerContainer = document.getElementById('custom-midi-player');
      if (playerContainer && !playerContainer.contains(e.target)) {
        playerContainer.classList.remove("is-open");
        customInstrumentSelect.setAttribute("aria-expanded", "false");
        customInstrumentSelect.classList.remove("active");
      }
    });'''

text = text.replace(old_code, new_code)
# Remove the old buggy e.target.closest logic inside option select just to be safe
old_opt = '''    // Option select

    document.querySelectorAll('.cis-option').forEach(option => {

      option.addEventListener("click", (e) => {

                const val = e.target.getAttribute('data-val');

        const text = e.target.textContent;

        customInstrumentSelect.dataset.value = val;'''

new_opt = '''    // Option select
    document.querySelectorAll('.cis-option').forEach(option => {
      option.addEventListener("click", (e) => {
        // Find nearest button in case user clicked inner element
        const btn = e.target.closest('.cis-option');
        if(!btn) return;
        const val = btn.getAttribute('data-val');
        customInstrumentSelect.dataset.value = val;
        
        // Auto-close menu after selection
        document.getElementById('custom-midi-player').classList.remove("is-open");
        customInstrumentSelect.setAttribute("aria-expanded", "false");
        customInstrumentSelect.classList.remove("active");
        '''
text = text.replace(old_opt, new_opt)

old_play = '''    // Play/Pause button

    customPlayBtn.addEventListener("click", () => {

      if (!mainMidiPlayer.playing) {

        mainMidiPlayer.start();

        customPlayIcon.textContent = "pause";

      } else {

        mainMidiPlayer.stop();

        customPlayIcon.textContent = "play_arrow";

      }

    });



    // Sync play state

    mainMidiPlayer.addEventListener('start', () => customPlayIcon.textContent = "pause");

    mainMidiPlayer.addEventListener('stop', () => customPlayIcon.textContent = "play_arrow");'''

new_play = '''    // Play/Pause button
    customPlayBtn.addEventListener("click", async () => {
      try {
        if (!mainMidiPlayer.playing) {
          customPlayIcon.textContent = "hourglass_empty"; // Loading state
          await mainMidiPlayer.start();
          customPlayIcon.textContent = "pause";
          document.getElementById('custom-midi-player').classList.add("playing");
        } else {
          mainMidiPlayer.stop();
          customPlayIcon.textContent = "play_arrow";
          document.getElementById('custom-midi-player').classList.remove("playing");
        }
      } catch (err) {
        console.error("Gagal start MIDI:", err);
        customPlayIcon.textContent = "play_arrow";
        document.getElementById('custom-midi-player').classList.remove("playing");
      }
    });

    // Sync play state
    mainMidiPlayer.addEventListener('start', () => {
      customPlayIcon.textContent = "pause";
      document.getElementById('custom-midi-player').classList.add("playing");
    });
    mainMidiPlayer.addEventListener('stop', () => {
      customPlayIcon.textContent = "play_arrow";
      document.getElementById('custom-midi-player').classList.remove("playing");
    });'''
text = text.replace(old_play, new_play)

with open('docs/js/05-events.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Logic Updated!')
