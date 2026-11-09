// Sabitler
const CIRCLE_RADIUS = 480;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const MAX_HOUR = 5;
const MAX_MINUTE = 59;

// DOM Cache
const DOM = {
  timerDisplay: null,
  dateDisplay: null,
  startBtn: null,
  pauseBtn: null,
  resetBtn: null,
  hourSelect: null,
  minuteSelect: null,
  alarmSound: null,
  mainContainer: null,
  fullscreenBtnMain: null,
  fullscreenBtn: null,
  circleTimerScreen: null,
  circleTimerTime: null,
  circleTimerLabel: null,
  circleTimerWarning: null,
  circleTimerAlarm: null,
  alarmLabel: null,
  alarmTimeText: null,
  progressCircle: null,
  exitBtn: null,
  stopAlarmBtn: null,
  circlePauseBtn: null,
  circleResetBtn: null,
  presetButtons: null,
  scheduleTime: null,
  scheduleType: null,
  scheduleBtn: null,
  scheduleStatus: null,
  scheduleStatusText: null,
  cancelScheduleBtn: null
};

// State
const state = {
  timer: null,
  clockInterval: null,
  circleInterval: null,
  totalSeconds: 0,
  remainingSeconds: 0,
  initialSeconds: 0,
  paused: false,
  circleTimerActive: false,
  alarmPlaying: false,
  warningTimeout: null,
  warningAudioContext: null,
  scheduleAt: null,
  scheduleHM: null,
  scheduleCheckInterval: null
};

// Toast
let _toastTimer = null;
function showToast(message, type = 'error', duration = 2600) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('error', 'success');
  if (type) toast.classList.add(type);
  toast.hidden = false;
  // force reflow for transition
  void toast.offsetWidth;
  toast.classList.add('show');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, duration);
}

// Utility Functions
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getSelectedTime() {
  const h = parseInt(DOM.hourSelect.value) || 0;
  const m = parseInt(DOM.minuteSelect.value) || 0;
  return h * 3600 + m * 60;
}

function setPreset(h, m) {
  DOM.hourSelect.value = h;
  DOM.minuteSelect.value = m;
  updateDisplay(h * 3600 + m * 60);
}

function updateDisplay(seconds) {
  if (DOM.timerDisplay) {
    DOM.timerDisplay.textContent = formatTime(seconds);
  }
}

// Clock Functions
function showCurrentTime() {
  stopClock();
  
  function updateClock() {
    const now = new Date();
    DOM.timerDisplay.textContent = formatTime(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const tarihStr = `${now.getDate()} ${months[now.getMonth()]} ${days[now.getDay()]}`;
    DOM.dateDisplay.textContent = tarihStr;
  }
  
  updateClock();
  state.clockInterval = setInterval(updateClock, 1000);
}

function stopClock() {
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
    state.clockInterval = null;
  }
}

// Timer Functions
function startTimer() {
  const totalSeconds = getSelectedTime();
  if (totalSeconds <= 0) {
    showToast('Lütfen geçerli bir süre seçin!', 'error');
    return;
  }

  prepareWarningAudio();
  stopClock();
  state.totalSeconds = totalSeconds;
  state.initialSeconds = state.totalSeconds;
  state.remainingSeconds = state.totalSeconds;
  state.paused = false;
  
  updateDisplay(state.remainingSeconds);
  setControls({ start: false, pause: true, reset: true });
  clearCircleTimerWarning();

  state.timer = setInterval(() => {
    if (!state.paused) {
      state.remainingSeconds--;
      updateDisplay(state.remainingSeconds);
      showCircleTimerWarning(state.remainingSeconds);

      if (state.remainingSeconds <= 0) {
        clearInterval(state.timer);
        state.timer = null;
        playAlarm();
        setControls({ reset: true });
      }
    }
  }, 1000);
  
  showCircleTimerScreen(state.totalSeconds);
  requestFullscreen(DOM.circleTimerScreen);
}

