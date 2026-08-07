/**
 * LogSherlock Pro - Guided Mode Wizard
 * Turns junior L1/L2 engineers into power users with step-by-step investigation guidance.
 * Standalone module - no modifications to other files required.
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentStep = 0;
  let ticketType = null;
  let scanFindings = null;
  let draftResponse = '';
  let overlayEl = null;

  const TICKET_TYPES = ['VM Issue', 'Storage Issue', 'Cluster Issue', 'Network Issue', 'Performance Issue', 'Unknown'];
  const TOTAL_STEPS = 7;

  // ─── Styles ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('guided-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'guided-mode-styles';
    style.textContent = `
      .gm-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        animation: gm-fadeIn 0.3s ease;
      }
      @keyframes gm-fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes gm-slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes gm-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      @keyframes gm-spin { to { transform: rotate(360deg); } }
      @keyframes gm-progressBar { from { width: 0%; } to { width: 100%; } }

      .gm-modal {
        background: #1a1d23; border: 1px solid #2d3139; border-radius: 16px;
        width: 90%; max-width: 640px; max-height: 85vh; overflow-y: auto;
        padding: 32px; color: #e4e7eb;
        box-shadow: 0 25px 60px rgba(0,0,0,0.5);
        animation: gm-slideUp 0.4s ease;
      }

      .gm-step-indicator {
        display: flex; align-items: center; justify-content: center;
        gap: 8px; margin-bottom: 28px;
      }
      .gm-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #3a3f47; transition: all 0.3s ease;
      }
      .gm-dot.active { background: #6366f1; transform: scale(1.3); }
      .gm-dot.completed { background: #22c55e; }

      .gm-title {
        font-size: 1.4rem; font-weight: 700; margin-bottom: 8px;
        color: #fff;
      }
      .gm-subtitle {
        font-size: 0.9rem; color: #9ca3af; margin-bottom: 24px;
      }

      .gm-btn {
        padding: 10px 20px; border-radius: 8px; border: none;
        font-size: 0.9rem; font-weight: 600; cursor: pointer;
        transition: all 0.2s ease;
      }
      .gm-btn-primary {
        background: #6366f1; color: #fff;
      }
      .gm-btn-primary:hover { background: #4f46e5; transform: translateY(-1px); }
      .gm-btn-secondary {
        background: #2d3139; color: #e4e7eb;
      }
      .gm-btn-secondary:hover { background: #3a3f47; }
      .gm-btn-ghost {
        background: transparent; color: #9ca3af; border: 1px solid #3a3f47;
      }
      .gm-btn-ghost:hover { border-color: #6366f1; color: #6366f1; }

      .gm-nav {
        display: flex; justify-content: space-between; margin-top: 28px;
        padding-top: 20px; border-top: 1px solid #2d3139;
      }

      .gm-ticket-grid {
        display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
      }
      .gm-ticket-btn {
        padding: 16px; border-radius: 10px; border: 2px solid #2d3139;
        background: #22252b; color: #e4e7eb; font-size: 0.95rem;
        font-weight: 500; cursor: pointer; transition: all 0.2s ease;
        text-align: center;
      }
      .gm-ticket-btn:hover { border-color: #6366f1; background: #2a2d35; }
      .gm-ticket-btn.selected { border-color: #6366f1; background: #2d2f6b; }

      .gm-upload-zone {
        border: 2px dashed #3a3f47; border-radius: 12px;
        padding: 40px 24px; text-align: center; color: #9ca3af;
        transition: all 0.2s ease;
      }
      .gm-upload-zone:hover { border-color: #6366f1; }

      .gm-scanner {
        display: flex; flex-direction: column; align-items: center;
        padding: 40px 0; gap: 20px;
      }
      .gm-spinner {
        width: 48px; height: 48px; border: 4px solid #2d3139;
        border-top-color: #6366f1; border-radius: 50%;
        animation: gm-spin 1s linear infinite;
      }
      .gm-progress-bar {
        width: 100%; height: 6px; background: #2d3139; border-radius: 3px;
        overflow: hidden;
      }
      .gm-progress-fill {
        height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6);
        border-radius: 3px; animation: gm-progressBar 4s ease forwards;
      }

      .gm-findings-list {
        list-style: none; padding: 0; margin: 0;
      }
      .gm-findings-list li {
        padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;
        background: #22252b; border-left: 3px solid #6366f1;
        font-size: 0.9rem; line-height: 1.5;
      }

      .gm-actions-list {
        list-style: none; padding: 0; margin: 0; counter-reset: actions;
      }
      .gm-actions-list li {
        padding: 12px 16px 12px 48px; border-radius: 8px; margin-bottom: 8px;
        background: #22252b; font-size: 0.9rem; line-height: 1.5;
        position: relative;
      }
      .gm-actions-list li::before {
        counter-increment: actions; content: counter(actions);
        position: absolute; left: 16px; top: 12px;
        width: 22px; height: 22px; border-radius: 50%;
        background: #6366f1; color: #fff; font-size: 0.75rem;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700;
      }

      .gm-textarea {
        width: 100%; min-height: 180px; background: #22252b;
        border: 1px solid #3a3f47; border-radius: 10px;
        color: #e4e7eb; padding: 16px; font-size: 0.9rem;
        line-height: 1.6; resize: vertical; font-family: inherit;
      }
      .gm-textarea:focus { outline: none; border-color: #6366f1; }

      .gm-copy-success {
        display: inline-block; padding: 8px 16px; background: #166534;
        color: #22c55e; border-radius: 8px; font-weight: 600;
        animation: gm-pulse 0.5s ease;
      }

      .gm-guided-panel {
        background: #1a1d23; border: 1px solid #2d3139; border-radius: 14px;
        padding: 24px; margin-top: 16px; color: #e4e7eb;
      }
      .gm-priority-badge {
        display: inline-block; padding: 8px 20px; border-radius: 20px;
        font-size: 1.1rem; font-weight: 700; margin-bottom: 16px;
      }
      .gm-priority-p1 { background: #7f1d1d; color: #fca5a5; }
      .gm-priority-p2 { background: #7c2d12; color: #fdba74; }
      .gm-priority-p3 { background: #713f12; color: #fde047; }
      .gm-priority-p4 { background: #14532d; color: #86efac; }

      .gm-panel-section { margin-bottom: 18px; }
      .gm-panel-section h4 {
        font-size: 0.85rem; color: #9ca3af; margin-bottom: 6px;
        text-transform: uppercase; letter-spacing: 0.5px;
      }

      .gm-start-btn {
        padding: 12px 24px; border-radius: 10px; border: none;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff; font-size: 0.95rem; font-weight: 600;
        cursor: pointer; transition: all 0.2s ease;
        display: inline-flex; align-items: center; gap: 8px;
      }
      .gm-start-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
    `;
    document.head.appendChild(style);
  }


  // ─── Step Renderers ────────────────────────────────────────────────────────

  function renderStepIndicator() {
    let dots = '';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const cls = i === currentStep ? 'active' : i < currentStep ? 'completed' : '';
      dots += `<div class="gm-dot ${cls}"></div>`;
    }
    return `<div class="gm-step-indicator">${dots}</div>`;
  }

  function renderStep1() {
    const buttons = TICKET_TYPES.map(t => {
      const selected = ticketType === t ? 'selected' : '';
      return `<button class="gm-ticket-btn ${selected}" data-ticket="${t}">${t}</button>`;
    }).join('');

    return `
      <div class="gm-title">What type of ticket is this?</div>
      <div class="gm-subtitle">Select the category that best matches the customer's issue.</div>
      <div class="gm-ticket-grid">${buttons}</div>
    `;
  }

  function renderStep2() {
    return `
      <div class="gm-title">Upload the log bundle</div>
      <div class="gm-subtitle">Drag & drop a log bundle or select the file path.</div>
      <div class="gm-upload-zone">
        <div style="font-size:2.5rem;margin-bottom:12px;">📁</div>
        <div style="font-weight:600;color:#e4e7eb;margin-bottom:8px;">Drop log bundle here</div>
        <div style="font-size:0.85rem;">Supports .zip, .tar.gz, .log, .txt, or folder path</div>
        <div style="margin-top:16px;padding:10px;background:#22252b;border-radius:8px;font-family:monospace;font-size:0.8rem;color:#6366f1;">
          💡 Hint: C:\\Logs\\customer-bundle-YYYYMMDD.zip
        </div>
      </div>
    `;
  }

  function renderStep3() {
    return `
      <div class="gm-title">Scanning...</div>
      <div class="gm-subtitle">Analyzing logs for patterns, errors, and anomalies.</div>
      <div class="gm-scanner">
        <div class="gm-spinner"></div>
        <div class="gm-progress-bar"><div class="gm-progress-fill"></div></div>
        <div style="font-size:0.85rem;color:#9ca3af;">This usually takes 10-30 seconds</div>
      </div>
    `;
  }

  function renderStep4() {
    const findings = getFindings();
    const items = findings.slice(0, 5).map(f => `<li>${f}</li>`).join('');
    return `
      <div class="gm-title">Key Findings Summary</div>
      <div class="gm-subtitle">Here's what the logs revealed — in plain English.</div>
      <ul class="gm-findings-list">${items}</ul>
    `;
  }

  function renderStep5() {
    const actions = getRecommendedActions();
    const items = actions.map(a => `<li>${a}</li>`).join('');
    return `
      <div class="gm-title">Recommended Actions</div>
      <div class="gm-subtitle">Follow these steps in order to resolve the issue.</div>
      <ul class="gm-actions-list">${items}</ul>
    `;
  }

  function renderStep6() {
    const findings = getFindings();
    const actions = getRecommendedActions();
    const template = `Hi [Customer],

I've analyzed the logs and found the following:

${findings.slice(0, 3).map((f, i) => `${i + 1}. ${f}`).join('\n')}

The recommended next step is:
${actions[0] || 'Further investigation required.'}

${actions.length > 1 ? `Additional steps if needed:\n${actions.slice(1, 3).map((a, i) => `${i + 2}. ${a}`).join('\n')}` : ''}

Please let me know if you have any questions.

Best regards,
[Your Name]`;

    draftResponse = template;
    return `
      <div class="gm-title">Draft Your Response</div>
      <div class="gm-subtitle">Edit the template below, then proceed to copy it.</div>
      <textarea class="gm-textarea" id="gm-draft-textarea">${template}</textarea>
    `;
  }

  function renderStep7() {
    return `
      <div class="gm-title">Done! 🎉</div>
      <div class="gm-subtitle">Your response is ready. Copy it and paste into your ticket.</div>
      <div style="text-align:center;padding:24px 0;">
        <button class="gm-btn gm-btn-primary" id="gm-copy-btn" style="font-size:1.1rem;padding:14px 32px;">
          📋 Copy Response to Clipboard
        </button>
        <div id="gm-copy-feedback" style="margin-top:16px;"></div>
      </div>
    `;
  }


  // ─── Context-Aware Findings & Actions ──────────────────────────────────────

  function getFindings() {
    if (scanFindings && scanFindings.length) {
      return scanFindings.map(f => typeof f === 'string' ? f : f.summary || f.message || String(f));
    }
    // Default findings based on ticket type
    const defaults = {
      'VM Issue': [
        'Virtual machine experienced a kernel panic at 03:42 AM',
        'Memory usage spiked to 98% before the crash',
        'VMware Tools service was unresponsive for 15 minutes',
        'Snapshot consolidation was pending for 3 days',
        'Guest OS disk I/O latency exceeded 200ms'
      ],
      'Storage Issue': [
        'RAID controller reported 2 degraded disks in Array-B',
        'LUN path failover occurred 14 times in the last hour',
        'Storage latency averaged 85ms (threshold: 20ms)',
        'Thin-provisioned datastore is 94% full',
        'SCSI sense errors detected on paths vmhba2:C0:T1:L3'
      ],
      'Cluster Issue': [
        'Node esxi-03 lost heartbeat connectivity for 47 seconds',
        'HA failover triggered but 2 VMs did not restart',
        'Cluster admission control is blocking VM power-on operations',
        'DRS imbalance detected — one host at 89% CPU while others idle',
        'vMotion network has intermittent packet loss (3.2%)'
      ],
      'Network Issue': [
        'Uplink vmnic1 showing CRC errors (1,247 in last hour)',
        'Distributed switch port group has MTU mismatch (1500 vs 9000)',
        'ARP storm detected originating from VM "web-prod-04"',
        'DNS resolution failing intermittently for internal domains',
        'Network I/O control throttling VM traffic due to share contention'
      ],
      'Performance Issue': [
        'CPU ready time averaging 12% across all VMs on host',
        'Memory balloon driver reclaiming 8GB from production VMs',
        'Storage IOPS capped at controller queue depth limit',
        'VM swap file activity detected (host memory overcommitted)',
        'Network throughput dropped 60% after recent vSwitch change'
      ],
      'Unknown': [
        'Multiple warning-level events detected across subsystems',
        'Log timestamps show 45-minute gap suggesting service restart',
        'Authentication failures spiked at 02:15 AM (possible lockout)',
        'Service watchdog restarted hostd 3 times in 24 hours',
        'Correlated errors found in both storage and network layers'
      ]
    };
    return defaults[ticketType] || defaults['Unknown'];
  }

  function getRecommendedActions() {
    const actions = {
      'VM Issue': [
        'Check VM event log for the exact crash trigger and timestamp',
        'Review memory/CPU reservation settings — right-size if overcommitted',
        'Consolidate pending snapshots to free locked disk space',
        'Verify VMware Tools is up to date and running',
        'Monitor for recurrence over 24 hours before closing'
      ],
      'Storage Issue': [
        'Check physical disk health via iLO/iDRAC and schedule replacement',
        'Verify all storage paths are active (esxcli storage core path list)',
        'Expand datastore or migrate VMs to free space below 85% threshold',
        'Run storage performance test during low-traffic window',
        'Engage storage vendor if RAID rebuild does not complete in 4 hours'
      ],
      'Cluster Issue': [
        'Verify management network connectivity on isolated host',
        'Check HA agent status and restart if needed (vim-cmd hostsvc/autostartmanager)',
        'Review admission control settings — adjust for current cluster capacity',
        'Manually balance VMs or trigger DRS recommendation review',
        'Check vMotion VMkernel adapter for IP conflicts'
      ],
      'Network Issue': [
        'Replace cable or SFP on the affected uplink port',
        'Align MTU settings across physical switches and virtual port groups',
        'Isolate the VM generating excessive broadcasts',
        'Verify DNS server health and update /etc/resolv.conf if needed',
        'Review Network I/O Control shares and limits'
      ],
      'Performance Issue': [
        'Reduce VM-to-host ratio or migrate VMs to less loaded hosts',
        'Increase host memory or set memory reservations for critical VMs',
        'Check storage array queue depth and increase if below recommendation',
        'Disable transparent page sharing if security concern, or enable if needed',
        'Revert recent network change and compare before/after throughput'
      ],
      'Unknown': [
        'Gather additional context from the customer about when the issue started',
        'Check all subsystem health dashboards for correlated events',
        'Review recent change records — patches, updates, config changes',
        'Collect a fresh log bundle after reproducing the issue',
        'Escalate to L3 if no clear root cause after 30 minutes of analysis'
      ]
    };
    return actions[ticketType] || actions['Unknown'];
  }

  function determinePriority(findings) {
    if (!findings) return { level: 'P3', color: 'gm-priority-p3' };
    const text = (Array.isArray(findings) ? findings.join(' ') : String(findings)).toLowerCase();
    if (text.includes('crash') || text.includes('panic') || text.includes('outage') || text.includes('data loss'))
      return { level: 'P1', color: 'gm-priority-p1' };
    if (text.includes('degraded') || text.includes('failover') || text.includes('spike') || text.includes('storm'))
      return { level: 'P2', color: 'gm-priority-p2' };
    if (text.includes('warning') || text.includes('intermittent') || text.includes('slow'))
      return { level: 'P3', color: 'gm-priority-p3' };
    return { level: 'P4', color: 'gm-priority-p4' };
  }

  function getEstimatedTime() {
    const times = {
      'VM Issue': '30-60 minutes',
      'Storage Issue': '1-4 hours (may need hardware replacement)',
      'Cluster Issue': '45-90 minutes',
      'Network Issue': '30-60 minutes',
      'Performance Issue': '1-2 hours',
      'Unknown': '1-3 hours (investigation dependent)'
    };
    return times[ticketType] || times['Unknown'];
  }

  function getEscalationConditions() {
    const conditions = {
      'VM Issue': ['VM won\'t boot after 2 restart attempts', 'Data corruption suspected', 'Multiple VMs affected simultaneously'],
      'Storage Issue': ['More than 2 disks failed', 'Data loss confirmed', 'Array controller unresponsive'],
      'Cluster Issue': ['Multiple hosts isolated', 'HA completely non-functional', 'Split-brain scenario detected'],
      'Network Issue': ['Complete network partition', 'Core switch failure', 'Security breach indicators'],
      'Performance Issue': ['Customer SLA breached', 'Production outage resulting from performance', 'Issue persists after all recommended steps'],
      'Unknown': ['No root cause found after 30 minutes', 'Customer reports data loss', 'Issue is spreading to other systems']
    };
    return conditions[ticketType] || conditions['Unknown'];
  }


  // ─── Modal Rendering & Navigation ─────────────────────────────────────────

  function renderModal() {
    const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];
    const stepContent = stepRenderers[currentStep]();
    const showBack = currentStep > 0 && currentStep !== 2;
    const showNext = currentStep < TOTAL_STEPS - 1 && currentStep !== 2;
    const isLastStep = currentStep === TOTAL_STEPS - 1;

    let nav = '<div class="gm-nav">';
    nav += showBack ? '<button class="gm-btn gm-btn-ghost" id="gm-back">← Back</button>' : '<div></div>';
    if (isLastStep) {
      nav += '<button class="gm-btn gm-btn-secondary" id="gm-close">Close Wizard</button>';
    } else if (showNext) {
      nav += '<button class="gm-btn gm-btn-primary" id="gm-next">Next →</button>';
    } else {
      nav += '<div></div>';
    }
    nav += '</div>';

    const html = `
      <div class="gm-modal">
        ${renderStepIndicator()}
        <div id="gm-step-content">${stepContent}</div>
        ${currentStep !== 2 ? nav : ''}
      </div>
    `;

    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'gm-overlay';
      overlayEl.id = 'gm-overlay';
      document.body.appendChild(overlayEl);
    }
    overlayEl.innerHTML = html;
    attachStepEvents();
  }

  function attachStepEvents() {
    // Navigation buttons
    const backBtn = document.getElementById('gm-back');
    const nextBtn = document.getElementById('gm-next');
    const closeBtn = document.getElementById('gm-close');

    if (backBtn) backBtn.addEventListener('click', goBack);
    if (nextBtn) nextBtn.addEventListener('click', goNext);
    if (closeBtn) closeBtn.addEventListener('click', closeWizard);

    // Step 1: Ticket type selection
    if (currentStep === 0) {
      document.querySelectorAll('.gm-ticket-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          ticketType = btn.dataset.ticket;
          document.querySelectorAll('.gm-ticket-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    }

    // Step 3: Auto-advance after scan
    if (currentStep === 2) {
      setTimeout(() => {
        currentStep = 3;
        renderModal();
      }, 4000);
    }

    // Step 6: Track textarea changes
    if (currentStep === 5) {
      const textarea = document.getElementById('gm-draft-textarea');
      if (textarea) {
        textarea.addEventListener('input', () => { draftResponse = textarea.value; });
      }
    }

    // Step 7: Copy button
    if (currentStep === 6) {
      const copyBtn = document.getElementById('gm-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const text = draftResponse || 'No response drafted.';
          navigator.clipboard.writeText(text).then(() => {
            const feedback = document.getElementById('gm-copy-feedback');
            if (feedback) feedback.innerHTML = '<span class="gm-copy-success">✓ Copied to clipboard!</span>';
          }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            const feedback = document.getElementById('gm-copy-feedback');
            if (feedback) feedback.innerHTML = '<span class="gm-copy-success">✓ Copied!</span>';
          });
        });
      }
    }

    // Close on backdrop click
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closeWizard();
    });
  }

  function goNext() {
    if (currentStep === 0 && !ticketType) {
      // Require selection
      const grid = document.querySelector('.gm-ticket-grid');
      if (grid) grid.style.animation = 'gm-pulse 0.3s ease';
      return;
    }
    if (currentStep < TOTAL_STEPS - 1) {
      currentStep++;
      renderModal();
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
      if (currentStep === 2) currentStep = 1; // Skip scanning step when going back
      renderModal();
    }
  }

  function closeWizard() {
    if (overlayEl) {
      overlayEl.style.animation = 'none';
      overlayEl.style.opacity = '0';
      overlayEl.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        if (overlayEl && overlayEl.parentNode) {
          overlayEl.parentNode.removeChild(overlayEl);
        }
        overlayEl = null;
      }, 300);
    }
    // Reset state
    currentStep = 0;
    scanFindings = null;
    draftResponse = '';
  }

  // ─── Keyboard Navigation ──────────────────────────────────────────────────

  function handleKeydown(e) {
    if (!overlayEl) return;
    if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
      e.preventDefault();
      goBack();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeWizard();
    }
  }

  // ─── Exported Functions ───────────────────────────────────────────────────

  function renderGuidedModeButton() {
    return `
      <button class="gm-start-btn" onclick="startGuidedMode()">
        🧙‍♂️ Start Guided Investigation
      </button>
    `;
  }

  function startGuidedMode() {
    injectStyles();
    currentStep = 0;
    ticketType = null;
    scanFindings = null;
    draftResponse = '';
    renderModal();
    document.addEventListener('keydown', handleKeydown);
  }

  function renderGuidedPanel(findings) {
    injectStyles();
    scanFindings = findings;
    const findingsList = getFindings();
    const priority = determinePriority(findingsList);
    const actions = getRecommendedActions();
    const estTime = getEstimatedTime();
    const escalation = getEscalationConditions();

    const summaryText = findingsList.slice(0, 3).join('. ') + '.';
    const actionItems = actions.slice(0, 4).map((a, i) => `<li>${a}</li>`).join('');
    const escalationItems = escalation.map(c => `<li style="color:#fca5a5;">⚠️ ${c}</li>`).join('');

    return `
      <div class="gm-guided-panel">
        <div class="gm-panel-section">
          <h4>🚨 Priority</h4>
          <span class="gm-priority-badge ${priority.color}">${priority.level}</span>
        </div>

        <div class="gm-panel-section">
          <h4>📝 Summary</h4>
          <p style="line-height:1.6;font-size:0.92rem;">${summaryText}</p>
        </div>

        <div class="gm-panel-section">
          <h4>🔧 What to do next</h4>
          <ol class="gm-actions-list">${actionItems}</ol>
        </div>

        <div class="gm-panel-section">
          <h4>⏱️ Estimated time to fix</h4>
          <p style="font-size:1rem;font-weight:600;color:#6366f1;">${estTime}</p>
        </div>

        <div class="gm-panel-section">
          <h4>📞 When to escalate</h4>
          <ul style="list-style:none;padding:0;margin:0;">${escalationItems}</ul>
        </div>
      </div>
    `;
  }

  // ─── Global Exports & Self-Initialization ─────────────────────────────────

  window.renderGuidedModeButton = renderGuidedModeButton;
  window.startGuidedMode = startGuidedMode;
  window.renderGuidedPanel = renderGuidedPanel;

  // Also support module exports if in a module environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderGuidedModeButton, startGuidedMode, renderGuidedPanel };
  }

  // Self-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      console.log('[LogSherlock Pro] Guided Mode loaded. Call startGuidedMode() to begin.');
    });
  } else {
    injectStyles();
    console.log('[LogSherlock Pro] Guided Mode loaded. Call startGuidedMode() to begin.');
  }

})();
