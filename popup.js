document.addEventListener('DOMContentLoaded', () => {
  const behaviorSelect = document.getElementById('behavior');
  const durationSlider = document.getElementById('duration');
  const durationValue = document.getElementById('duration-value');

  chrome.storage.local.get(['holdDuration', 'clickBehavior'], (res) => {
    const duration = res.holdDuration || 700;
    const behavior = res.clickBehavior || 'newTab';

    durationSlider.value = duration;
    durationValue.textContent = (duration / 1000).toFixed(1) + 's';
    behaviorSelect.value = behavior;
  });

  durationSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    durationValue.textContent = (val / 1000).toFixed(1) + 's';
    chrome.storage.local.set({ holdDuration: val });
  });

  behaviorSelect.addEventListener('change', (e) => {
    chrome.storage.local.set({ clickBehavior: e.target.value });
  });
});