function setControls({ start = false, pause = false, reset = false } = {}) {
  if (DOM.startBtn) DOM.startBtn.disabled = !start;
  if (DOM.pauseBtn) DOM.pauseBtn.disabled = !pause;
  if (DOM.resetBtn) DOM.resetBtn.disabled = !reset;
  if (DOM.circlePauseBtn) DOM.circlePauseBtn.disabled = !pause;
  if (DOM.circleResetBtn) DOM.circleResetBtn.disabled = !reset;
}

function setPauseLabel(paused) {
  const text = paused ? 'Devam' : 'Duraklat';
  const ariaLabel = paused ? 'Devam et' : 'Duraklat';

  if (DOM.pauseBtn) {
    DOM.pauseBtn.setAttribute('aria-label', ariaLabel);
    const labelNode = DOM.pauseBtn.lastChild;
    if (labelNode && labelNode.nodeType === Node.TEXT_NODE) {
      labelNode.textContent = ' ' + text;
    }
  }
  if (DOM.circlePauseBtn) {
    DOM.circlePauseBtn.setAttribute('aria-label', ariaLabel);
    DOM.circlePauseBtn.textContent = text;
  }
}

function togglePause() {
  if (!state.timer) return;
  state.paused = !state.paused;
  setPauseLabel(state.paused);
}

function resetTimer() {
  // Aktif bir sayaç yoksa hiçbir şey yapma
  if (state.initialSeconds <= 0) return;

  // Alarm çalıyorsa durdur ama daire ekranını kapatma
  if (state.alarmPlaying) {
    if (DOM.alarmSound) {
      DOM.alarmSound.pause();
      DOM.alarmSound.currentTime = 0;
    }
    state.alarmPlaying = false;
    if (DOM.stopAlarmBtn) DOM.stopAlarmBtn.hidden = true;
    if (DOM.exitBtn) DOM.exitBtn.hidden = false;
    if (DOM.circleTimerAlarm) DOM.circleTimerAlarm.style.color = '';
  }

  // Mevcut interval'ları temizle
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  if (state.circleInterval) {
    clearInterval(state.circleInterval);
    state.circleInterval = null;
  }

  // Sayacı baştan başlat (initialSeconds korunur)
  state.totalSeconds = state.initialSeconds;
  state.remainingSeconds = state.initialSeconds;
  state.paused = false;
  setPauseLabel(false);
  clearCircleTimerWarning();

  updateDisplay(state.remainingSeconds);
  setControls({ start: false, pause: true, reset: true });

  state.timer = setInterval(() => {
    if (!state.paused) {
      state.remainingSeconds--;
      updateDisplay(state.remainingSeconds);
      showCircleTimerWarning(state.remainingSeconds);

      if (state.remainingSeconds <= 0) {
        clearInterval(state.timer);
        state.timer = null;
        playAlarm();
        setControls({ reset: true });
      }
    }
  }, 1000);

  // Daire ekranını yeniden başlat
  if (state.circleTimerActive) {
    restartCircleTimer(state.initialSeconds);
  }
}

function restartCircleTimer(totalSeconds) {
  updateCircleTimer(totalSeconds, totalSeconds);
  DOM.circleTimerLabel.textContent = 'Deneme Başladı ✍️';

  const now = new Date();
  now.setSeconds(now.getSeconds() + totalSeconds);
  DOM.alarmTimeText.textContent =
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  DOM.alarmLabel.textContent = 'Bitiş';
  DOM.circleTimerAlarm.style.color = '';

  state.circleInterval = setInterval(() => {
    if (!state.circleTimerActive || state.paused) return;

    const remaining = state.remainingSeconds;
    updateCircleTimer(remaining, totalSeconds);

    if (remaining <= 0) {
      clearInterval(state.circleInterval);
      DOM.circleTimerTime.textContent = '00:00:00';
      DOM.circleTimerLabel.textContent = 'Deneme Bitti';
      DOM.progressCircle.setAttribute('stroke-dashoffset', CIRCLE_CIRCUMFERENCE);
      DOM.alarmLabel.textContent = 'Süre doldu!';
      DOM.alarmTimeText.textContent = '';
      DOM.circleTimerAlarm.style.color = '#ffaab4';

      playAlarm();
      state.alarmPlaying = true;

      DOM.stopAlarmBtn.hidden = false;
      DOM.exitBtn.hidden = true;
    }
  }, 1000);
}

