/**
 * LogSherlock Pro — Collaborative Investigation Threads
 * Export/import investigation context (findings metadata, annotations, hypotheses)
 * WITHOUT sharing actual log data. Perfect for HIPAA/classified environments.
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_threads';
  const USER_KEY = 'ls_user_name';

  // --- Storage Helpers ---
  function loadThreads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[LogSherlock] Failed to load threads:', e);
      return [];
    }
  }

  function saveThreads(threads) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch (e) {
      console.error('[LogSherlock] Failed to save threads:', e);
    }
  }

  function generateId() {
    return 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getSavedAuthor() {
    return localStorage.getItem(USER_KEY) || '';
  }

  function saveAuthor(name) {
    if (name) localStorage.setItem(USER_KEY, name);
  }

  // --- Sanitize findings to metadata only (NO line_content) ---
  function sanitizeFindings(findings) {
    if (!Array.isArray(findings)) return [];
    return findings.map(function (f) {
      return {
        pattern_name: f.pattern_name || f.patternName || f.name || '',
        severity: f.severity || 'info',
        category: f.category || '',
        file: f.file || f.filename || '',
        line_number: f.line_number || f.lineNumber || f.line || 0
      };
    });
  }

  // --- Status badge styling ---
  function getStatusBadge(status) {
    var colors = {
      active: { bg: '#01a982', text: '#fff' },
      resolved: { bg: '#4a6fa5', text: '#fff' },
      escalated: { bg: '#e63946', text: '#fff' }
    };
    var c = colors[status] || colors.active;
    return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:' + c.bg + ';color:' + c.text + ';text-transform:uppercase;">' + status + '</span>';
  }

  // --- Export thread as JSON download ---
  function exportThread(thread) {
    var exportData = Object.assign({}, thread, {
      _disclaimer: 'This thread contains finding metadata only. No raw log data is included. Safe for cross-team sharing in regulated environments.',
      _exported_at: new Date().toISOString(),
      _tool: 'LogSherlock Pro'
    });
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'logsherlock_thread_' + thread.id + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Validate imported thread structure ---
  function validateThread(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (!obj.id || !obj.title || !obj.created_at) return false;
    if (!['active', 'resolved', 'escalated'].includes(obj.status)) return false;
    if (obj.findings_summary && !Array.isArray(obj.findings_summary)) return false;
    if (obj.hypotheses && !Array.isArray(obj.hypotheses)) return false;
    // Reject if line_content present in any finding
    if (obj.findings_summary) {
      for (var i = 0; i < obj.findings_summary.length; i++) {
        if (obj.findings_summary[i].line_content) return false;
      }
    }
    return true;
  }



  // ==========================================================
  // MAIN RENDER FUNCTION
  // ==========================================================
  function renderCollabThreadsPanel(findings) {
    var panel = document.createElement('div');
    panel.id = 'logsherlock-collab-threads';
    panel.style.cssText = 'background:#1e1e2e;color:#cdd6f4;border:1px solid #01a982;border-radius:8px;padding:24px;margin:16px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;';

    var threads = loadThreads();
    var currentFindings = sanitizeFindings(findings || []);
    var tempHypotheses = [];

    function rerender() {
      threads = loadThreads();
      panel.innerHTML = '';
      renderContent();
    }

    function renderContent() {
      // --- Title ---
      var title = document.createElement('h2');
      title.style.cssText = 'color:#01a982;margin:0 0 4px 0;font-size:20px;';
      title.textContent = '🧵 Investigation Threads — Collaborate Without Sharing Logs';
      panel.appendChild(title);

      var subtitle = document.createElement('p');
      subtitle.style.cssText = 'color:#a6adc8;margin:0 0 20px 0;font-size:13px;';
      subtitle.textContent = 'Share finding metadata & hypotheses with your team. No log data is ever included in exports.';
      panel.appendChild(subtitle);

      // --- Create Thread Form ---
      renderCreateForm();

      // --- Import Section ---
      renderImportSection();

      // --- Thread List ---
      renderThreadList();
    }

    // ===================== CREATE FORM =====================
    function renderCreateForm() {
      var section = document.createElement('div');
      section.style.cssText = 'background:#181825;border:1px solid #313244;border-radius:6px;padding:16px;margin-bottom:16px;';

      var heading = document.createElement('h3');
      heading.style.cssText = 'color:#01a982;margin:0 0 12px 0;font-size:15px;';
      heading.textContent = '➕ Create New Thread';
      section.appendChild(heading);

      var inputStyle = 'width:100%;padding:8px 10px;background:#1e1e2e;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:13px;box-sizing:border-box;margin-bottom:10px;';
      var labelStyle = 'display:block;color:#a6adc8;font-size:12px;margin-bottom:4px;font-weight:600;';

      // Title
      var lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Title *';
      section.appendChild(lbl);
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'e.g., Memory leak investigation - prod server 3';
      titleInput.style.cssText = inputStyle;
      section.appendChild(titleInput);

      // Author
      lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Author';
      section.appendChild(lbl);
      var authorInput = document.createElement('input');
      authorInput.type = 'text';
      authorInput.value = getSavedAuthor();
      authorInput.placeholder = 'Your name';
      authorInput.style.cssText = inputStyle;
      section.appendChild(authorInput);

      // Status
      lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Status';
      section.appendChild(lbl);
      var statusSelect = document.createElement('select');
      statusSelect.style.cssText = inputStyle;
      ['active', 'resolved', 'escalated'].forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusSelect.appendChild(opt);
      });
      section.appendChild(statusSelect);

      // Include findings checkbox
      var checkRow = document.createElement('div');
      checkRow.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
      var includeCb = document.createElement('input');
      includeCb.type = 'checkbox';
      includeCb.id = 'ls-include-findings';
      includeCb.checked = true;
      checkRow.appendChild(includeCb);
      var cbLabel = document.createElement('label');
      cbLabel.htmlFor = 'ls-include-findings';
      cbLabel.style.cssText = 'color:#a6adc8;font-size:12px;cursor:pointer;';
      cbLabel.textContent = 'Include current findings summary (metadata only — no log content)';
      checkRow.appendChild(cbLabel);
      section.appendChild(checkRow);

      // Hypotheses
      var hypoSection = document.createElement('div');
      hypoSection.style.cssText = 'background:#1e1e2e;border:1px solid #313244;border-radius:4px;padding:10px;margin-bottom:10px;';
      var hypoTitle = document.createElement('div');
      hypoTitle.style.cssText = 'color:#a6adc8;font-size:12px;font-weight:600;margin-bottom:6px;';
      hypoTitle.textContent = 'Hypotheses';
      hypoSection.appendChild(hypoTitle);

      var hypoList = document.createElement('div');
      hypoList.id = 'ls-hypo-list';
      hypoSection.appendChild(hypoList);

      var hypoRow = document.createElement('div');
      hypoRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
      var hypoInput = document.createElement('input');
      hypoInput.type = 'text';
      hypoInput.placeholder = 'e.g., OOM caused by connection pool exhaustion';
      hypoInput.style.cssText = 'flex:1;min-width:200px;padding:6px 8px;background:#181825;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:12px;';
      hypoRow.appendChild(hypoInput);

      var confSelect = document.createElement('select');
      confSelect.style.cssText = 'padding:6px 8px;background:#181825;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:12px;';
      ['high', 'medium', 'low'].forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        confSelect.appendChild(opt);
      });
      hypoRow.appendChild(confSelect);

      var addHypoBtn = document.createElement('button');
      addHypoBtn.textContent = 'Add Hypothesis';
      addHypoBtn.style.cssText = 'padding:6px 12px;background:#01a982;color:#1e1e2e;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;';
      addHypoBtn.addEventListener('click', function () {
        var text = hypoInput.value.trim();
        if (!text) return;
        tempHypotheses.push({ text: text, confidence: confSelect.value, added_at: new Date().toISOString() });
        hypoInput.value = '';
        renderHypoList();
      });
      hypoRow.appendChild(addHypoBtn);
      hypoSection.appendChild(hypoRow);
      section.appendChild(hypoSection);

      function renderHypoList() {
        hypoList.innerHTML = '';
        tempHypotheses.forEach(function (h, idx) {
          var item = document.createElement('div');
          item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #313244;';
          item.innerHTML = '<span style="color:#cdd6f4;font-size:12px;">' + escapeHtml(h.text) + ' <span style="color:#a6adc8;">(' + h.confidence + ')</span></span>';
          var removeBtn = document.createElement('button');
          removeBtn.textContent = '✕';
          removeBtn.style.cssText = 'background:none;border:none;color:#e63946;cursor:pointer;font-size:14px;';
          removeBtn.addEventListener('click', function () {
            tempHypotheses.splice(idx, 1);
            renderHypoList();
          });
          item.appendChild(removeBtn);
          hypoList.appendChild(item);
        });
      }

      // Notes
      lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Notes';
      section.appendChild(lbl);
      var notesInput = document.createElement('textarea');
      notesInput.placeholder = 'Additional context, observations, next steps...';
      notesInput.style.cssText = inputStyle + 'min-height:60px;resize:vertical;';
      section.appendChild(notesInput);

      // Resolution
      lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Resolution (for resolved threads)';
      section.appendChild(lbl);
      var resolutionInput = document.createElement('textarea');
      resolutionInput.placeholder = 'Root cause and fix applied...';
      resolutionInput.style.cssText = inputStyle + 'min-height:50px;resize:vertical;';
      section.appendChild(resolutionInput);

      // Tags
      lbl = document.createElement('label');
      lbl.style.cssText = labelStyle;
      lbl.textContent = 'Tags (comma-separated)';
      section.appendChild(lbl);
      var tagsInput = document.createElement('input');
      tagsInput.type = 'text';
      tagsInput.placeholder = 'e.g., memory, production, critical';
      tagsInput.style.cssText = inputStyle;
      section.appendChild(tagsInput);

      // Create Button
      var createBtn = document.createElement('button');
      createBtn.textContent = 'Create Thread';
      createBtn.style.cssText = 'padding:10px 20px;background:#01a982;color:#1e1e2e;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px;';
      createBtn.addEventListener('click', function () {
        var titleVal = titleInput.value.trim();
        if (!titleVal) {
          titleInput.style.borderColor = '#e63946';
          return;
        }
        titleInput.style.borderColor = '#45475a';

        var authorVal = authorInput.value.trim();
        saveAuthor(authorVal);

        var now = new Date().toISOString();
        var thread = {
          id: generateId(),
          title: titleVal,
          created_at: now,
          updated_at: now,
          author: authorVal,
          status: statusSelect.value,
          findings_summary: includeCb.checked ? currentFindings : [],
          hypotheses: tempHypotheses.slice(),
          notes: notesInput.value.trim(),
          resolution: resolutionInput.value.trim(),
          tags: tagsInput.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
        };

        threads.push(thread);
        saveThreads(threads);
        tempHypotheses = [];
        rerender();
      });
      section.appendChild(createBtn);

      panel.appendChild(section);
    }



    // ===================== IMPORT SECTION =====================
    function renderImportSection() {
      var section = document.createElement('div');
      section.style.cssText = 'background:#181825;border:1px solid #313244;border-radius:6px;padding:16px;margin-bottom:16px;';

      var heading = document.createElement('h3');
      heading.style.cssText = 'color:#01a982;margin:0 0 10px 0;font-size:15px;';
      heading.textContent = '📥 Import Thread';
      section.appendChild(heading);

      var note = document.createElement('p');
      note.style.cssText = 'color:#a6adc8;font-size:12px;margin:0 0 10px 0;';
      note.textContent = 'Import a .json thread file from a team member. No log data will be imported — only finding metadata and hypotheses.';
      section.appendChild(note);

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;';

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.cssText = 'flex:1;color:#cdd6f4;font-size:12px;';
      row.appendChild(fileInput);

      var importBtn = document.createElement('button');
      importBtn.textContent = 'Import';
      importBtn.style.cssText = 'padding:8px 16px;background:#01a982;color:#1e1e2e;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;';
      importBtn.addEventListener('click', function () {
        var file = fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var data = JSON.parse(e.target.result);
            // Strip any line_content that might have leaked in
            if (data.findings_summary) {
              data.findings_summary = data.findings_summary.map(function (f) {
                var clean = { pattern_name: f.pattern_name, severity: f.severity, category: f.category, file: f.file, line_number: f.line_number };
                return clean;
              });
            }
            if (!validateThread(data)) {
              alert('Invalid thread format. Please ensure the file is a valid LogSherlock thread export.');
              return;
            }
            // Remove internal export metadata
            delete data._disclaimer;
            delete data._exported_at;
            delete data._tool;
            // Check for duplicate
            var existing = threads.find(function (t) { return t.id === data.id; });
            if (existing) {
              if (!confirm('A thread with this ID already exists. Replace it?')) return;
              threads = threads.filter(function (t) { return t.id !== data.id; });
            }
            threads.push(data);
            saveThreads(threads);
            rerender();
          } catch (err) {
            alert('Failed to parse thread file: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
      row.appendChild(importBtn);
      section.appendChild(row);

      panel.appendChild(section);
    }

    // ===================== THREAD LIST =====================
    function renderThreadList() {
      var section = document.createElement('div');

      var heading = document.createElement('h3');
      heading.style.cssText = 'color:#01a982;margin:0 0 12px 0;font-size:15px;';
      heading.textContent = '📋 Threads (' + threads.length + ')';
      section.appendChild(heading);

      if (threads.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:30px;color:#6c7086;font-size:14px;border:1px dashed #45475a;border-radius:6px;';
        empty.textContent = 'No investigation threads yet. Create one to document your analysis and share with team members.';
        section.appendChild(empty);
        panel.appendChild(section);
        return;
      }

      // Sort by updated_at descending
      var sorted = threads.slice().sort(function (a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      sorted.forEach(function (thread) {
        var card = document.createElement('div');
        card.style.cssText = 'background:#181825;border:1px solid #313244;border-radius:6px;padding:14px;margin-bottom:10px;';

        // Header row
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;';

        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'flex:1;';
        titleDiv.innerHTML = '<strong style="color:#cdd6f4;font-size:14px;">' + escapeHtml(thread.title) + '</strong>' +
          '<div style="margin-top:4px;font-size:12px;color:#a6adc8;">' +
          (thread.author ? 'by ' + escapeHtml(thread.author) + ' · ' : '') +
          formatDate(thread.created_at) +
          ' · ' + (thread.findings_summary ? thread.findings_summary.length : 0) + ' findings' +
          ' · ' + (thread.hypotheses ? thread.hypotheses.length : 0) + ' hypotheses' +
          '</div>';
        header.appendChild(titleDiv);

        var badgeDiv = document.createElement('div');
        badgeDiv.innerHTML = getStatusBadge(thread.status);
        header.appendChild(badgeDiv);
        card.appendChild(header);

        // Tags
        if (thread.tags && thread.tags.length > 0) {
          var tagDiv = document.createElement('div');
          tagDiv.style.cssText = 'margin-top:8px;';
          thread.tags.forEach(function (tag) {
            tagDiv.innerHTML += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#313244;color:#a6adc8;border-radius:3px;font-size:11px;">' + escapeHtml(tag) + '</span>';
          });
          card.appendChild(tagDiv);
        }

        // Expandable details
        var details = document.createElement('div');
        details.style.cssText = 'display:none;margin-top:12px;padding-top:12px;border-top:1px solid #313244;';

        // Findings summary
        if (thread.findings_summary && thread.findings_summary.length > 0) {
          details.innerHTML += '<div style="margin-bottom:10px;"><strong style="color:#01a982;font-size:12px;">Findings Metadata (no log data):</strong>' +
            '<table style="width:100%;margin-top:6px;font-size:11px;border-collapse:collapse;">' +
            '<tr style="color:#a6adc8;text-align:left;"><th style="padding:4px 8px;border-bottom:1px solid #313244;">Pattern</th><th style="padding:4px 8px;border-bottom:1px solid #313244;">Severity</th><th style="padding:4px 8px;border-bottom:1px solid #313244;">Category</th><th style="padding:4px 8px;border-bottom:1px solid #313244;">File</th><th style="padding:4px 8px;border-bottom:1px solid #313244;">Line</th></tr>' +
            thread.findings_summary.map(function (f) {
              return '<tr style="color:#cdd6f4;"><td style="padding:4px 8px;border-bottom:1px solid #1e1e2e;">' + escapeHtml(f.pattern_name) + '</td><td style="padding:4px 8px;border-bottom:1px solid #1e1e2e;">' + escapeHtml(f.severity) + '</td><td style="padding:4px 8px;border-bottom:1px solid #1e1e2e;">' + escapeHtml(f.category) + '</td><td style="padding:4px 8px;border-bottom:1px solid #1e1e2e;">' + escapeHtml(f.file) + '</td><td style="padding:4px 8px;border-bottom:1px solid #1e1e2e;">' + (f.line_number || '-') + '</td></tr>';
            }).join('') +
            '</table></div>';
        }

        // Hypotheses
        if (thread.hypotheses && thread.hypotheses.length > 0) {
          var hypoHtml = '<div style="margin-bottom:10px;"><strong style="color:#01a982;font-size:12px;">Hypotheses:</strong><ul style="margin:6px 0;padding-left:18px;">';
          thread.hypotheses.forEach(function (h) {
            var confColor = h.confidence === 'high' ? '#01a982' : h.confidence === 'medium' ? '#fab387' : '#a6adc8';
            hypoHtml += '<li style="color:#cdd6f4;font-size:12px;margin-bottom:4px;">' + escapeHtml(h.text) + ' <span style="color:' + confColor + ';">(' + h.confidence + ')</span></li>';
          });
          hypoHtml += '</ul></div>';
          details.innerHTML += hypoHtml;
        }

        // Notes
        if (thread.notes) {
          details.innerHTML += '<div style="margin-bottom:10px;"><strong style="color:#01a982;font-size:12px;">Notes:</strong><p style="color:#cdd6f4;font-size:12px;margin:4px 0;white-space:pre-wrap;">' + escapeHtml(thread.notes) + '</p></div>';
        }

        // Resolution
        if (thread.resolution) {
          details.innerHTML += '<div style="margin-bottom:10px;"><strong style="color:#01a982;font-size:12px;">Resolution:</strong><p style="color:#cdd6f4;font-size:12px;margin:4px 0;white-space:pre-wrap;">' + escapeHtml(thread.resolution) + '</p></div>';
        }

        // No log data notice
        details.innerHTML += '<div style="margin-top:8px;padding:6px 10px;background:#1e1e2e;border:1px solid #313244;border-radius:4px;font-size:11px;color:#6c7086;text-align:center;">🔒 No log data shared — this thread contains finding metadata only</div>';

        card.appendChild(details);

        // Action buttons row
        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;';

        var expandBtn = document.createElement('button');
        expandBtn.textContent = '▶ Details';
        expandBtn.style.cssText = 'padding:5px 12px;background:#313244;color:#cdd6f4;border:none;border-radius:4px;font-size:12px;cursor:pointer;';
        expandBtn.addEventListener('click', function () {
          var visible = details.style.display !== 'none';
          details.style.display = visible ? 'none' : 'block';
          expandBtn.textContent = visible ? '▶ Details' : '▼ Details';
        });
        actions.appendChild(expandBtn);

        var exportBtn = document.createElement('button');
        exportBtn.textContent = '📤 Export Thread';
        exportBtn.style.cssText = 'padding:5px 12px;background:#01a982;color:#1e1e2e;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;';
        exportBtn.addEventListener('click', function () {
          exportThread(thread);
        });
        actions.appendChild(exportBtn);

        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.style.cssText = 'padding:5px 12px;background:#45475a;color:#e63946;border:none;border-radius:4px;font-size:12px;cursor:pointer;';
        deleteBtn.addEventListener('click', function () {
          if (!confirm('Delete thread "' + thread.title + '"? This cannot be undone.')) return;
          threads = threads.filter(function (t) { return t.id !== thread.id; });
          saveThreads(threads);
          rerender();
        });
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
        section.appendChild(card);
      });

      panel.appendChild(section);
    }

    // Kick off initial render
    renderContent();
    return panel;
  }



  // --- Utility: escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Utility: format date ---
  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso || '';
    }
  }

  // --- DOMContentLoaded Guard ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.renderCollabThreadsPanel = renderCollabThreadsPanel;
    });
  } else {
    window.renderCollabThreadsPanel = renderCollabThreadsPanel;
  }
})();
