/**
 * LogSherlock Pro — Noise Suppression Module
 * Auto-identifies and collapses repetitive/noisy patterns so engineers
 * see unique important findings first.
 *
 * Export: window.renderNoiseSuppressionPanel
 */
(function () {
  if (typeof window === 'undefined') return;

  const NOISE_THRESHOLD = 10;
  const STORAGE_KEY = 'logsherlock_noise_rules';

  // --- Helpers ---

  function getSuppressedPatterns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSuppressedPatterns(patterns) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (e) {
      // localStorage unavailable — silently fail
    }
  }

  function toggleSuppressedPattern(patternName, suppress) {
    const patterns = getSuppressedPatterns();
    const idx = patterns.indexOf(patternName);
    if (suppress && idx === -1) {
      patterns.push(patternName);
    } else if (!suppress && idx !== -1) {
      patterns.splice(idx, 1);
    }
    saveSuppressedPatterns(patterns);
  }

  function severityColor(severity) {
    const s = (severity || 'info').toLowerCase();
    if (s === 'critical' || s === 'high') return '#ff6b6b';
    if (s === 'medium' || s === 'warning') return '#f0a500';
    if (s === 'low') return '#4ecdc4';
    return '#8a8a8a';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Core Analysis (uses ONLY real findings data) ---

  function analyzeFindings(findings) {
    if (!Array.isArray(findings) || findings.length === 0) {
      return { groups: {}, noisyPatterns: [], quietFindings: [], totalCount: 0, noisyCount: 0, uniqueCount: 0 };
    }

    const groups = {};

    findings.forEach(function (f) {
      const name = f.pattern_name || 'Unknown Pattern';
      if (!groups[name]) {
        groups[name] = { pattern_name: name, findings: [], files: new Set(), severities: new Set() };
      }
      groups[name].findings.push(f);
      if (f.file || f.filename || f.path) {
        groups[name].files.add(f.file || f.filename || f.path);
      }
      if (f.severity) {
        groups[name].severities.add(f.severity);
      }
    });

    const suppressedPatterns = getSuppressedPatterns();
    const noisyPatterns = [];
    const quietFindings = [];

    Object.keys(groups).forEach(function (name) {
      const group = groups[name];
      const count = group.findings.length;
      const isNoisy = count >= NOISE_THRESHOLD;
      const isAlwaysSuppressed = suppressedPatterns.indexOf(name) !== -1;

      if (isNoisy || isAlwaysSuppressed) {
        noisyPatterns.push({
          pattern_name: name,
          count: count,
          fileCount: group.files.size,
          severity: Array.from(group.severities)[0] || 'info',
          findings: group.findings,
          isAlwaysSuppressed: isAlwaysSuppressed,
          isNoisy: isNoisy
        });
      } else {
        group.findings.forEach(function (f) {
          quietFindings.push(f);
        });
      }
    });

    const noisyCount = noisyPatterns.reduce(function (sum, p) { return sum + p.count; }, 0);

    return {
      groups: groups,
      noisyPatterns: noisyPatterns,
      quietFindings: quietFindings,
      totalCount: findings.length,
      noisyCount: noisyCount,
      uniqueCount: findings.length - noisyCount
    };
  }

  // --- Render ---

  function renderNoiseSuppressionPanel(findings) {
    const analysis = analyzeFindings(findings);
    let suppressionEnabled = true;

    const container = document.createElement('div');
    container.id = 'logsherlock-noise-suppression';
    container.style.cssText = [
      'background:#1e1e2e',
      'color:#cdd6f4',
      'border-radius:12px',
      'padding:24px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace',
      'margin:16px 0',
      'border:1px solid #313244'
    ].join(';');

    function render() {
      const currentAnalysis = analyzeFindings(findings);
      const hasNoise = currentAnalysis.noisyPatterns.length > 0;

      let html = '';

      // Title
      html += '<h2 style="margin:0 0 16px 0;color:#01a982;font-size:20px;font-weight:600;">';
      html += '🔇 Noise Suppression — Focus on Unique Issues</h2>';

      // Stats bar
      html += '<div style="background:#181825;border-radius:8px;padding:12px 16px;margin-bottom:16px;';
      html += 'font-size:14px;color:#a6adc8;border-left:3px solid #01a982;">';
      html += '<span style="color:#cdd6f4;font-weight:500;">' + currentAnalysis.totalCount + '</span> total findings • ';
      html += '<span style="color:#f0a500;font-weight:500;">' + currentAnalysis.noisyCount + '</span> noisy (repeated ' + NOISE_THRESHOLD + '+ times) • ';
      html += '<span style="color:#01a982;font-weight:500;">' + currentAnalysis.uniqueCount + '</span> unique findings to investigate';
      html += '</div>';

      // Toggle button
      html += '<div style="margin-bottom:20px;">';
      html += '<button id="ns-toggle-btn" style="background:' + (suppressionEnabled ? '#01a982' : '#45475a') + ';';
      html += 'color:#1e1e2e;border:none;border-radius:6px;padding:10px 20px;font-size:14px;';
      html += 'font-weight:600;cursor:pointer;transition:background 0.2s;">';
      html += suppressionEnabled ? 'Show All' : 'Enable Suppression';
      html += '</button></div>';

      if (!hasNoise) {
        // No noise detected
        html += '<div style="background:#181825;border-radius:8px;padding:20px;text-align:center;';
        html += 'color:#a6adc8;font-size:15px;border:1px dashed #313244;">';
        html += '✅ No repetitive noise detected — all findings are unique</div>';
      } else {
        // Noisy patterns list
        html += '<div style="margin-bottom:16px;">';
        html += '<h3 style="color:#cdd6f4;font-size:16px;margin:0 0 12px 0;">Noisy Patterns Detected</h3>';

        currentAnalysis.noisyPatterns.forEach(function (pattern, idx) {
          const sevColor = severityColor(pattern.severity);
          const isExpanded = false;

          html += '<div class="ns-pattern-item" data-pattern-idx="' + idx + '" ';
          html += 'style="background:#181825;border-radius:8px;margin-bottom:8px;border:1px solid #313244;overflow:hidden;">';

          // Header row
          html += '<div class="ns-pattern-header" style="padding:12px 16px;display:flex;align-items:center;';
          html += 'justify-content:space-between;cursor:pointer;" data-idx="' + idx + '">';

          // Left side: icon + pattern name + severity
          html += '<div style="display:flex;align-items:center;gap:10px;flex:1;">';
          if (suppressionEnabled) {
            html += '<span style="font-size:16px;">🔇</span>';
            html += '<span style="color:#cdd6f4;font-weight:500;">' + escapeHtml(pattern.pattern_name) + '</span>';
          } else {
            html += '<span style="font-size:16px;">📋</span>';
            html += '<span style="color:#cdd6f4;font-weight:500;">' + escapeHtml(pattern.pattern_name) + '</span>';
          }
          html += '<span style="background:' + sevColor + '22;color:' + sevColor + ';font-size:11px;';
          html += 'padding:2px 8px;border-radius:4px;font-weight:600;text-transform:uppercase;">';
          html += escapeHtml(pattern.severity) + '</span>';
          html += '</div>';

          // Right side: count + expand
          html += '<div style="display:flex;align-items:center;gap:12px;">';
          html += '<span style="color:#a6adc8;font-size:13px;">';
          html += pattern.count + ' occurrences across ' + pattern.fileCount + ' file' + (pattern.fileCount !== 1 ? 's' : '');
          html += '</span>';
          html += '<span class="ns-expand-icon" style="color:#01a982;font-size:12px;font-weight:600;">[Expand]</span>';
          html += '</div>';

          html += '</div>';

          // Always suppress checkbox
          html += '<div style="padding:0 16px 10px 16px;display:flex;align-items:center;gap:8px;">';
          html += '<input type="checkbox" class="ns-always-suppress" data-pattern="' + escapeHtml(pattern.pattern_name) + '" ';
          if (pattern.isAlwaysSuppressed) html += 'checked ';
          html += 'style="accent-color:#01a982;cursor:pointer;">';
          html += '<label style="font-size:12px;color:#a6adc8;cursor:pointer;">Always suppress this pattern</label>';
          html += '</div>';

          // Expandable detail (hidden by default)
          html += '<div class="ns-pattern-detail" data-detail-idx="' + idx + '" style="display:none;';
          html += 'border-top:1px solid #313244;padding:12px 16px;max-height:300px;overflow-y:auto;">';

          pattern.findings.forEach(function (f, fi) {
            if (fi >= 50) return; // cap at 50 visible for performance
            html += '<div style="padding:6px 0;border-bottom:1px solid #24243a;font-size:13px;">';
            html += '<span style="color:#01a982;">' + escapeHtml(f.file || f.filename || f.path || 'unknown') + '</span>';
            if (f.line || f.line_number) {
              html += '<span style="color:#585b70;">:' + (f.line || f.line_number) + '</span>';
            }
            if (f.message || f.description) {
              html += '<div style="color:#a6adc8;margin-top:2px;">' + escapeHtml(f.message || f.description) + '</div>';
            }
            html += '</div>';
          });

          if (pattern.findings.length > 50) {
            html += '<div style="color:#585b70;font-size:12px;padding-top:8px;">... and ' + (pattern.findings.length - 50) + ' more occurrences</div>';
          }

          html += '</div>'; // end detail
          html += '</div>'; // end pattern item
        });

        html += '</div>';

        // Show unique findings when suppression is enabled
        if (suppressionEnabled && currentAnalysis.quietFindings.length > 0) {
          html += '<div style="margin-top:20px;">';
          html += '<h3 style="color:#01a982;font-size:16px;margin:0 0 12px 0;">✅ Unique Findings (' + currentAnalysis.quietFindings.length + ')</h3>';

          currentAnalysis.quietFindings.forEach(function (f) {
            const sevColor = severityColor(f.severity);
            html += '<div style="background:#181825;border-radius:6px;padding:10px 14px;margin-bottom:6px;';
            html += 'border:1px solid #313244;font-size:13px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
            html += '<span style="background:' + sevColor + '22;color:' + sevColor + ';font-size:11px;';
            html += 'padding:2px 6px;border-radius:3px;font-weight:600;text-transform:uppercase;">';
            html += escapeHtml(f.severity || 'info') + '</span>';
            html += '<span style="color:#cdd6f4;font-weight:500;">' + escapeHtml(f.pattern_name || 'Unknown') + '</span>';
            html += '</div>';
            html += '<div style="color:#01a982;">' + escapeHtml(f.file || f.filename || f.path || '') + '';
            if (f.line || f.line_number) {
              html += '<span style="color:#585b70;">:' + (f.line || f.line_number) + '</span>';
            }
            html += '</div>';
            if (f.message || f.description) {
              html += '<div style="color:#a6adc8;margin-top:4px;">' + escapeHtml(f.message || f.description) + '</div>';
            }
            html += '</div>';
          });

          html += '</div>';
        }
      }

      // Footer note
      html += '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #313244;';
      html += 'font-size:12px;color:#585b70;font-style:italic;">';
      html += 'Suppression rules saved locally. Patterns marked "always suppress" will be collapsed in future scans.';
      html += '</div>';

      container.innerHTML = html;

      // --- Event Bindings ---

      // Toggle button
      var toggleBtn = container.querySelector('#ns-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          suppressionEnabled = !suppressionEnabled;
          render();
        });
      }

      // Expand/collapse headers
      var headers = container.querySelectorAll('.ns-pattern-header');
      headers.forEach(function (header) {
        header.addEventListener('click', function () {
          var idx = this.getAttribute('data-idx');
          var detail = container.querySelector('[data-detail-idx="' + idx + '"]');
          var icon = this.querySelector('.ns-expand-icon');
          if (detail) {
            var isVisible = detail.style.display !== 'none';
            detail.style.display = isVisible ? 'none' : 'block';
            if (icon) icon.textContent = isVisible ? '[Expand]' : '[Collapse]';
          }
        });
      });

      // Always suppress checkboxes
      var checkboxes = container.querySelectorAll('.ns-always-suppress');
      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
          var patternName = this.getAttribute('data-pattern');
          toggleSuppressedPattern(patternName, this.checked);
        });
      });
    }

    render();
    return container;
  }

  // --- Export ---
  window.renderNoiseSuppressionPanel = renderNoiseSuppressionPanel;

  // --- Self-initialize on DOMContentLoaded ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Panel is ready — call renderNoiseSuppressionPanel(findings) with real data to mount
    });
  }

})();