function playAlarm() {
  if (DOM.alarmSound) {
    DOM.alarmSound.play().catch(err => console.error('Alarm çalınamadı:', err));
  }
}

function stopAlarm() {
  if (DOM.alarmSound) {
    DOM.alarmSound.pause();
    DOM.alarmSound.currentTime = 0;
  }
  state.alarmPlaying = false;
  
  if (DOM.stopAlarmBtn) DOM.stopAlarmBtn.hidden = true;
  if (DOM.exitBtn) DOM.exitBtn.hidden = false;

  exitCircleTimer();
}

// Circle Timer Functions
function showCircleTimerScreen(totalSeconds) {
  DOM.mainContainer.style.display = 'none';
  DOM.circleTimerScreen.style.display = 'block';
  state.circleTimerActive = true;
  clearCircleTimerWarning();
  
  updateCircleTimer(totalSeconds, totalSeconds);
  
  // Alarm saati hesapla
  const now = new Date();
  now.setSeconds(now.getSeconds() + totalSeconds);
  const hour = now.getHours();
  const min = now.getMinutes();
  DOM.alarmTimeText.textContent = `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
  DOM.alarmLabel.textContent = 'Bitiş';
  DOM.circleTimerAlarm.style.color = '';
  
  // Start progress bar
  state.circleInterval = setInterval(() => {
    if (!state.circleTimerActive || state.paused) return;

    const remaining = state.remainingSeconds;
    updateCircleTimer(remaining, totalSeconds);

    if (remaining <= 0) {
      clearInterval(state.circleInterval);
      DOM.circleTimerTime.textContent = '00:00:00';
      DOM.circleTimerLabel.textContent = 'Deneme Bitti';
      DOM.progressCircle.setAttribute('stroke-dashoffset', CIRCLE_CIRCUMFERENCE);
      DOM.alarmLabel.textContent = 'Süre doldu!';
      DOM.alarmTimeText.textContent = '';
      DOM.circleTimerAlarm.style.color = '#ffaab4';
      
      playAlarm();
      state.alarmPlaying = true;
      
      DOM.stopAlarmBtn.hidden = false;
      DOM.exitBtn.hidden = true;
    }
  }, 1000);
}

function updateCircleTimer(remaining, total) {
  DOM.circleTimerTime.textContent = formatTime(remaining);
  
  // Update progress bar
  const progress = Math.max(0, remaining / total);
  DOM.progressCircle.setAttribute('stroke-dasharray', CIRCLE_CIRCUMFERENCE);
  DOM.progressCircle.setAttribute('stroke-dashoffset', CIRCLE_CIRCUMFERENCE * (1 - progress));
  DOM.progressCircle.classList.toggle('is-warning', remaining > 0 && remaining <= 60);
  DOM.progressCircle.classList.toggle('is-critical', remaining > 0 && remaining <= 10);
  
  // Update label
  if (remaining > 0) {
    DOM.circleTimerLabel.textContent = 'Deneme Başladı ✍️';
  }
}

function showCircleTimerWarning(remaining) {
  const warnings = {
    600: 'Sınavın bitmesine 10 dakikadan az kaldı.',
    300: 'Sınavın bitmesine 5 dakikadan az kaldı.'
  };
  const message = warnings[remaining];
  if (!message || !DOM.circleTimerWarning) return;

  if (remaining === 300) playWarningChime();
  if (state.warningTimeout) clearTimeout(state.warningTimeout);
  DOM.circleTimerWarning.textContent = message;
  DOM.circleTimerWarning.classList.toggle('is-final-warning', remaining === 300);
  DOM.circleTimerWarning.hidden = false;
  state.warningTimeout = setTimeout(clearCircleTimerWarning, 15000);
}

function prepareWarningAudio() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    console.error('Tarayıcı uyarı sesini desteklemiyor.');
    return;
  }

  try {
    if (!state.warningAudioContext) {
      state.warningAudioContext = new AudioContextConstructor();
    }
    if (state.warningAudioContext.state === 'suspended') {
      state.warningAudioContext.resume().catch(error => {
        console.error('Uyarı sesi etkinleştirilemedi:', error);
      });
    }
  } catch (error) {
    console.error('Uyarı sesi başlatılamadı:', error);
  }
}

function playWarningChime() {
  const context = state.warningAudioContext;
  if (!context) return;

  const playNotes = () => {
    const startAt = context.currentTime;
    [659.25, 783.99].forEach((frequency, index) => {
      const noteStart = startAt + index * 0.16;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.035, noteStart + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.3);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.31);
    });
  };

  if (context.state === 'suspended') {
    context.resume().then(playNotes).catch(error => {
      console.error('Uyarı sesi çalınamadı:', error);
    });
    return;
  }
  playNotes();
}

function clearCircleTimerWarning() {
  if (state.warningTimeout) {
    clearTimeout(state.warningTimeout);
    state.warningTimeout = null;
  }
  if (DOM.circleTimerWarning) {
    DOM.circleTimerWarning.hidden = true;
    DOM.circleTimerWarning.classList.remove('is-final-warning');
    DOM.circleTimerWarning.textContent = '';
  }
}

function exitCircleTimer() {
  state.circleTimerActive = false;
  clearCircleTimerWarning();
  
  if (state.circleInterval) {
    clearInterval(state.circleInterval);
    state.circleInterval = null;
  }
  
  exitFullscreen();
  
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  
  state.remainingSeconds = 0;
  updateDisplay(0);
  setControls({ start: true });
  
  if (state.alarmPlaying) {
    stopAlarm();
  }
  
  showCurrentTime();
  DOM.mainContainer.style.display = 'flex';
  DOM.circleTimerScreen.style.display = 'none';
}

// Fullscreen Functions
function requestFullscreen(element) {
  if (!element || document.fullscreenElement) return;

  try {
    let p;
    if (element.requestFullscreen) {
      p = element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      p = element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      p = element.msRequestFullscreen();
    }
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* user gesture yoksa sessizce yut */ });
    }
  } catch (err) {
    /* sessizce yut — daire ekran zaten tam viewport kaplıyor */
  }
}

function exitFullscreen() {
  if (!document.fullscreenElement) return;
  
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (err) {
    console.error('Tam ekrandan çıkılamadı:', err);
  }
}

function toggleFullscreen(e) {
  e.stopPropagation();

  const el = e.currentTarget.closest('#fullscreenBtnMain')
    ? DOM.mainContainer
    : DOM.circleTimerScreen;

  if (!document.fullscreenElement) {
    requestFullscreen(el);
  } else {
    exitFullscreen();
  }
}

// Preset Functions
function startPreset(h, m) {
  setPreset(h, m);
  startTimer();
}

// Select option population
function populateSelect(selectEl, max) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    frag.appendChild(opt);
  }
  selectEl.appendChild(frag);
}

// Schedule Functions
function scheduleExam() {
  const timeStr = DOM.scheduleTime.value;
  if (!timeStr) {
    showToast('Lütfen başlangıç saatini seçin.', 'error');
    return;
  }
  const [hh, mm] = timeStr.split(':').map(n => parseInt(n, 10));
  if (isNaN(hh) || isNaN(mm)) return;

  const typeVal = DOM.scheduleType.value;
  let presetH, presetM;

  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  // Eğer geçmişse yarına al
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  if (typeVal === 'manual') {
    const endStr = DOM.scheduleEnd && DOM.scheduleEnd.value;
    if (!endStr) {
      showToast('Lütfen bitiş saatini seçin.', 'error');
      return;
    }
    const [eh, em] = endStr.split(':').map(n => parseInt(n, 10));
    if (isNaN(eh) || isNaN(em)) return;
    const end = new Date(target);
    end.setHours(eh, em, 0, 0);
    // If the end time is before or equal to the start time, move it to the next day
    if (end.getTime() <= target.getTime()) {
      end.setDate(end.getDate() + 1);
    }
    const durMin = Math.round((end.getTime() - target.getTime()) / 60000);
    if (durMin <= 0) {
      showToast('Geçerli bir bitiş saati girin.', 'error');
      return;
    }
    presetH = Math.floor(durMin / 60);
    presetM = durMin % 60;
  } else {
    [presetH, presetM] = typeVal.split(':').map(n => parseInt(n, 10));
  }

  prepareWarningAudio();
  state.scheduleAt = target.getTime();
  state.scheduleHM = { h: presetH, m: presetM };

  DOM.scheduleStatus.hidden = false;
  DOM.scheduleBtn.disabled = true;
  DOM.scheduleTime.disabled = true;
  DOM.scheduleType.disabled = true;
  if (DOM.scheduleEnd) DOM.scheduleEnd.disabled = true;

  updateScheduleStatus();
  if (state.scheduleCheckInterval) clearInterval(state.scheduleCheckInterval);
  state.scheduleCheckInterval = setInterval(checkSchedule, 1000);

  // Kullanıcı gesture'ı varken fullscreen'e gir; saat gelince zaten fullscreen olacak.
  requestFullscreen(document.documentElement);
}

function updateScheduleStatus() {
  if (!state.scheduleAt) return;
  const remainingMs = state.scheduleAt - Date.now();
  if (remainingMs <= 0) {
    DOM.scheduleStatusText.textContent = 'Sınav başlıyor…';
    return;
  }
  const remainingSec = Math.ceil(remainingMs / 1000);
  const targetDate = new Date(state.scheduleAt);
  const targetStr =
    `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;
  DOM.scheduleStatusText.innerHTML =
    `<span class="schedule-start-info">Sınav <span class="schedule-start-time">${targetStr}</span>'de başlayacak</span><span class="schedule-remaining"><span class="schedule-label">Kalan süre</span><span class="schedule-countdown">${formatTime(remainingSec)}</span></span>`;
}

