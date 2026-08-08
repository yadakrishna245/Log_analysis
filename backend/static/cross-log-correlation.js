(function() {
  'use strict';

  var STYLE_ID = 'logsherlock-cross-log-correlation-style';

  var CSS = `
    .clc-panel { border: 1px solid #334155; border-radius: 8px; margin: 12px 0; background: #1e293b; font-family: 'Segoe UI', sans-serif; }
    .clc-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #0f172a; border-radius: 8px 8px 0 0; user-select: none; }
    .clc-header h3 { margin: 0; color: #e2e8f0; font-size: 15px; }
    .clc-header .clc-toggle { color: #94a3b8; font-size: 18px; transition: transform 0.2s; }
    .clc-header .clc-toggle.collapsed { transform: rotate(-90deg); }
    .clc-body { padding: 16px; display: block; }
    .clc-body.hidden { display: none; }
    .clc-upload-area { border: 2px dashed #475569; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 12px; }
    .clc-upload-area label { color: #94a3b8; cursor: pointer; }
    .clc-upload-area input[type="file"] { display: none; }
    .clc-config { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .clc-config label { color: #94a3b8; font-size: 13px; }
    .clc-config input[type="number"] { width: 60px; padding: 4px 6px; border: 1px solid #475569; border-radius: 4px; background: #0f172a; color: #e2e8f0; font-size: 13px; }
    .clc-file-list { margin-bottom: 12px; }
    .clc-file-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; margin: 2px 4px 2px 0; color: #fff; }
    .clc-timeline { max-height: 400px; overflow-y: auto; }
    .clc-event { display: flex; align-items: flex-start; gap: 10px; padding: 6px 10px; border-left: 3px solid #475569; margin-bottom: 4px; font-size: 13px; }
    .clc-event .clc-ts { color: #94a3b8; white-space: nowrap; min-width: 160px; }
    .clc-event .clc-src { font-size: 11px; padding: 1px 5px; border-radius: 3px; color: #fff; white-space: nowrap; }
    .clc-event .clc-text { color: #e2e8f0; word-break: break-word; }
    .clc-cluster { border: 1px solid #f59e0b; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: rgba(245,158,11,0.05); }
    .clc-cluster-label { font-size: 12px; color: #f59e0b; margin-bottom: 4px; font-weight: 600; }
    .clc-no-data { color: #64748b; text-align: center; padding: 20px; font-style: italic; }
    .clc-btn { padding: 6px 14px; border: none; border-radius: 4px; background: #3b82f6; color: #fff; cursor: pointer; font-size: 13px; }
    .clc-btn:hover { background: #2563eb; }
  `;

  var FILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  function injectStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function parseTimestamp(str) {
    if (!str) return null;
    str = str.trim();
    // Epoch seconds or milliseconds
    if (/^\d{10}$/.test(str)) return new Date(parseInt(str, 10) * 1000);
    if (/^\d{13}$/.test(str)) return new Date(parseInt(str, 10));
    // ISO8601
    var iso = Date.parse(str);
    if (!isNaN(iso)) return new Date(iso);
    return null;
  }

  function extractTimestampFromLine(line) {
    if (!line) return null;
    // ISO8601 pattern
    var isoMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/);
    if (isoMatch) return parseTimestamp(isoMatch[0]);
    // Syslog: Mon DD HH:MM:SS
    var syslogMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/);
    if (syslogMatch) {
      var months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
      var now = new Date();
      var d = new Date(now.getFullYear(), months[syslogMatch[1]], parseInt(syslogMatch[2]), parseInt(syslogMatch[3].split(':')[0]), parseInt(syslogMatch[3].split(':')[1]), parseInt(syslogMatch[3].split(':')[2]));
      return d;
    }
    // Epoch at start
    var epochMatch = line.match(/^(\d{10,13})\b/);
    if (epochMatch) return parseTimestamp(epochMatch[1]);
    return null;
  }

  function parseUploadedFile(text, fileName) {
    var lines = text.split('\n');
    var events = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var ts = extractTimestampFromLine(line);
      if (ts) {
        events.push({ timestamp: ts, text: line, file: fileName, line: i + 1 });
      }
    }
    return events;
  }

  function findClusters(allEvents, windowSec) {
    if (allEvents.length === 0) return [];
    var sorted = allEvents.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
    var clusters = [];
    var current = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      var diff = (sorted[i].timestamp - current[current.length - 1].timestamp) / 1000;
      if (diff <= windowSec) {
        current.push(sorted[i]);
      } else {
        if (current.length > 1) {
          var sources = {};
          current.forEach(function(e) { sources[e.file] = true; });
          if (Object.keys(sources).length > 1) {
            clusters.push(current.slice());
          }
        }
        current = [sorted[i]];
      }
    }
    if (current.length > 1) {
      var sources2 = {};
      current.forEach(function(e) { sources2[e.file] = true; });
      if (Object.keys(sources2).length > 1) {
        clusters.push(current.slice());
      }
    }
    return clusters;
  }

  window.renderCrossLogCorrelationPanel = function(findings) {
    injectStyle();

    var container = document.createElement('div');
    container.className = 'clc-panel';

    var collapsed = false;
    var uploadedFiles = {};
    var fileColorMap = {};
    var colorIdx = 1; // 0 reserved for main findings
    fileColorMap['__main__'] = FILE_COLORS[0];

    function getFileColor(name) {
      if (!fileColorMap[name]) {
        fileColorMap[name] = FILE_COLORS[colorIdx % FILE_COLORS.length];
        colorIdx++;
      }
      return fileColorMap[name];
    }

    function getAllEvents() {
      var events = [];
      // Main findings
      if (findings && findings.length) {
        findings.forEach(function(f) {
          var ts = f.timestamp ? parseTimestamp(f.timestamp) : null;
          if (ts) {
            events.push({ timestamp: ts, text: f.text || '', file: f.file || '__main__', line: f.line });
          }
        });
      }
      // Uploaded files
      Object.keys(uploadedFiles).forEach(function(name) {
        uploadedFiles[name].forEach(function(e) {
          events.push(e);
        });
      });
      return events;
    }

    function render() {
      var windowSec = 5;
      var windowInput = container.querySelector('.clc-window-input');
      if (windowInput) windowSec = parseInt(windowInput.value, 10) || 5;

      container.innerHTML = '';

      // Header
      var header = document.createElement('div');
      header.className = 'clc-header';
      header.innerHTML = '<h3>\uD83D\uDD17 Cross-Log Correlation</h3><span class="clc-toggle ' + (collapsed ? 'collapsed' : '') + '">\u25BC</span>';
      header.addEventListener('click', function() {
        collapsed = !collapsed;
        render();
      });
      container.appendChild(header);

      if (collapsed) return;

      var body = document.createElement('div');
      body.className = 'clc-body';

      // Upload area
      var uploadArea = document.createElement('div');
      uploadArea.className = 'clc-upload-area';
      uploadArea.innerHTML = '<label>📁 Click to upload additional log files for correlation<input type="file" class="clc-file-input" multiple accept=".log,.txt,.json,.csv"></label>';
      body.appendChild(uploadArea);

      // Config
      var config = document.createElement('div');
      config.className = 'clc-config';
      config.innerHTML = '<label>Time window (±sec):</label><input type="number" class="clc-window-input" value="' + windowSec + '" min="1" max="300">';
      body.appendChild(config);

      // File list
      var fileNames = Object.keys(uploadedFiles);
      if (fileNames.length > 0) {
        var fileList = document.createElement('div');
        fileList.className = 'clc-file-list';
        fileList.innerHTML = '<span style="color:#94a3b8;font-size:12px;">Uploaded: </span>';
        fileNames.forEach(function(name) {
          var tag = document.createElement('span');
          tag.className = 'clc-file-tag';
          tag.style.background = getFileColor(name);
          tag.textContent = name + ' (' + uploadedFiles[name].length + ' events)';
          fileList.appendChild(tag);
        });
        body.appendChild(fileList);
      }

      // Correlate button
      var btn = document.createElement('button');
      btn.className = 'clc-btn';
      btn.textContent = 'Correlate';
      body.appendChild(btn);

      // Timeline area
      var timelineDiv = document.createElement('div');
      timelineDiv.className = 'clc-timeline';
      body.appendChild(timelineDiv);

      // Render timeline
      var allEvents = getAllEvents();
      if (allEvents.length === 0) {
        timelineDiv.innerHTML = '<div class="clc-no-data">No timestamped events to correlate. Upload log files or ensure findings have timestamps.</div>';
      } else {
        var sorted = allEvents.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
        var clusters = findClusters(allEvents, windowSec);

        if (clusters.length > 0) {
          clusters.forEach(function(cluster, ci) {
            var clusterDiv = document.createElement('div');
            clusterDiv.className = 'clc-cluster';
            clusterDiv.innerHTML = '<div class="clc-cluster-label">\u26A1 Correlation Cluster #' + (ci + 1) + ' (' + cluster.length + ' events within \u00B1' + windowSec + 's)</div>';
            cluster.forEach(function(ev) {
              var eventDiv = document.createElement('div');
              eventDiv.className = 'clc-event';
              eventDiv.innerHTML = '<span class="clc-ts">' + ev.timestamp.toISOString() + '</span>' +
                '<span class="clc-src" style="background:' + getFileColor(ev.file) + '">' + (ev.file === '__main__' ? 'main' : ev.file) + '</span>' +
                '<span class="clc-text">' + (ev.text.length > 120 ? ev.text.substring(0, 120) + '...' : ev.text) + '</span>';
              clusterDiv.appendChild(eventDiv);
            });
            timelineDiv.appendChild(clusterDiv);
          });
        }

        // Full timeline
        var tlLabel = document.createElement('div');
        tlLabel.style.cssText = 'color:#94a3b8;font-size:12px;margin:10px 0 4px;';
        tlLabel.textContent = '\uD83D\uDCC5 Unified Timeline (' + sorted.length + ' events)';
        timelineDiv.appendChild(tlLabel);

        sorted.slice(0, 200).forEach(function(ev) {
          var eventDiv = document.createElement('div');
          eventDiv.className = 'clc-event';
          eventDiv.style.borderLeftColor = getFileColor(ev.file);
          eventDiv.innerHTML = '<span class="clc-ts">' + ev.timestamp.toISOString() + '</span>' +
            '<span class="clc-src" style="background:' + getFileColor(ev.file) + '">' + (ev.file === '__main__' ? 'main' : ev.file) + '</span>' +
            '<span class="clc-text">' + (ev.text.length > 120 ? ev.text.substring(0, 120) + '...' : ev.text) + '</span>';
          timelineDiv.appendChild(eventDiv);
        });

        if (sorted.length > 200) {
          var more = document.createElement('div');
          more.style.cssText = 'color:#64748b;text-align:center;padding:8px;font-size:12px;';
          more.textContent = '... and ' + (sorted.length - 200) + ' more events';
          timelineDiv.appendChild(more);
        }
      }

      container.appendChild(body);

      // Event listeners
      var fileInput = container.querySelector('.clc-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', function(e) {
          var files = e.target.files;
          if (!files || files.length === 0) return;
          var remaining = files.length;
          for (var i = 0; i < files.length; i++) {
            (function(file) {
              var reader = new FileReader();
              reader.onload = function(ev) {
                var events = parseUploadedFile(ev.target.result, file.name);
                uploadedFiles[file.name] = events;
                remaining--;
                if (remaining === 0) render();
              };
              reader.readAsText(file);
            })(files[i]);
          }
        });
      }

      var correlateBtn = container.querySelector('.clc-btn');
      if (correlateBtn) {
        correlateBtn.addEventListener('click', function() {
          render();
        });
      }
    }

    render();
    return container;
  };

})();
