/**
 * LogSherlock Pro — Alert Fatigue Scorer
 * Statistically identifies which errors are actionable (signal) vs noise.
 * Tells engineers "You have X findings but only Y matter."
 *
 * Scoring is advisory — always verify critical findings regardless of noise score.
 */
(function () {
  if (typeof window === 'undefined') return;

  // --- Scoring Algorithm Helpers ---

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getRepetitionFactor(count) {
    if (count <= 1) return 0;
    if (count <= 5) return 10;
    if (count <= 20) return 25;
    if (count <= 100) return 35;
    return 40;
  }

  function getSeverityWeight(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') return 0;
    if (s === 'HIGH') return 5;
    if (s === 'MEDIUM') return 15;
    if (s === 'LOW') return 25;
    if (s === 'INFO') return 30;
    return 15; // default to MEDIUM if unknown
  }

  function getFileSpread(fileCount) {
    if (fileCount <= 1) return 0;
    if (fileCount <= 3) return 5;
    if (fileCount <= 10) return 10;
    return 15;
  }

  function getKnownNoiseAdjustment(patternName) {
    const lower = (patternName || '').toLowerCase();
    const signalKeywords = ['critical', 'panic', 'fatal', 'withdraw', 'fence', 'oom'];
    const noiseKeywords = ['warning', 'deprecated', 'info'];

    for (const kw of signalKeywords) {
      if (lower.includes(kw)) return -15;
    }
    for (const kw of noiseKeywords) {
      if (lower.includes(kw)) return 15;
    }
    return 0;
  }

  function classify(noiseScore) {
    if (noiseScore <= 25) return { label: 'SIGNAL', emoji: '🟢', description: 'actionable' };
    if (noiseScore <= 50) return { label: 'REVIEW', emoji: '🟡', description: 'might matter' };
    if (noiseScore <= 75) return { label: 'LIKELY NOISE', emoji: '🟠', description: 'probably ignorable' };
    return { label: 'NOISE', emoji: '🔴', description: 'definitely ignorable' };
  }

  function buildExplanation(repetitionFactor, severityWeight, fileSpread, knownNoiseAdj, count, severity, fileCount, patternName) {
    const parts = [];
    if (repetitionFactor === 0) parts.push('unique occurrence (strong signal)');
    else if (repetitionFactor >= 35) parts.push(`repeated ${count}x (high noise indicator)`);
    else parts.push(`repeated ${count}x`);

    if (severityWeight === 0) parts.push('CRITICAL severity (never noise)');
    else if (severityWeight <= 5) parts.push('HIGH severity');
    else if (severityWeight >= 25) parts.push(`${severity || 'LOW'} severity (likely noise)`);

    if (fileSpread === 0 && fileCount <= 1) parts.push('localized to 1 file');
    else if (fileSpread >= 10) parts.push(`spread across ${fileCount} files (systemic)`);

    if (knownNoiseAdj === -15) parts.push(`pattern "${patternName}" matches known-actionable keywords`);
    else if (knownNoiseAdj === 15) parts.push(`pattern "${patternName}" matches known-noise keywords`);

    return parts.join(' • ');
  }

  // --- Core Scoring Engine ---

  function scoreFindings(findings) {
    if (!findings || !Array.isArray(findings) || findings.length === 0) return [];

    // Group findings by pattern_name
    const groups = {};
    for (const finding of findings) {
      const key = finding.pattern_name || finding.patternName || finding.pattern || finding.message || 'unknown';
      if (!groups[key]) {
        groups[key] = {
          pattern_name: key,
          severity: finding.severity || finding.level || 'MEDIUM',
          files: new Set(),
          count: 0,
          findings: []
        };
      }
      groups[key].count++;
      groups[key].findings.push(finding);
      const file = finding.file || finding.filename || finding.path || finding.source || '';
      if (file) groups[key].files.add(file);
    }

    // Score each group
    const scored = [];
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      const count = group.count;
      const fileCount = group.files.size;
      const severity = (group.severity || 'MEDIUM').toUpperCase();

      const repetitionFactor = getRepetitionFactor(count);
      const severityWeight = getSeverityWeight(severity);
      const fileSpread = getFileSpread(fileCount);
      const knownNoiseAdj = getKnownNoiseAdjustment(key);

      const noiseScore = clamp(repetitionFactor + severityWeight + fileSpread + knownNoiseAdj, 0, 100);
      const classification = classify(noiseScore);
      const explanation = buildExplanation(repetitionFactor, severityWeight, fileSpread, knownNoiseAdj, count, severity, fileCount, key);

      scored.push({
        pattern_name: key,
        severity: severity,
        count: count,
        fileCount: fileCount,
        files: Array.from(group.files),
        noiseScore: noiseScore,
        classification: classification,
        explanation: explanation,
        findings: group.findings
      });
    }

    // Sort: signal first (lowest noise score), then noise last
    scored.sort((a, b) => a.noiseScore - b.noiseScore);
    return scored;
  }

  // --- UI Rendering ---

  function getSeverityBadgeColor(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') return '#ff5555';
    if (s === 'HIGH') return '#ff8c42';
    if (s === 'MEDIUM') return '#f1c40f';
    if (s === 'LOW') return '#01a982';
    if (s === 'INFO') return '#7f8c8d';
    return '#7f8c8d';
  }

  function renderAlertFatiguePanel(findings) {
    const container = document.getElementById('alert-fatigue-panel');
    if (!container) {
      console.warn('[LogSherlock] #alert-fatigue-panel container not found in DOM.');
      return;
    }

    // No findings state
    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      container.innerHTML = `
        <div style="background:#1e1e2e;border:1px solid #333;border-radius:8px;padding:24px;color:#cdd6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;">
          <h2 style="margin:0 0 16px 0;color:#01a982;font-size:1.3rem;">📊 Alert Fatigue Scorer — Signal vs Noise</h2>
          <p style="color:#888;font-style:italic;">Run a scan first to analyze alert fatigue.</p>
        </div>
      `;
      return;
    }

    const scored = scoreFindings(findings);
    const totalFindings = findings.length;
    const signalItems = scored.filter(s => s.classification.label === 'SIGNAL');
    const reviewItems = scored.filter(s => s.classification.label === 'REVIEW');
    const likelyNoiseItems = scored.filter(s => s.classification.label === 'LIKELY NOISE');
    const noiseItems = scored.filter(s => s.classification.label === 'NOISE');

    const signalCount = signalItems.reduce((sum, s) => sum + s.count, 0);
    const reviewCount = reviewItems.reduce((sum, s) => sum + s.count, 0);
    const noiseCount = likelyNoiseItems.reduce((sum, s) => sum + s.count, 0) + noiseItems.reduce((sum, s) => sum + s.count, 0);

    function renderFindingItem(item) {
      const badgeColor = getSeverityBadgeColor(item.severity);
      const fileDisplay = item.files.length > 0 ? item.files[0] + (item.files.length > 1 ? ` (+${item.files.length - 1} more)` : '') : 'unknown file';
      return `
        <div style="padding:10px 14px;margin:6px 0;background:#2a2a3e;border-radius:6px;border-left:3px solid ${badgeColor};">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="background:${badgeColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">${item.severity}</span>
            <span style="color:#cdd6f4;font-weight:500;">${escapeHtml(item.pattern_name)}</span>
            <span style="color:#888;font-size:0.8rem;">${item.classification.emoji} ${item.classification.label} (score: ${item.noiseScore})</span>
          </div>
          <div style="margin-top:6px;color:#888;font-size:0.8rem;">
            📁 ${escapeHtml(fileDisplay)} • ${item.count} occurrence${item.count > 1 ? 's' : ''}
          </div>
          <div style="margin-top:4px;color:#a0a0b0;font-size:0.75rem;font-style:italic;">
            ${escapeHtml(item.explanation)}
          </div>
        </div>
      `;
    }

    function renderSection(title, items, expanded) {
      if (items.length === 0) return '';
      const detailsAttr = expanded ? ' open' : '';
      return `
        <details${detailsAttr} style="margin:12px 0;">
          <summary style="cursor:pointer;color:#01a982;font-weight:600;font-size:0.95rem;padding:6px 0;">
            ${title} (${items.length} pattern${items.length > 1 ? 's' : ''}, ${items.reduce((s, i) => s + i.count, 0)} findings)
          </summary>
          <div style="margin-top:6px;">
            ${items.map(renderFindingItem).join('')}
          </div>
        </details>
      `;
    }

    container.innerHTML = `
      <div style="background:#1e1e2e;border:1px solid #333;border-radius:8px;padding:24px;color:#cdd6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;">
        <h2 style="margin:0 0 16px 0;color:#01a982;font-size:1.3rem;">📊 Alert Fatigue Scorer — Signal vs Noise</h2>

        <!-- Summary Bar -->
        <div style="background:#2a2a3e;border-radius:6px;padding:14px 18px;margin-bottom:16px;font-size:0.9rem;">
          <span style="color:#cdd6f4;">${totalFindings} findings analyzed</span>
          <span style="margin-left:12px;">• <span style="color:#50fa7b;">${signalCount} signal (🟢)</span></span>
          <span style="margin-left:8px;">• <span style="color:#f1fa8c;">${reviewCount} review (🟡)</span></span>
          <span style="margin-left:8px;">• <span style="color:#ff5555;">${noiseCount} noise (🟠🔴)</span></span>
        </div>

        <!-- Recommendation -->
        <div style="background:#1a3a2a;border:1px solid #01a982;border-radius:6px;padding:12px 16px;margin-bottom:18px;">
          <span style="color:#01a982;font-weight:600;">💡 Recommendation:</span>
          <span style="color:#cdd6f4;margin-left:6px;">Focus on these <strong>${signalCount}</strong> findings — the rest are likely noise based on statistical analysis.</span>
        </div>

        <!-- Signal Findings (expanded) -->
        ${renderSection('🟢 SIGNAL — Actionable Findings', signalItems, true)}

        <!-- Review Findings -->
        ${renderSection('🟡 REVIEW — Might Matter', reviewItems, false)}

        <!-- Likely Noise Findings (collapsed) -->
        ${renderSection('🟠 LIKELY NOISE — Probably Ignorable', likelyNoiseItems, false)}

        <!-- Noise Findings (collapsed) -->
        ${renderSection('🔴 NOISE — Definitely Ignorable', noiseItems, false)}

        <!-- Footer / Disclaimer -->
        <div style="margin-top:20px;padding-top:12px;border-top:1px solid #333;color:#666;font-size:0.75rem;font-style:italic;">
          ⚠️ Scoring is statistical — always verify critical findings regardless of noise score. This analysis is advisory, not definitive.
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Initialization ---

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.renderAlertFatiguePanel = renderAlertFatiguePanel;
    });
  } else {
    window.renderAlertFatiguePanel = renderAlertFatiguePanel;
  }

  // Export immediately as well for scripts that load after DOMContentLoaded
  window.renderAlertFatiguePanel = renderAlertFatiguePanel;

})();
