/**
 * LogSherlock Pro — Shareable Analysis Snapshot
 * Export full analysis as a self-contained HTML file for sharing.
 * No external dependencies. Recipients do NOT need a LogSherlock license.
 */
(function () {
  if (typeof window === 'undefined') return;

  // ─── Constants ───────────────────────────────────────────────────────────────
  const COLORS = {
    bg: '#1e1e2e',
    surface: '#2a2a3e',
    border: '#3a3a5e',
    accent: '#01a982',
    accentHover: '#02c999',
    text: '#e0e0e0',
    textMuted: '#a0a0b0',
    critical: '#ff4d6a',
    high: '#ff8c42',
    medium: '#ffd166',
    low: '#06d6a0',
    info: '#64b5f6'
  };

  const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

  // ─── Utility ─────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function formatReadableTimestamp() {
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  function getSeverityBreakdown(findings) {
    const breakdown = {};
    findings.forEach(function (f) {
      const sev = (f.severity || 'info').toLowerCase();
      breakdown[sev] = (breakdown[sev] || 0) + 1;
    });
    return breakdown;
  }

  function getPinnedFindings(findings) {
    return findings.filter(function (f) { return f.pinned === true; });
  }

  // ─── Render Panel ────────────────────────────────────────────────────────────
  function renderSnapshotPanel(findings) {
    var container = document.getElementById('snapshot-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'snapshot-panel';
      document.body.appendChild(container);
    }

    var html = '';

    // Panel wrapper styles
    html += '<div style="background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';border-radius:8px;padding:24px;margin:16px 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:' + COLORS.text + ';">';

    // Section title
    html += '<h2 style="margin:0 0 16px 0;font-size:1.3rem;color:' + COLORS.accent + ';">📤 Shareable Snapshot — Export Analysis</h2>';

    if (!findings || findings.length === 0) {
      // Empty state
      html += '<p style="color:' + COLORS.textMuted + ';font-style:italic;margin:12px 0;">Run a scan first to export a shareable snapshot.</p>';
    } else {
      // Summary
      html += '<p style="margin:0 0 16px 0;font-size:1rem;">' + findings.length + ' findings ready to export</p>';

      // Options checkboxes
      html += '<div style="margin:0 0 20px 0;">';

      // Include findings (always on)
      html += '<label style="display:block;margin:6px 0;cursor:pointer;color:' + COLORS.text + ';">';
      html += '<input type="checkbox" id="snap-opt-findings" checked disabled style="margin-right:8px;accent-color:' + COLORS.accent + ';">☑️ Include findings</label>';

      // Include pinned items (only if pins exist)
      var pinned = getPinnedFindings(findings);
      if (pinned.length > 0) {
        html += '<label style="display:block;margin:6px 0;cursor:pointer;color:' + COLORS.text + ';">';
        html += '<input type="checkbox" id="snap-opt-pins" checked style="margin-right:8px;accent-color:' + COLORS.accent + ';">☑️ Include pinned items (' + pinned.length + ')</label>';
      }

      // Include annotations
      html += '<label style="display:block;margin:6px 0;cursor:pointer;color:' + COLORS.text + ';">';
      html += '<input type="checkbox" id="snap-opt-annotations" checked style="margin-right:8px;accent-color:' + COLORS.accent + ';">☑️ Include annotations</label>';

      // Include severity breakdown chart
      html += '<label style="display:block;margin:6px 0;cursor:pointer;color:' + COLORS.text + ';">';
      html += '<input type="checkbox" id="snap-opt-chart" checked style="margin-right:8px;accent-color:' + COLORS.accent + ';">☑️ Include severity breakdown chart</label>';

      html += '</div>';

      // Buttons
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:0 0 16px 0;">';

      html += '<button id="snap-btn-generate" style="background:' + COLORS.accent + ';color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.2s;">Generate Snapshot</button>';

      html += '<button id="snap-btn-json" style="background:transparent;color:' + COLORS.accent + ';border:1px solid ' + COLORS.accent + ';padding:10px 20px;border-radius:6px;font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.2s;">Copy as JSON</button>';

      html += '</div>';

      // Note
      html += '<p style="color:' + COLORS.textMuted + ';font-size:0.85rem;margin:12px 0 0 0;line-height:1.5;">Snapshots are self-contained HTML files with embedded data. No external dependencies. The recipient does NOT need a LogSherlock license to view.</p>';
    }

    html += '</div>';

    container.innerHTML = html;

    // Attach event listeners if findings exist
    if (findings && findings.length > 0) {
      var generateBtn = document.getElementById('snap-btn-generate');
      var jsonBtn = document.getElementById('snap-btn-json');

      if (generateBtn) {
        generateBtn.addEventListener('click', function () {
          var options = getSelectedOptions(findings);
          var snapshotHtml = generateSnapshot(findings, options);
          downloadSnapshot(snapshotHtml);
        });
        generateBtn.addEventListener('mouseenter', function () {
          this.style.background = COLORS.accentHover;
        });
        generateBtn.addEventListener('mouseleave', function () {
          this.style.background = COLORS.accent;
        });
      }

      if (jsonBtn) {
        jsonBtn.addEventListener('click', function () {
          exportAsJSON(findings);
        });
        jsonBtn.addEventListener('mouseenter', function () {
          this.style.background = COLORS.accent;
          this.style.color = '#fff';
        });
        jsonBtn.addEventListener('mouseleave', function () {
          this.style.background = 'transparent';
          this.style.color = COLORS.accent;
        });
      }
    }
  }

  // ─── Get Selected Options ────────────────────────────────────────────────────
  function getSelectedOptions(findings) {
    var options = {
      includeFindings: true,
      includePins: false,
      includeAnnotations: false,
      includeChart: false
    };

    var pinsEl = document.getElementById('snap-opt-pins');
    var annotEl = document.getElementById('snap-opt-annotations');
    var chartEl = document.getElementById('snap-opt-chart');

    if (pinsEl) options.includePins = pinsEl.checked;
    if (annotEl) options.includeAnnotations = annotEl.checked;
    if (chartEl) options.includeChart = chartEl.checked;

    return options;
  }

  // ─── Generate Snapshot HTML ──────────────────────────────────────────────────
  function generateSnapshot(findings, options) {
    if (!findings || findings.length === 0) return '';

    options = options || {
      includeFindings: true,
      includePins: true,
      includeAnnotations: true,
      includeChart: true
    };

    var timestamp = formatReadableTimestamp();
    var breakdown = getSeverityBreakdown(findings);
    var pinned = getPinnedFindings(findings);

    var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += '<title>LogSherlock Pro — Analysis Snapshot</title>\n';
    html += '</head>\n<body style="margin:0;padding:0;background:' + COLORS.bg + ';color:' + COLORS.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Oxygen,Ubuntu,sans-serif;line-height:1.6;">\n';

    // Main container
    html += '<div style="max-width:1100px;margin:0 auto;padding:32px 24px;">\n';

    // Header
    html += '<header style="border-bottom:2px solid ' + COLORS.accent + ';padding-bottom:20px;margin-bottom:32px;">\n';
    html += '<h1 style="margin:0;font-size:1.8rem;color:' + COLORS.accent + ';">🔍 LogSherlock Pro — Analysis Snapshot</h1>\n';
    html += '<p style="margin:8px 0 0 0;color:' + COLORS.textMuted + ';font-size:0.9rem;">This is a read-only snapshot. For full analysis capabilities, use LogSherlock Pro.</p>\n';
    html += '</header>\n';

    // Metadata
    html += '<section style="background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';border-radius:8px;padding:20px;margin-bottom:24px;">\n';
    html += '<h2 style="margin:0 0 12px 0;font-size:1.1rem;color:' + COLORS.accent + ';">📊 Analysis Summary</h2>\n';
    html += '<table style="width:100%;border-collapse:collapse;">\n';
    html += '<tr><td style="padding:6px 12px;color:' + COLORS.textMuted + ';">Generated</td><td style="padding:6px 12px;">' + escapeHtml(timestamp) + '</td></tr>\n';
    html += '<tr><td style="padding:6px 12px;color:' + COLORS.textMuted + ';">Total Findings</td><td style="padding:6px 12px;font-weight:600;">' + findings.length + '</td></tr>\n';

    // Severity breakdown in metadata
    html += '<tr><td style="padding:6px 12px;color:' + COLORS.textMuted + ';">Severity Breakdown</td><td style="padding:6px 12px;">';
    SEVERITY_ORDER.forEach(function (sev) {
      if (breakdown[sev]) {
        var sevColor = COLORS[sev] || COLORS.info;
        html += '<span style="display:inline-block;margin-right:12px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + sevColor + ';margin-right:4px;vertical-align:middle;"></span>' + sev.charAt(0).toUpperCase() + sev.slice(1) + ': ' + breakdown[sev] + '</span>';
      }
    });
    html += '</td></tr>\n';
    html += '</table>\n';
    html += '</section>\n';

    // Severity breakdown chart (optional)
    if (options.includeChart) {
      html += '<section style="background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';border-radius:8px;padding:20px;margin-bottom:24px;">\n';
      html += '<h2 style="margin:0 0 16px 0;font-size:1.1rem;color:' + COLORS.accent + ';">📈 Severity Distribution</h2>\n';
      html += '<div style="display:flex;flex-direction:column;gap:8px;">\n';

      var maxCount = 0;
      SEVERITY_ORDER.forEach(function (sev) {
        if (breakdown[sev] && breakdown[sev] > maxCount) maxCount = breakdown[sev];
      });

      SEVERITY_ORDER.forEach(function (sev) {
        var count = breakdown[sev] || 0;
        if (count === 0) return;
        var pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
        var sevColor = COLORS[sev] || COLORS.info;
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<span style="min-width:70px;font-size:0.85rem;text-transform:capitalize;color:' + COLORS.textMuted + ';">' + sev + '</span>';
        html += '<div style="flex:1;background:' + COLORS.bg + ';border-radius:4px;height:22px;overflow:hidden;">';
        html += '<div style="width:' + pct + '%;height:100%;background:' + sevColor + ';border-radius:4px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '<span style="min-width:30px;text-align:right;font-size:0.85rem;font-weight:600;">' + count + '</span>';
        html += '</div>\n';
      });

      html += '</div>\n';
      html += '</section>\n';
    }

    // Findings table with severity filter using details/summary
    html += '<section style="margin-bottom:24px;">\n';
    html += '<h2 style="margin:0 0 16px 0;font-size:1.1rem;color:' + COLORS.accent + ';">🔎 Findings</h2>\n';

    // Group by severity for filtering
    SEVERITY_ORDER.forEach(function (sev) {
      var sevFindings = findings.filter(function (f) {
        return (f.severity || 'info').toLowerCase() === sev;
      });
      if (sevFindings.length === 0) return;

      var sevColor = COLORS[sev] || COLORS.info;
      html += '<details open style="margin-bottom:12px;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';border-radius:8px;overflow:hidden;">\n';
      html += '<summary style="padding:12px 16px;cursor:pointer;font-weight:600;color:' + sevColor + ';background:' + COLORS.bg + ';border-bottom:1px solid ' + COLORS.border + ';user-select:none;">';
      html += sev.charAt(0).toUpperCase() + sev.slice(1) + ' (' + sevFindings.length + ')';
      html += '</summary>\n';

      html += '<div style="overflow-x:auto;">\n';
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">\n';
      html += '<thead><tr style="background:' + COLORS.bg + ';">';
      html += '<th style="padding:10px 12px;text-align:left;color:' + COLORS.textMuted + ';border-bottom:1px solid ' + COLORS.border + ';white-space:nowrap;">Severity</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:' + COLORS.textMuted + ';border-bottom:1px solid ' + COLORS.border + ';white-space:nowrap;">Pattern</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:' + COLORS.textMuted + ';border-bottom:1px solid ' + COLORS.border + ';white-space:nowrap;">File</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:' + COLORS.textMuted + ';border-bottom:1px solid ' + COLORS.border + ';white-space:nowrap;">Line</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:' + COLORS.textMuted + ';border-bottom:1px solid ' + COLORS.border + ';">Content</th>';
      html += '</tr></thead>\n<tbody>\n';

      sevFindings.forEach(function (f, idx) {
        var rowBg = idx % 2 === 0 ? 'transparent' : COLORS.bg;
        var content = (f.line_content || '').substring(0, 200);
        html += '<tr style="background:' + rowBg + ';">';
        html += '<td style="padding:8px 12px;border-bottom:1px solid ' + COLORS.border + ';vertical-align:top;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:' + sevColor + '22;color:' + sevColor + ';font-size:0.8rem;font-weight:600;text-transform:uppercase;">' + escapeHtml(f.severity || 'info') + '</span></td>';
        html += '<td style="padding:8px 12px;border-bottom:1px solid ' + COLORS.border + ';vertical-align:top;white-space:nowrap;">' + escapeHtml(f.pattern_name || f.pattern || 'Unknown') + '</td>';
        html += '<td style="padding:8px 12px;border-bottom:1px solid ' + COLORS.border + ';vertical-align:top;color:' + COLORS.textMuted + ';word-break:break-all;max-width:200px;">' + escapeHtml(f.file || '') + '</td>';
        html += '<td style="padding:8px 12px;border-bottom:1px solid ' + COLORS.border + ';vertical-align:top;white-space:nowrap;">' + escapeHtml(String(f.line_number || f.line || '—')) + '</td>';
        html += '<td style="padding:8px 12px;border-bottom:1px solid ' + COLORS.border + ';vertical-align:top;font-family:\'Courier New\',monospace;font-size:0.8rem;color:' + COLORS.textMuted + ';word-break:break-all;">' + escapeHtml(content) + '</td>';
        html += '</tr>\n';
      });

      html += '</tbody></table>\n</div>\n';
      html += '</details>\n';
    });

    html += '</section>\n';

    // Pinned items section (optional)
    if (options.includePins && pinned.length > 0) {
      html += '<section style="background:' + COLORS.surface + ';border:1px solid ' + COLORS.accent + ';border-radius:8px;padding:20px;margin-bottom:24px;">\n';
      html += '<h2 style="margin:0 0 16px 0;font-size:1.1rem;color:' + COLORS.accent + ';">📌 Pinned Findings</h2>\n';

      pinned.forEach(function (f) {
        html += '<div style="background:' + COLORS.bg + ';border:1px solid ' + COLORS.border + ';border-left:3px solid ' + COLORS.accent + ';border-radius:6px;padding:14px;margin-bottom:10px;">\n';
        var sevColor = COLORS[(f.severity || 'info').toLowerCase()] || COLORS.info;
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
        html += '<span style="padding:2px 8px;border-radius:4px;background:' + sevColor + '22;color:' + sevColor + ';font-size:0.8rem;font-weight:600;text-transform:uppercase;">' + escapeHtml(f.severity || 'info') + '</span>';
        html += '<span style="font-weight:600;">' + escapeHtml(f.pattern_name || f.pattern || 'Unknown') + '</span>';
        html += '<span style="color:' + COLORS.textMuted + ';font-size:0.85rem;margin-left:auto;">' + escapeHtml(f.file || '') + ':' + escapeHtml(String(f.line_number || f.line || '')) + '</span>';
        html += '</div>\n';

        var content = (f.line_content || '').substring(0, 200);
        html += '<p style="margin:6px 0;font-family:\'Courier New\',monospace;font-size:0.82rem;color:' + COLORS.textMuted + ';word-break:break-all;">' + escapeHtml(content) + '</p>\n';

        // Annotation
        if (options.includeAnnotations && f.annotation) {
          html += '<p style="margin:8px 0 0 0;padding:8px 12px;background:' + COLORS.surface + ';border-radius:4px;font-size:0.85rem;color:' + COLORS.text + ';border-left:2px solid ' + COLORS.accent + ';">💬 ' + escapeHtml(f.annotation) + '</p>\n';
        }

        html += '</div>\n';
      });

      html += '</section>\n';
    }

    // Annotations section (for non-pinned annotated findings)
    if (options.includeAnnotations) {
      var annotated = findings.filter(function (f) {
        return f.annotation && !f.pinned;
      });
      if (annotated.length > 0) {
        html += '<section style="background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';border-radius:8px;padding:20px;margin-bottom:24px;">\n';
        html += '<h2 style="margin:0 0 16px 0;font-size:1.1rem;color:' + COLORS.accent + ';">💬 Annotations</h2>\n';

        annotated.forEach(function (f) {
          html += '<div style="background:' + COLORS.bg + ';border:1px solid ' + COLORS.border + ';border-radius:6px;padding:12px;margin-bottom:8px;">\n';
          html += '<div style="font-size:0.85rem;color:' + COLORS.textMuted + ';margin-bottom:4px;">' + escapeHtml(f.pattern_name || f.pattern || 'Unknown') + ' • ' + escapeHtml(f.file || '') + ':' + escapeHtml(String(f.line_number || f.line || '')) + '</div>\n';
          html += '<div style="font-size:0.9rem;color:' + COLORS.text + ';">💬 ' + escapeHtml(f.annotation) + '</div>\n';
          html += '</div>\n';
        });

        html += '</section>\n';
      }
    }

    // Footer
    html += '<footer style="border-top:1px solid ' + COLORS.border + ';padding-top:20px;margin-top:32px;text-align:center;color:' + COLORS.textMuted + ';font-size:0.82rem;">\n';
    html += '<p style="margin:0 0 8px 0;">Generated by LogSherlock Pro • ' + escapeHtml(timestamp) + ' • Read-only snapshot</p>\n';
    html += '<p style="margin:0;color:' + COLORS.textMuted + ';">This is a read-only snapshot. For full analysis capabilities, use LogSherlock Pro.</p>\n';
    html += '</footer>\n';

    // Close container and body
    html += '</div>\n</body>\n</html>';

    return html;
  }

  // ─── Download Snapshot ───────────────────────────────────────────────────────
  function downloadSnapshot(htmlContent) {
    if (!htmlContent) return;

    var filename = 'logsherlock-snapshot-' + formatTimestamp() + '.html';
    var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ─── Export as JSON ──────────────────────────────────────────────────────────
  function exportAsJSON(findings) {
    if (!findings || findings.length === 0) return;

    var json = JSON.stringify(findings, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () {
        showCopyFeedback('✅ Findings copied to clipboard as JSON');
      }).catch(function () {
        fallbackCopy(json);
      });
    } else {
      fallbackCopy(json);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopyFeedback('✅ Findings copied to clipboard as JSON');
    } catch (e) {
      showCopyFeedback('❌ Failed to copy. Check browser permissions.');
    }
    document.body.removeChild(textarea);
  }

  function showCopyFeedback(message) {
    var existing = document.getElementById('snap-copy-feedback');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'snap-copy-feedback';
    el.textContent = message;
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' + COLORS.surface + ';color:' + COLORS.accent + ';border:1px solid ' + COLORS.accent + ';padding:12px 20px;border-radius:8px;font-size:0.9rem;font-family:-apple-system,BlinkMacSystemFont,sans-serif;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
    document.body.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 3000);
  }

  // ─── Self-Initialize ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Ready — panel will render when renderSnapshotPanel is called with findings
    });
  }

  // ─── Export to window ────────────────────────────────────────────────────────
  window.renderSnapshotPanel = renderSnapshotPanel;
  window.generateSnapshot = generateSnapshot;

})();
