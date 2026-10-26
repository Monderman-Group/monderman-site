/* Optional native-control enhancement. No autoplay, tracking, or network calls. */
document.querySelectorAll('[data-article-audio]').forEach(section => {
  const audio = section.querySelector('audio');
  const speed = section.querySelector('[data-audio-speed]');
  const error = section.querySelector('[data-audio-error]');
  if (!audio || !speed) return;
  const speedControls = section.querySelector('[data-audio-speed-controls]');
  if (speedControls) speedControls.hidden = false;
  speed.addEventListener('change', () => {
    const rate = Number(speed.value);
    if ([0.75, 1, 1.25, 1.5, 2].includes(rate)) audio.playbackRate = rate;
  });
  audio.addEventListener('ratechange', () => {
    const rate = String(audio.playbackRate);
    if ([...speed.options].some(option => option.value === rate)) speed.value = rate;
  });
  const showError = () => { if (error) error.hidden = false; };
  audio.addEventListener('error', showError);
  audio.querySelector('source')?.addEventListener('error', showError);
  audio.addEventListener('loadeddata', () => { if (error) error.hidden = true; });
});
