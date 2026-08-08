/**
 * LogSherlock Pro — Log Playback (Time-Travel Debugger)
 * Animated timeline replay of log events with play/pause/rewind.
 * Shows events appearing in chronological order to reveal causal ordering.
 * ZERO fake data — only real findings with parseable timestamps.
 */
(function () {
  if (typeof window === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function () {

    // --- Timestamp Parsing ---
    const SYSLOG_MONTHS = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    function parseLogTimestamp(raw) {
      if (!raw || typeof raw !== 'string') return null;
      const trimmed = raw.trim();

      // Try ISO 8601 first
      const isoDate = new Date(trimmed);
      if (!isNaN(isoDate.getTime()) && trimmed.match(/\d{4}-\d{2}-\d{2}/)) {
        return isoDate;
      }

      // Try syslog format: "Mon DD HH:MM:SS" or "Mon  D HH:MM:SS"
      const syslogMatch = trimmed.match(
        /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/
      );
      if (syslogMatch) {
        const month = SYSLOG_MONTHS[syslogMatch[1]];
        if (month !== undefined) {
          const now = new Date();
          const d = new Date(
            now.getFullYear(),
            month,
            parseInt(syslogMatch[2], 10),
            parseInt(syslogMatch[3], 10),
            parseInt(syslogMatch[4], 10),
            parseInt(syslogMatch[5], 10)
          );
          if (!isNaN(d.getTime())) return d;
        }
      }

      // Try epoch (seconds or milliseconds)
      const epochNum = Number(trimmed);
      if (!isNaN(epochNum) && epochNum > 0) {
        // If < 1e12, treat as seconds; otherwise milliseconds
        const ms = epochNum < 1e12 ? epochNum * 1000 : epochNum;
        const epochDate = new Date(ms);
        if (!isNaN(epochDate.getTime())) return epochDate;
      }

      // Fallback: try native Date parse for other formats
      const fallback = new Date(trimmed);
      if (!isNaN(fallback.getTime())) return fallback;

      return null;
    }

    // --- Severity Badge Color ---
    function getSeverityColor(severity) {
      if (!severity) return '#6c757d';
      const s = severity.toLowerCase();
      if (s === 'critical' || s === 'fatal') return '#ff4444';
      if (s === 'error' || s === 'high') return '#ff6b6b';
      if (s === 'warning' || s === 'warn' || s === 'medium') return '#ffa726';
      if (s === 'info' || s === 'low') return '#29b6f6';
      if (s === 'debug') return '#78909c';
      return '#6c757d';
    }

    // --- Styles ---
    function injectStyles() {
      if (document.getElementById('log-playback-styles')) return;
      const style = document.createElement('style');
      style.id = 'log-playback-styles';
      style.textContent = `
        .lsp-playback-panel {
          background: #1e1e2e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #e0e0e0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .lsp-playback-title {
          font-size: 1.4em;
          font-weight: 700;
          color: #01a982;
          margin-bottom: 16px;
        }
        .lsp-playback-empty {
          color: #888;
          font-style: italic;
          padding: 20px 0;
        }
        .lsp-playback-stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 14px;
          font-size: 0.85em;
          color: #aaa;
        }
        .lsp-playback-stats span {
          background: #2a2a3e;
          padding: 4px 10px;
          border-radius: 4px;
        }
        .lsp-playback-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .lsp-playback-btn {
          background: #2a2a3e;
          border: 1px solid #444;
          color: #e0e0e0;
          padding: 6px 14px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          transition: background 0.2s, border-color 0.2s;
        }
        .lsp-playback-btn:hover {
          background: #01a982;
          border-color: #01a982;
          color: #1e1e2e;
        }
        .lsp-playback-btn.active {
          background: #01a982;
          border-color: #01a982;
          color: #1e1e2e;
        }
        .lsp-playback-speed-select {
          background: #2a2a3e;
          border: 1px solid #444;
          color: #e0e0e0;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 0.9em;
          cursor: pointer;
        }
        .lsp-playback-progress-container {
          width: 100%;
          height: 8px;
          background: #2a2a3e;
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .lsp-playback-progress-bar {
          height: 100%;
          background: #01a982;
          border-radius: 4px;
          transition: width 0.15s ease;
          width: 0%;
        }
        .lsp-playback-time-display {
          font-size: 0.85em;
          color: #01a982;
          margin-bottom: 12px;
          min-height: 1.2em;
        }
        .lsp-playback-feed {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #333;
          border-radius: 6px;
          background: #16161e;
          padding: 8px;
        }
        .lsp-playback-feed::-webkit-scrollbar {
          width: 6px;
        }
        .lsp-playback-feed::-webkit-scrollbar-track {
          background: #16161e;
        }
        .lsp-playback-feed::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 3px;
        }
        .lsp-playback-event {
          padding: 8px 10px;
          border-bottom: 1px solid #2a2a3e;
          animation: lsp-fade-in 0.3s ease;
        }
        .lsp-playback-event:last-child {
          border-bottom: none;
        }
        @keyframes lsp-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lsp-playback-event-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .lsp-playback-event-ts {
          font-size: 0.78em;
          color: #888;
          font-family: monospace;
        }
        .lsp-playback-event-severity {
          font-size: 0.72em;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .lsp-playback-event-pattern {
          font-size: 0.82em;
          color: #01a982;
          font-weight: 500;
        }
        .lsp-playback-event-file {
          font-size: 0.75em;
          color: #666;
        }
        .lsp-playback-event-line {
          font-size: 0.8em;
          color: #bbb;
          font-family: monospace;
          margin-top: 3px;
          word-break: break-all;
        }
      `;
      document.head.appendChild(style);
    }

    // --- Main Render Function ---
    function renderLogPlaybackPanel(findings) {
      injectStyles();

      const panel = document.createElement('div');
      panel.className = 'lsp-playback-panel';

      // Title
      const title = document.createElement('div');
      title.className = 'lsp-playback-title';
      title.textContent = '⏪ Log Playback — Time-Travel Debugger';
      panel.appendChild(title);

      // Filter and parse findings with valid timestamps
      if (!findings || !Array.isArray(findings) || findings.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lsp-playback-empty';
        empty.textContent = 'No findings with parseable timestamps available for playback.';
        panel.appendChild(empty);
        return panel;
      }

      const parsedEvents = [];
      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const ts = parseLogTimestamp(f.log_timestamp);
        if (ts) {
          parsedEvents.push({
            timestamp: ts,
            severity: f.severity || f.level || 'unknown',
            pattern: f.pattern_name || f.pattern || f.rule || 'Unknown Pattern',
            file: f.file || f.source_file || f.filename || 'unknown',
            line: f.line_content || f.line || f.message || '',
            rawTimestamp: f.log_timestamp
          });
        }
      }

      if (parsedEvents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lsp-playback-empty';
        empty.textContent = 'No findings with parseable timestamps available for playback.';
        panel.appendChild(empty);
        return panel;
      }

      // Sort by timestamp ascending
      parsedEvents.sort(function (a, b) {
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      // Compute time deltas
      const timeDeltas = [0];
      for (let i = 1; i < parsedEvents.length; i++) {
        const delta = parsedEvents[i].timestamp.getTime() - parsedEvents[i - 1].timestamp.getTime();
        timeDeltas.push(Math.max(delta, 0));
      }

      const firstTs = parsedEvents[0].timestamp;
      const lastTs = parsedEvents[parsedEvents.length - 1].timestamp;

      // --- Stats ---
      const stats = document.createElement('div');
      stats.className = 'lsp-playback-stats';
      stats.innerHTML =
        '<span>📊 Total Events: ' + parsedEvents.length + '</span>' +
        '<span>🕐 Range: ' + firstTs.toLocaleString() + ' → ' + lastTs.toLocaleString() + '</span>' +
        '<span class="lsp-playback-progress-text">▶ Progress: 0 / ' + parsedEvents.length + '</span>';
      panel.appendChild(stats);

      // --- Playback State ---
      var playbackState = { playing: false, speed: 1, currentIndex: 0, timeoutId: null };

      // --- Controls ---
      const controls = document.createElement('div');
      controls.className = 'lsp-playback-controls';

      const btnRewind = document.createElement('button');
      btnRewind.className = 'lsp-playback-btn';
      btnRewind.textContent = '⏪ Rewind';

      const btnPlay = document.createElement('button');
      btnPlay.className = 'lsp-playback-btn';
      btnPlay.textContent = '▶️ Play';

      const btnPause = document.createElement('button');
      btnPause.className = 'lsp-playback-btn';
      btnPause.textContent = '⏸️ Pause';

      const btnFastForward = document.createElement('button');
      btnFastForward.className = 'lsp-playback-btn';
      btnFastForward.textContent = '⏩ Fast Forward';

      const speedLabel = document.createElement('span');
      speedLabel.style.color = '#aaa';
      speedLabel.style.fontSize = '0.85em';
      speedLabel.textContent = 'Speed:';

      const speedSelect = document.createElement('select');
      speedSelect.className = 'lsp-playback-speed-select';
      [1, 2, 5, 10].forEach(function (s) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + 'x';
        speedSelect.appendChild(opt);
      });

      controls.appendChild(btnRewind);
      controls.appendChild(btnPlay);
      controls.appendChild(btnPause);
      controls.appendChild(btnFastForward);
      controls.appendChild(speedLabel);
      controls.appendChild(speedSelect);
      panel.appendChild(controls);

      // --- Progress Bar ---
      const progressContainer = document.createElement('div');
      progressContainer.className = 'lsp-playback-progress-container';
      const progressBar = document.createElement('div');
      progressBar.className = 'lsp-playback-progress-bar';
      progressContainer.appendChild(progressBar);
      panel.appendChild(progressContainer);

      // --- Time Display ---
      const timeDisplay = document.createElement('div');
      timeDisplay.className = 'lsp-playback-time-display';
      timeDisplay.textContent = '⏱ Ready to play...';
      panel.appendChild(timeDisplay);

      // --- Event Feed ---
      const feed = document.createElement('div');
      feed.className = 'lsp-playback-feed';
      panel.appendChild(feed);

      // --- Helpers ---
      function formatTimestamp(date) {
        return date.toLocaleString();
      }

      function truncateLine(line, max) {
        if (!line) return '';
        return line.length > max ? line.substring(0, max) + '…' : line;
      }

      function updateProgress() {
        const pct = parsedEvents.length > 0
          ? (playbackState.currentIndex / parsedEvents.length) * 100
          : 0;
        progressBar.style.width = pct + '%';
        const progressText = stats.querySelector('.lsp-playback-progress-text');
        if (progressText) {
          progressText.textContent = '▶ Progress: ' + playbackState.currentIndex + ' / ' + parsedEvents.length;
        }
      }

      function renderEvent(evt) {
        const div = document.createElement('div');
        div.className = 'lsp-playback-event';

        const header = document.createElement('div');
        header.className = 'lsp-playback-event-header';

        const tsSpan = document.createElement('span');
        tsSpan.className = 'lsp-playback-event-ts';
        tsSpan.textContent = formatTimestamp(evt.timestamp);

        const sevBadge = document.createElement('span');
        sevBadge.className = 'lsp-playback-event-severity';
        const sevColor = getSeverityColor(evt.severity);
        sevBadge.style.background = sevColor + '22';
        sevBadge.style.color = sevColor;
        sevBadge.style.border = '1px solid ' + sevColor;
        sevBadge.textContent = evt.severity;

        const patternSpan = document.createElement('span');
        patternSpan.className = 'lsp-playback-event-pattern';
        patternSpan.textContent = evt.pattern;

        const fileSpan = document.createElement('span');
        fileSpan.className = 'lsp-playback-event-file';
        fileSpan.textContent = evt.file;

        header.appendChild(tsSpan);
        header.appendChild(sevBadge);
        header.appendChild(patternSpan);
        header.appendChild(fileSpan);
        div.appendChild(header);

        if (evt.line) {
          const lineDiv = document.createElement('div');
          lineDiv.className = 'lsp-playback-event-line';
          lineDiv.textContent = truncateLine(evt.line, 100);
          div.appendChild(lineDiv);
        }

        feed.appendChild(div);
        feed.scrollTop = feed.scrollHeight;
      }

      function updateTimeDisplay(index) {
        if (index >= 0 && index < parsedEvents.length) {
          timeDisplay.textContent = '⏱ ' + formatTimestamp(parsedEvents[index].timestamp);
        } else if (index >= parsedEvents.length) {
          timeDisplay.textContent = '⏱ Playback complete';
        }
      }

      function showEventsUpTo(index) {
        feed.innerHTML = '';
        const end = Math.min(index, parsedEvents.length);
        for (var i = 0; i < end; i++) {
          renderEvent(parsedEvents[i]);
        }
        playbackState.currentIndex = end;
        updateProgress();
        if (end > 0) {
          updateTimeDisplay(end - 1);
        }
      }

      function stopPlayback() {
        playbackState.playing = false;
        if (playbackState.timeoutId) {
          clearTimeout(playbackState.timeoutId);
          playbackState.timeoutId = null;
        }
        btnPlay.classList.remove('active');
      }

      function playNext() {
        if (!playbackState.playing) return;
        if (playbackState.currentIndex >= parsedEvents.length) {
          stopPlayback();
          updateTimeDisplay(parsedEvents.length);
          return;
        }

        renderEvent(parsedEvents[playbackState.currentIndex]);
        updateTimeDisplay(playbackState.currentIndex);
        playbackState.currentIndex++;
        updateProgress();

        if (playbackState.currentIndex < parsedEvents.length) {
          // Calculate delay based on actual time delta
          var rawDelay = timeDeltas[playbackState.currentIndex] / playbackState.speed;
          // Cap maximum delay at 3 seconds for usability, minimum 100ms
          var delay = Math.max(100, Math.min(rawDelay, 3000));
          playbackState.timeoutId = setTimeout(playNext, delay);
        } else {
          stopPlayback();
          updateTimeDisplay(parsedEvents.length);
        }
      }

      // --- Event Handlers ---
      btnPlay.addEventListener('click', function () {
        if (playbackState.playing) return;
        if (playbackState.currentIndex >= parsedEvents.length) {
          // Reset if at end
          feed.innerHTML = '';
          playbackState.currentIndex = 0;
          updateProgress();
        }
        playbackState.playing = true;
        btnPlay.classList.add('active');
        playNext();
      });

      btnPause.addEventListener('click', function () {
        stopPlayback();
      });

      btnRewind.addEventListener('click', function () {
        stopPlayback();
        feed.innerHTML = '';
        playbackState.currentIndex = 0;
        updateProgress();
        timeDisplay.textContent = '⏱ Ready to play...';
      });

      btnFastForward.addEventListener('click', function () {
        stopPlayback();
        showEventsUpTo(parsedEvents.length);
        updateTimeDisplay(parsedEvents.length - 1);
      });

      speedSelect.addEventListener('change', function () {
        playbackState.speed = parseInt(speedSelect.value, 10) || 1;
      });

      // Progress bar seek
      progressContainer.addEventListener('click', function (e) {
        var rect = progressContainer.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var pct = clickX / rect.width;
        var targetIndex = Math.round(pct * parsedEvents.length);
        targetIndex = Math.max(0, Math.min(targetIndex, parsedEvents.length));

        stopPlayback();
        showEventsUpTo(targetIndex);
      });

      return panel;
    }

    // Export
    window.renderLogPlaybackPanel = renderLogPlaybackPanel;
  });
})();