function checkSchedule() {
  if (!state.scheduleAt) return;
  updateScheduleStatus();
  if (Date.now() >= state.scheduleAt) {
    const { h, m } = state.scheduleHM || { h: 0, m: 0 };
    playWarningChime();
    cancelSchedule(true);
    startPreset(h, m);
  }
}

function cancelSchedule(silent) {
  if (state.scheduleCheckInterval) {
    clearInterval(state.scheduleCheckInterval);
    state.scheduleCheckInterval = null;
  }
  state.scheduleAt = null;
  state.scheduleHM = null;
  DOM.scheduleStatus.hidden = true;
  DOM.scheduleStatusText.textContent = '';
  DOM.scheduleBtn.disabled = false;
  DOM.scheduleTime.disabled = false;
  DOM.scheduleType.disabled = false;
  if (DOM.scheduleEnd) DOM.scheduleEnd.disabled = false;
}

function onScheduleTypeChange() {
  if (!DOM.scheduleEndField) return;
  const isManual = DOM.scheduleType.value === 'manual';
  DOM.scheduleEndField.style.display = isManual ? 'flex' : 'none';
}

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

// Event bindings
function bindEvents() {
  if (DOM.startBtn) DOM.startBtn.addEventListener('click', startTimer);
  if (DOM.pauseBtn) DOM.pauseBtn.addEventListener('click', togglePause);
  if (DOM.resetBtn) DOM.resetBtn.addEventListener('click', resetTimer);
  if (DOM.exitBtn) DOM.exitBtn.addEventListener('click', exitCircleTimer);
  if (DOM.stopAlarmBtn) DOM.stopAlarmBtn.addEventListener('click', stopAlarm);
  if (DOM.circlePauseBtn) DOM.circlePauseBtn.addEventListener('click', togglePause);
  if (DOM.circleResetBtn) DOM.circleResetBtn.addEventListener('click', resetTimer);
  if (DOM.fullscreenBtnMain) DOM.fullscreenBtnMain.addEventListener('click', toggleFullscreen);
  if (DOM.fullscreenBtn) DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);
  if (DOM.scheduleBtn) DOM.scheduleBtn.addEventListener('click', scheduleExam);
  if (DOM.scheduleType) DOM.scheduleType.addEventListener('change', onScheduleTypeChange);
  if (DOM.cancelScheduleBtn) DOM.cancelScheduleBtn.addEventListener('click', () => cancelSchedule(false));

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (DOM.presetButtons) {
    DOM.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const h = parseInt(btn.dataset.hour, 10) || 0;
        const m = parseInt(btn.dataset.minute, 10) || 0;
        startPreset(h, m);
      });
    });
  }
}

