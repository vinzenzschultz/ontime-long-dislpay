const isSecure = window.location.protocol === 'https:';
const userProvidedSocketUrl = `${isSecure ? 'wss' : 'ws'}://${window.location.host}${getStageHash()}/ws`;

connectSocket();

let reconnectTimeout;
const reconnectInterval = 1000;
let reconnectAttempts = 0;

function connectSocket(socketUrl = userProvidedSocketUrl) {
  const websocket = new WebSocket(socketUrl);

  websocket.onopen = () => {
    clearTimeout(reconnectTimeout);
    reconnectAttempts = 0;
    console.warn('WebSocket connected');
  };

  websocket.onclose = () => {
    console.warn('WebSocket disconnected');
    reconnectTimeout = setTimeout(() => {
      console.warn(`WebSocket: attempting reconnect ${reconnectAttempts}`);
      if (websocket && websocket.readyState === WebSocket.CLOSED) {
        reconnectAttempts += 1;
        connectSocket();
      }
    }, reconnectInterval);
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  websocket.onmessage = (event) => {
    const { tag, payload } = JSON.parse(event.data);
    if (tag === 'runtime-data') {
      handleOntimePayload(payload);
    }
  };
}

// DOM-Elemente
const projectEl      = document.getElementById('projekttitel');
const clockEl        = document.getElementById('clock');
const mainTimerEl    = document.getElementById('timer');
const auxEl          = document.getElementById('aux');
const progBar        = document.querySelector('.timer__progress-bar');
const nowEl          = document.getElementById('now');
const nextEl         = document.getElementById('next');
const timerTypeEl    = document.getElementById('timerType');
const container      = document.querySelector('.container');
const btn            = document.querySelector('.fullscreen-btn');
const uhr            = document.querySelector('.uhr');
const detailView     = document.querySelector('.event-detail-view');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const timerWrapper   = document.querySelector('.timer');
const auxWrapper     = document.querySelector('.aux-timer');

let lastClockMs      = 0;
let eventActive      = false;
let currentEventData = null;
let nextEventData    = null;

// Feld-Liste für die Detail-Ansicht
const detailFields = [
  { key: 'timeStart',   label: 'Time Start',   fmt: v => formatClock(v) },
  { key: 'timeEnd',     label: 'Time End',     fmt: v => formatClock(v) },
  { key: 'endAction',   label: 'End Action' },
  { key: 'timerType',   label: 'Timer Type' },
  { key: 'note',        label: 'Note' },
  { key: 'delay',       label: 'Delay' },
  { key: 'cue',         label: 'Cue' },
  { key: 'timeWarning', label: 'Time Warning', fmt: v => formatClock(v) },
  { key: 'timeDanger',  label: 'Time Danger',  fmt: v => formatClock(v) },
];

function refreshDetailView(isNow) {
  let leftHtml = `
    <h2 class="detail-header">
      Aktuelles Event:
      <span class="event-title" style="background:${currentEventData?.colour || '#444'};">
        ${currentEventData?.title || '--'}
      </span>
    </h2>
  `;
  if (currentEventData) {
    detailFields.forEach(fld => {
      if (currentEventData[fld.key] != null) {
        const raw = currentEventData[fld.key];
        const val = fld.fmt ? fld.fmt(raw) : raw;
        leftHtml += `
          <div class="field">
            <span class="field-label">${fld.label}:</span>
            <span class="field-value">${val}</span>
          </div>`;
      }
    });
  } else {
    leftHtml += `<p>Keine Event-Daten verfügbar.</p>`;
  }
  document.getElementById('eventDetail').innerHTML = leftHtml;

  let rightHtml = `
    <h2 class="detail-header">
      Nächstes Event:
      <span class="event-title" style="background:${nextEventData?.colour || '#444'};">
        ${nextEventData?.title || '--'}
      </span>
    </h2>
  `;
  if (nextEventData) {
    detailFields.forEach(fld => {
      if (nextEventData[fld.key] != null) {
        const raw = nextEventData[fld.key];
        const val = fld.fmt ? fld.fmt(raw) : raw;
        rightHtml += `
          <div class="field">
            <span class="field-label">${fld.label}:</span>
            <span class="field-value">${val}</span>
          </div>`;
      }
    });
  } else {
    rightHtml += `<p>Keine weiteren Events.</p>`;
  }
  document.getElementById('eventList').innerHTML = rightHtml;
}

// UI-Listener
btn.addEventListener('click', () => {
  if (container.classList.contains('swapaux')) {
    container.classList.remove('swapaux');
  }
  container.classList.toggle('fullscreen');
});
uhr.addEventListener('click',       () => container.classList.toggle('fullscreenuhr'));
auxEl.addEventListener('click',     () => container.classList.toggle('swapaux'));
auxWrapper.addEventListener('click', () => container.classList.toggle('swapaux'));
timerWrapper.addEventListener('click', () => {
  if (container.classList.contains('swapaux')) {
    container.classList.remove('swapaux');
  }
});

[nowEl, nextEl].forEach(el =>
  el.addEventListener('click', () => {
    const isNow = (el === nowEl);
    refreshDetailView(isNow);
    container.classList.add('fullevent');
  })
);

closeDetailBtn.addEventListener('click', () => {
  container.classList.remove('fullevent');
});

// Projekt-Titel beim Start laden
fetch('/data/project')
  .then(r => r.json())
  .then(d => {
    const pr = d.payload || d;
    projectEl.textContent = pr.title || pr.name || '--';
  })
  .catch(() => {});

function handleOntimePayload(payload) {
  if ('clock' in payload) {
    lastClockMs = payload.clock;
    clockEl.textContent = formatClock(lastClockMs);
    if (!eventActive) {
      mainTimerEl.textContent = formatClock(lastClockMs);
    }
  }

  if ('eventNow' in payload) {
    const p = payload.eventNow;
    if (p != null) {
      nowEl.textContent = p.title || p.name || '--';
      eventActive = !!(p.title || p.name);
      currentEventData = p;
      if (container.classList.contains('fullevent')) {
        refreshDetailView(true);
      }
      if (!eventActive) {
        mainTimerEl.textContent = formatClock(lastClockMs);
        progBar.style.width = '0';
        mainTimerEl.classList.remove('warning', 'overtime');
      }
    } else {
      nowEl.textContent = '--';
      eventActive = false;
      currentEventData = null;
      mainTimerEl.textContent = formatClock(lastClockMs);
      progBar.style.width = '0';
      mainTimerEl.classList.remove('warning', 'overtime');
    }
  }

  if ('eventNext' in payload) {
    const p = payload.eventNext;
    if (p != null) {
      nextEl.textContent = p.title || p.name || '--';
      nextEventData = p;
      if (container.classList.contains('fullevent')) {
        refreshDetailView(false);
      }
    } else {
      nextEl.textContent = '--';
      nextEventData = null;
    }
  }

  if ('timer' in payload) {
    const { current, duration, elapsed, playback } = payload.timer;
    const displayType = (currentEventData?.timerType || 'none').toLowerCase();
    timerTypeEl.textContent = displayType;

    if (playback === 'stop' || !eventActive) {
      mainTimerEl.textContent = formatClock(lastClockMs);
      progBar.style.width = '0';
      mainTimerEl.classList.remove('warning', 'overtime');
    } else if (displayType === 'count-up') {
      mainTimerEl.textContent = formatTime(elapsed);
      progBar.style.width = duration > 0 ? `${Math.min(elapsed / duration * 100, 100)}%` : '0';
      mainTimerEl.classList.remove('warning', 'overtime');
    } else if (displayType === 'count-down' || displayType === 'none') {
      const rem = current;
      const warnThreshold   = currentEventData?.timeWarning ?? 60000;
      const dangerThreshold = currentEventData?.timeDanger  ?? 0;
      mainTimerEl.textContent = formatTime(rem);
      progBar.style.width = duration > 0 ? `${Math.min(elapsed / duration * 100, 100)}%` : '0';
      mainTimerEl.classList.toggle('warning',  rem <= warnThreshold && rem > dangerThreshold);
      mainTimerEl.classList.toggle('overtime', rem <= dangerThreshold);
    } else {
      mainTimerEl.textContent = formatClock(lastClockMs);
      progBar.style.width = '0';
      mainTimerEl.classList.remove('warning', 'overtime');
    }
  }

  if ('auxtimer' in payload && payload.auxtimer?.current != null) {
    auxEl.textContent = formatTime(payload.auxtimer.current);
  }
}

// Helper-Funktionen
function leftPad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(ms) {
  const sign = ms < 0 ? '-' : '';
  const sec = Math.abs(Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600),
        m = Math.floor(sec / 60) % 60,
        s = sec % 60;
  return sign + (h > 0
    ? `${leftPad(h)}:${leftPad(m)}:${leftPad(s)}`
    : `${leftPad(m)}:${leftPad(s)}`);
}

function formatClock(ms) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${leftPad(h)}:${leftPad(m)}:${leftPad(s)}`;
}

function getStageHash() {
  const href = window.location.href;
  if (!href.includes('getontime.no')) {
    return '';
  }
  const hash = href.split('/');
  const stageHash = hash.at(3);
  return stageHash ? `/${stageHash}` : '';
}
