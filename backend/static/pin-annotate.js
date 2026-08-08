/**
 * LogSherlock Pro — Pin & Annotate Findings
 * Lets engineers pin (bookmark) any finding and add free-text annotations.
 * Storage: localStorage key 'logsherlock_pins'
 * Dark theme: #1e1e2e background, #01a982 green accent
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_pins';
  const PANEL_ID = 'logsherlock-pinned-panel';
  const STYLE_ID = 'logsherlock-pin-styles';

  // ─── Storage Helpers ───────────────────────────────────────────────────────

  function getPins() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[LogSherlock Pin] Failed to read pins:', e);
      return [];
    }
  }

  function savePins(pins) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (e) {
      console.error('[LogSherlock Pin] Failed to save pins:', e);
    }
  }

  function generateId(patternName, file, lineNumber) {
    const str = `${patternName}|${file}|${lineNumber}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'pin_' + Math.abs(hash).toString(36);
  }

  function isPinned(id) {
    return getPins().some(function (p) { return p.id === id; });
  }

  function addPin(pinData) {
    const pins = getPins();
    if (!pins.some(function (p) { return p.id === pinData.id; })) {
      pins.push(pinData);
      savePins(pins);
    }
  }

  function removePin(id) {
    const pins = getPins().filter(function (p) { return p.id !== id; });
    savePins(pins);
  }

  function updateAnnotation(id, annotation) {
    const pins = getPins();
    for (let i = 0; i < pins.length; i++) {
      if (pins[i].id === id) {
        pins[i].annotation = annotation;
        break;
      }
    }
    savePins(pins);
  }

  function clearAllPins() {
    savePins([]);
  }

  // ─── Style Injection ───────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const css = `
      .ls-pin-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 2px 6px;
        margin-left: 8px;
        border-radius: 4px;
        transition: background 0.2s, transform 0.15s;
        vertical-align: middle;
        opacity: 0.6;
      }
      .ls-pin-btn:hover {
        background: rgba(1, 169, 130, 0.15);
        transform: scale(1.15);
        opacity: 1;
      }
      .ls-pin-btn.pinned {
        opacity: 1;
        background: rgba(1, 169, 130, 0.25);
        box-shadow: 0 0 6px rgba(1, 169, 130, 0.4);
      }
      .ls-pin-annotation-inline {
        display: block;
        margin-top: 6px;
        width: 100%;
        max-width: 400px;
        min-height: 36px;
        padding: 6px 10px;
        background: #2a2a3e;
        border: 1px solid #01a982;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 12px;
        font-family: inherit;
        resize: vertical;
        outline: none;
      }
      .ls-pin-annotation-inline:focus {
        border-color: #01d9a8;
        box-shadow: 0 0 4px rgba(1, 169, 130, 0.5);
      }

      /* Pinned Panel */
      #${PANEL_ID} {
        background: #1e1e2e;
        border: 1px solid #01a982;
        border-radius: 10px;
        padding: 20px 24px;
        margin: 20px 0;
        color: #e0e0e0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      }
      #${PANEL_ID} .ls-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 10px;
      }
      #${PANEL_ID} .ls-panel-title {
        font-size: 18px;
        font-weight: 700;
        color: #01a982;
        margin: 0;
      }
      #${PANEL_ID} .ls-pin-count-badge {
        background: #01a982;
        color: #1e1e2e;
        font-size: 12px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;
      }
      #${PANEL_ID} .ls-panel-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .ls-panel-btn {
        background: #2a2a3e;
        border: 1px solid #01a982;
        color: #01a982;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.2s, color 0.2s;
      }
      #${PANEL_ID} .ls-panel-btn:hover {
        background: #01a982;
        color: #1e1e2e;
      }
      #${PANEL_ID} .ls-panel-btn.danger {
        border-color: #e74c3c;
        color: #e74c3c;
      }
      #${PANEL_ID} .ls-panel-btn.danger:hover {
        background: #e74c3c;
        color: #fff;
      }
      #${PANEL_ID} .ls-pinned-item {
        background: #2a2a3e;
        border: 1px solid #3a3a5e;
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 12px;
        position: relative;
      }
      #${PANEL_ID} .ls-pinned-item:hover {
        border-color: #01a982;
      }
      #${PANEL_ID} .ls-severity-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        margin-right: 8px;
      }
      #${PANEL_ID} .ls-severity-critical { background: #e74c3c; color: #fff; }
      #${PANEL_ID} .ls-severity-high { background: #e67e22; color: #fff; }
      #${PANEL_ID} .ls-severity-medium { background: #f39c12; color: #1e1e2e; }
      #${PANEL_ID} .ls-severity-low { background: #3498db; color: #fff; }
      #${PANEL_ID} .ls-severity-info { background: #636e72; color: #fff; }
      #${PANEL_ID} .ls-pinned-pattern {
        font-weight: 600;
        color: #e0e0e0;
        font-size: 14px;
      }
      #${PANEL_ID} .ls-pinned-location {
        color: #888;
        font-size: 12px;
        margin-top: 4px;
        font-family: 'Fira Code', monospace;
      }
      #${PANEL_ID} .ls-pinned-content {
        color: #aaa;
        font-size: 12px;
        margin-top: 6px;
        font-family: 'Fira Code', monospace;
        background: #1e1e2e;
        padding: 6px 10px;
        border-radius: 4px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
      }
      #${PANEL_ID} .ls-pinned-annotation {
        margin-top: 8px;
      }
      #${PANEL_ID} .ls-pinned-annotation textarea {
        width: 100%;
        min-height: 32px;
        padding: 6px 10px;
        background: #1e1e2e;
        border: 1px solid #3a3a5e;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 12px;
        font-family: inherit;
        resize: vertical;
        outline: none;
        transition: border-color 0.2s;
      }
      #${PANEL_ID} .ls-pinned-annotation textarea:focus {
        border-color: #01a982;
        box-shadow: 0 0 4px rgba(1, 169, 130, 0.4);
      }
      #${PANEL_ID} .ls-pinned-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        flex-wrap: wrap;
        gap: 6px;
      }
      #${PANEL_ID} .ls-pinned-time {
        color: #666;
        font-size: 11px;
      }
      #${PANEL_ID} .ls-unpin-btn {
        background: none;
        border: 1px solid #e74c3c;
        color: #e74c3c;
        padding: 3px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      #${PANEL_ID} .ls-unpin-btn:hover {
        background: #e74c3c;
        color: #fff;
      }
      #${PANEL_ID} .ls-empty-state {
        text-align: center;
        padding: 30px 20px;
        color: #888;
        font-size: 14px;
      }
    `;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Extract Finding Data ──────────────────────────────────────────────────

  function extractFindingData(findingEl) {
    // Attempt to read data attributes or text content from the .finding element
    const patternName = findingEl.getAttribute('data-pattern') ||
      (findingEl.querySelector('.finding-pattern, .pattern-name, [data-pattern]') || {}).textContent ||
      findingEl.querySelector('strong, .title, h4, h5')?.textContent ||
      'Unknown Pattern';

    const severity = findingEl.getAttribute('data-severity') ||
      (findingEl.querySelector('.finding-severity, .severity, [data-severity]') || {}).textContent ||
      'info';

    const file = findingEl.getAttribute('data-file') ||
      (findingEl.querySelector('.finding-file, .file, [data-file]') || {}).textContent ||
      'unknown';

    const lineNumber = parseInt(
      findingEl.getAttribute('data-line') ||
      (findingEl.querySelector('.finding-line, .line, [data-line]') || {}).textContent ||
      '0', 10
    );

    const lineContent = findingEl.getAttribute('data-content') ||
      (findingEl.querySelector('.finding-content, .line-content, code, pre') || {}).textContent ||
      '';

    return {
      pattern_name: patternName.trim(),
      severity: severity.trim().toLowerCase(),
      file: file.trim(),
      line_number: lineNumber,
      line_content: lineContent.trim()
    };
  }

  // ─── Pin Button Injection ──────────────────────────────────────────────────

  function injectPinButton(findingEl) {
    if (findingEl.querySelector('.ls-pin-btn')) return; // Already injected

    const data = extractFindingData(findingEl);
    const id = generateId(data.pattern_name, data.file, data.line_number);
    const alreadyPinned = isPinned(id);

    // Create pin button
    const btn = document.createElement('button');
    btn.className = 'ls-pin-btn' + (alreadyPinned ? ' pinned' : '');
    btn.textContent = '📌';
    btn.title = alreadyPinned ? 'Unpin this finding' : 'Pin this finding';
    btn.setAttribute('aria-label', alreadyPinned ? 'Unpin finding' : 'Pin finding');
    btn.setAttribute('data-pin-id', id);

    // Annotation textarea container
    let annotationContainer = null;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();

      if (isPinned(id)) {
        // Unpin
        removePin(id);
        btn.classList.remove('pinned');
        btn.title = 'Pin this finding';
        btn.setAttribute('aria-label', 'Pin finding');
        // Remove inline annotation if present
        if (annotationContainer && annotationContainer.parentNode) {
          annotationContainer.parentNode.removeChild(annotationContainer);
          annotationContainer = null;
        }
      } else {
        // Pin
        const pinData = {
          id: id,
          pattern_name: data.pattern_name,
          severity: data.severity,
          file: data.file,
          line_number: data.line_number,
          line_content: data.line_content,
          annotation: '',
          pinned_at: new Date().toISOString()
        };
        addPin(pinData);
        btn.classList.add('pinned');
        btn.title = 'Unpin this finding';
        btn.setAttribute('aria-label', 'Unpin finding');

        // Show inline annotation textarea
        if (!annotationContainer) {
          annotationContainer = document.createElement('div');
          annotationContainer.style.marginTop = '6px';

          const textarea = document.createElement('textarea');
          textarea.className = 'ls-pin-annotation-inline';
          textarea.placeholder = 'Add annotation (e.g., root cause, action item)...';
          textarea.setAttribute('aria-label', 'Annotation for pinned finding');

          textarea.addEventListener('input', function () {
            updateAnnotation(id, textarea.value);
          });

          textarea.addEventListener('click', function (ev) {
            ev.stopPropagation();
          });

          annotationContainer.appendChild(textarea);
          findingEl.appendChild(annotationContainer);
        }
      }

      // Refresh pinned panel if visible
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        renderPinnedPanel();
      }
    });

    // Insert pin button — prefer first-child or after the first heading/title
    const titleEl = findingEl.querySelector('strong, .title, h4, h5, .finding-header');
    if (titleEl) {
      titleEl.parentNode.insertBefore(btn, titleEl.nextSibling);
    } else {
      findingEl.insertBefore(btn, findingEl.firstChild);
    }

    // If already pinned, show annotation textarea with saved text
    if (alreadyPinned) {
      const pins = getPins();
      const existingPin = pins.find(function (p) { return p.id === id; });
      if (existingPin && existingPin.annotation) {
        annotationContainer = document.createElement('div');
        annotationContainer.style.marginTop = '6px';

        const textarea = document.createElement('textarea');
        textarea.className = 'ls-pin-annotation-inline';
        textarea.placeholder = 'Add annotation (e.g., root cause, action item)...';
        textarea.value = existingPin.annotation;
        textarea.setAttribute('aria-label', 'Annotation for pinned finding');

        textarea.addEventListener('input', function () {
          updateAnnotation(id, textarea.value);
        });

        textarea.addEventListener('click', function (ev) {
          ev.stopPropagation();
        });

        annotationContainer.appendChild(textarea);
        findingEl.appendChild(annotationContainer);
      }
    }
  }

  function processFindingsList(container) {
    if (!container) return;
    const findings = container.querySelectorAll('.finding');
    findings.forEach(function (findingEl) {
      injectPinButton(findingEl);
    });
  }

  // ─── Render Pinned Panel ───────────────────────────────────────────────────

  function renderPinnedPanel() {
    injectStyles();

    const pins = getPins();
    let panel = document.getElementById(PANEL_ID);

    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      // Insert panel — look for common containers
      const mainContent = document.querySelector('#app, #main, .content, main, body');
      if (mainContent) {
        mainContent.appendChild(panel);
      } else {
        document.body.appendChild(panel);
      }
    }

    if (pins.length === 0) {
      panel.innerHTML = `
        <div class="ls-panel-header">
          <h3 class="ls-panel-title">📌 Pinned Findings & Annotations <span class="ls-pin-count-badge">0</span></h3>
        </div>
        <div class="ls-empty-state">
          No findings pinned yet. Click 📌 on any finding to bookmark it.
        </div>
      `;
      return panel;
    }

    let itemsHtml = '';
    pins.forEach(function (pin) {
      const severityClass = 'ls-severity-' + (pin.severity || 'info');
      const pinnedTime = pin.pinned_at ? new Date(pin.pinned_at).toLocaleString() : 'Unknown';
      const escapedAnnotation = (pin.annotation || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const escapedContent = (pin.line_content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedPattern = (pin.pattern_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedFile = (pin.file || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      itemsHtml += `
        <div class="ls-pinned-item" data-pin-id="${pin.id}">
          <span class="ls-severity-badge ${severityClass}">${pin.severity || 'info'}</span>
          <span class="ls-pinned-pattern">${escapedPattern}</span>
          <div class="ls-pinned-location">${escapedFile}:${pin.line_number}</div>
          ${pin.line_content ? `<div class="ls-pinned-content">${escapedContent}</div>` : ''}
          <div class="ls-pinned-annotation">
            <textarea data-pin-id="${pin.id}" placeholder="Add annotation...">${escapedAnnotation}</textarea>
          </div>
          <div class="ls-pinned-meta">
            <span class="ls-pinned-time">Pinned: ${pinnedTime}</span>
            <button class="ls-unpin-btn" data-unpin-id="${pin.id}" title="Remove pin">🗑️ Unpin</button>
          </div>
        </div>
      `;
    });

    panel.innerHTML = `
      <div class="ls-panel-header">
        <h3 class="ls-panel-title">📌 Pinned Findings & Annotations <span class="ls-pin-count-badge">${pins.length}</span></h3>
        <div class="ls-panel-actions">
          <button class="ls-panel-btn" id="ls-export-pins">📋 Export Pins</button>
          <button class="ls-panel-btn danger" id="ls-clear-all-pins">Clear All Pins</button>
        </div>
      </div>
      ${itemsHtml}
    `;

    // Bind annotation editing
    const textareas = panel.querySelectorAll('.ls-pinned-annotation textarea');
    textareas.forEach(function (ta) {
      ta.addEventListener('input', function () {
        const pinId = ta.getAttribute('data-pin-id');
        updateAnnotation(pinId, ta.value);
      });
    });

    // Bind unpin buttons
    const unpinBtns = panel.querySelectorAll('.ls-unpin-btn');
    unpinBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pinId = btn.getAttribute('data-unpin-id');
        removePin(pinId);
        renderPinnedPanel();
        // Also update the pin button state in findings list
        const pinBtn = document.querySelector('.ls-pin-btn[data-pin-id="' + pinId + '"]');
        if (pinBtn) {
          pinBtn.classList.remove('pinned');
          pinBtn.title = 'Pin this finding';
          pinBtn.setAttribute('aria-label', 'Pin finding');
        }
      });
    });

    // Bind clear all
    const clearBtn = panel.querySelector('#ls-clear-all-pins');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (confirm('Remove all pinned findings? This cannot be undone.')) {
          clearAllPins();
          renderPinnedPanel();
          // Reset all pin buttons in findings list
          document.querySelectorAll('.ls-pin-btn.pinned').forEach(function (b) {
            b.classList.remove('pinned');
            b.title = 'Pin this finding';
            b.setAttribute('aria-label', 'Pin finding');
          });
        }
      });
    }

    // Bind export
    const exportBtn = panel.querySelector('#ls-export-pins');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        const currentPins = getPins();
        if (currentPins.length === 0) {
          alert('No pins to export.');
          return;
        }

        let exportText = '=== LogSherlock Pro — Pinned Findings Export ===\n';
        exportText += 'Exported: ' + new Date().toISOString() + '\n';
        exportText += 'Total Pins: ' + currentPins.length + '\n';
        exportText += '================================================\n\n';

        currentPins.forEach(function (pin, index) {
          exportText += `[${index + 1}] ${pin.severity.toUpperCase()} | ${pin.pattern_name}\n`;
          exportText += `    File: ${pin.file}:${pin.line_number}\n`;
          if (pin.line_content) {
            exportText += `    Content: ${pin.line_content}\n`;
          }
          if (pin.annotation) {
            exportText += `    Annotation: ${pin.annotation}\n`;
          }
          exportText += `    Pinned: ${pin.pinned_at}\n`;
          exportText += '\n';
        });

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(exportText).then(function () {
            alert('Pins exported to clipboard! Paste into your shift handoff document.');
          }).catch(function () {
            fallbackExport(exportText);
          });
        } else {
          fallbackExport(exportText);
        }
      });
    }

    return panel;
  }

  function fallbackExport(text) {
    // Fallback: open in a new window for copy
    const win = window.open('', '_blank', 'width=600,height=400');
    if (win) {
      win.document.write('<pre style="background:#1e1e2e;color:#e0e0e0;padding:20px;font-family:monospace;white-space:pre-wrap;">' +
        text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>');
      win.document.title = 'LogSherlock Pins Export';
    } else {
      alert('Export text:\n\n' + text);
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function initPinAnnotate() {
    injectStyles();

    const findingsList = document.getElementById('findingsList');

    if (findingsList) {
      // Process any existing findings
      processFindingsList(findingsList);

      // Watch for new findings being added dynamically
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(function (node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList && node.classList.contains('finding')) {
                  injectPinButton(node);
                }
                // Also check children
                const childFindings = node.querySelectorAll ? node.querySelectorAll('.finding') : [];
                childFindings.forEach(function (f) {
                  injectPinButton(f);
                });
              }
            });
          }
        });
      });

      observer.observe(findingsList, {
        childList: true,
        subtree: true
      });
    }

    console.log('[LogSherlock Pro] Pin & Annotate module initialized.');
  }

  // ─── Self-Initialize ───────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPinAnnotate);
  } else {
    initPinAnnotate();
  }

  // ─── Exports ───────────────────────────────────────────────────────────────

  window.initPinAnnotate = initPinAnnotate;
  window.renderPinnedPanel = renderPinnedPanel;

})();