// Time Adjustment Functions
function adjustTime(seconds) {
  // Timer çalışmıyorsa dropdown değerlerini ayarla
  const currentH = parseInt(DOM.hourSelect.value) || 0;
  const currentM = parseInt(DOM.minuteSelect.value) || 0;
  let totalSeconds = currentH * 3600 + currentM * 60 + seconds;
  
  // Minimum 0, maksimum 5 saat 59 dakika
  totalSeconds = Math.max(0, Math.min(totalSeconds, 5 * 3600 + 59 * 60));
  
  const newH = Math.floor(totalSeconds / 3600);
  const newM = Math.floor((totalSeconds % 3600) / 60);
  
  DOM.hourSelect.value = newH;
  DOM.minuteSelect.value = newM;
  
  updateDisplay(totalSeconds);
}

function adjustCircleTime(seconds) {
  // Circle timer ekranında kalan süreyi ayarla
  if (state.circleTimerActive && state.timer) {
    state.remainingSeconds += seconds;
    state.remainingSeconds = Math.max(0, state.remainingSeconds);
    updateDisplay(state.remainingSeconds);
    updateCircleTimer(state.remainingSeconds, state.totalSeconds);
  }
}

// Initialization
function initDOM() {
  DOM.timerDisplay = document.getElementById('timerDisplay');
  DOM.dateDisplay = document.getElementById('dateDisplay');
  DOM.startBtn = document.getElementById('startBtn');
  DOM.pauseBtn = document.getElementById('pauseBtn');
  DOM.resetBtn = document.getElementById('resetBtn');
  DOM.hourSelect = document.getElementById('hour');
  DOM.minuteSelect = document.getElementById('minute');
  DOM.alarmSound = document.getElementById('alarmSound');
  DOM.mainContainer = document.getElementById('mainContainer');
  DOM.fullscreenBtnMain = document.getElementById('fullscreenBtnMain');
  DOM.fullscreenBtn = document.getElementById('fullscreenBtn');
  DOM.circleTimerScreen = document.getElementById('circleTimerScreen');
  DOM.circleTimerTime = document.getElementById('circleTimerTime');
  DOM.circleTimerLabel = document.getElementById('circleTimerLabel');
  DOM.circleTimerWarning = document.getElementById('circleTimerWarning');
  DOM.circleTimerAlarm = document.getElementById('circleTimerAlarm');
  DOM.alarmLabel = document.getElementById('alarmLabel');
  DOM.alarmTimeText = document.getElementById('alarmTimeText');
  DOM.progressCircle = document.getElementById('progressCircle');
  DOM.exitBtn = document.getElementById('exitBtn');
  DOM.stopAlarmBtn = document.getElementById('stopAlarmBtn');
  DOM.circlePauseBtn = document.getElementById('circlePauseBtn');
  DOM.circleResetBtn = document.getElementById('circleResetBtn');
  DOM.presetButtons = document.querySelectorAll('.preset-btns button[data-hour]');
  DOM.scheduleTime = document.getElementById('scheduleTime');
  DOM.scheduleType = document.getElementById('scheduleType');
  DOM.scheduleBtn = document.getElementById('scheduleBtn');
  DOM.scheduleStatus = document.getElementById('scheduleStatus');
  DOM.scheduleStatusText = document.getElementById('scheduleStatusText');
  DOM.cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
  DOM.scheduleEnd = document.getElementById('scheduleEnd');
  DOM.scheduleEndField = document.getElementById('scheduleEndField');
}

function init() {
  initDOM();
  if (DOM.hourSelect) populateSelect(DOM.hourSelect, MAX_HOUR);
  if (DOM.minuteSelect) populateSelect(DOM.minuteSelect, MAX_MINUTE);
  bindEvents();
  
  // Set initial display state for schedule end field
  if (DOM.scheduleEndField && DOM.scheduleType) {
    DOM.scheduleEndField.style.display = DOM.scheduleType.value === 'manual' ? 'flex' : 'none';
  }
  
  showCurrentTime();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
