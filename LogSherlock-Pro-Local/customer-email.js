/**
 * LogSherlock Pro - Customer-Friendly Email Generator
 * Generates professional, non-technical emails for customer communication.
 * One-click produces a clear, reassuring email about their support ticket.
 */

// ============================================================
// SEVERITY TO CUSTOMER-FRIENDLY LANGUAGE MAPPING
// ============================================================
const SEVERITY_LANGUAGE = {
  CRITICAL: 'a critical issue affecting service availability',
  HIGH: 'a significant issue that requires prompt attention',
  MEDIUM: 'a moderate issue we are addressing',
  LOW: 'a minor observation for your awareness'
};

const SEVERITY_ETA = {
  CRITICAL: '1-2 hours',
  HIGH: '4-8 hours',
  MEDIUM: '1-2 business days',
  LOW: 'the next scheduled maintenance window'
};

const SEVERITY_PRIORITY = {
  CRITICAL: 'P1',
  HIGH: 'P2',
  MEDIUM: 'P3',
  LOW: 'P4'
};

// ============================================================
// PATTERN TO PLAIN ENGLISH MAPPING
// ============================================================
const PATTERN_TO_ENGLISH = [
  { patterns: ['gfs2', 'filesystem', 'fs_error', 'ext4', 'xfs'], label: 'file system access issue' },
  { patterns: ['scsi', 'storage', 'lun', 'san', 'iscsi', 'multipath'], label: 'storage connectivity issue' },
  { patterns: ['fence', 'stonith', 'fencing'], label: 'cluster protection mechanism issue' },
  { patterns: ['oom', 'memory', 'mem_pressure', 'swap'], label: 'memory resource constraint' },
  { patterns: ['network', 'bond', 'nic', 'ethernet', 'tcp', 'dns'], label: 'network connectivity issue' },
  { patterns: ['kernel', 'panic', 'oops', 'crash', 'bug'], label: 'operating system stability issue' },
  { patterns: ['morpheus', 'appliance', 'platform', 'mgmt'], label: 'management platform issue' },
  { patterns: ['disk_full', 'space', 'no_space', 'capacity', 'df'], label: 'storage capacity issue' },
  { patterns: ['quorum', 'cluster', 'corosync', 'pacemaker', 'ha'], label: 'cluster communication issue' },
  { patterns: ['migration', 'vmotion', 'live_migrate', 'relocate'], label: 'virtual machine relocation issue' },
  { patterns: ['cpu', 'load', 'throttle', 'runaway'], label: 'processing resource constraint' },
  { patterns: ['timeout', 'latency', 'slow', 'delay'], label: 'service response delay' }
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Translate technical patterns found in analysis into plain English descriptions.
 */
function translatePatternsToEnglish(findings) {
  const issues = [];

  if (!findings || !findings.patterns) {
    return ['a system issue'];
  }

  const patternsFound = Array.isArray(findings.patterns)
    ? findings.patterns
    : Object.keys(findings.patterns || {});

  const combinedText = patternsFound.map(function(p) {
    return (typeof p === 'string' ? p : (p.name || p.pattern || '')).toLowerCase();
  }).join(' ');

  PATTERN_TO_ENGLISH.forEach(function(mapping) {
    const matched = mapping.patterns.some(function(pat) {
      return combinedText.indexOf(pat) !== -1;
    });
    if (matched) {
      issues.push(mapping.label);
    }
  });

  if (issues.length === 0) {
    issues.push('a system issue');
  }

  return issues;
}

/**
 * Determine severity from findings object.
 */
function extractSeverity(findings) {
  if (!findings) return 'MEDIUM';
  var sev = (findings.severity || findings.priority || 'MEDIUM').toUpperCase();
  if (SEVERITY_LANGUAGE[sev]) return sev;
  if (sev === 'P1') return 'CRITICAL';
  if (sev === 'P2') return 'HIGH';
  if (sev === 'P3') return 'MEDIUM';
  if (sev === 'P4') return 'LOW';
  return 'MEDIUM';
}

/**
 * Generate a data safety statement based on severity and patterns.
 */
function getDataSafetyStatement(severity, issues) {
  var hasStorageIssue = issues.some(function(i) {
    return i.indexOf('storage') !== -1 || i.indexOf('file system') !== -1 || i.indexOf('capacity') !== -1;
  });

  if (severity === 'CRITICAL' && hasStorageIssue) {
    return 'We want to assure you that data protection mechanisms are in place, and we are actively monitoring data integrity throughout the resolution process.';
  }
  if (severity === 'CRITICAL') {
    return 'Your data remains protected by our redundancy systems, and we are monitoring the situation closely.';
  }
  if (hasStorageIssue) {
    return 'We can confirm that your data is safe and no data loss has occurred.';
  }
  return 'Your data and services remain protected throughout this process.';
}

/**
 * Format issues into a readable sentence.
 */
function formatIssuesList(issues) {
  if (issues.length === 1) return issues[0];
  if (issues.length === 2) return issues[0] + ' and ' + issues[1];
  var last = issues[issues.length - 1];
  var rest = issues.slice(0, -1);
  return rest.join(', ') + ', and ' + last;
}

// ============================================================
// MAIN: generateCustomerEmail
// ============================================================

/**
 * Generate a professional, non-technical customer email.
 * @param {Object} findings - Analysis findings from LogSherlock Pro
 * @param {string} ticketText - Original ticket/log text
 * @param {string} [tone='professional'] - Tone: 'professional', 'empathetic', or 'urgent'
 * @returns {{subject: string, body: string, tone: string}}
 */
function generateCustomerEmail(findings, ticketText, tone) {
  tone = (tone || 'professional').toLowerCase();
  var severity = extractSeverity(findings);
  var issues = translatePatternsToEnglish(findings);
  var issueDescription = formatIssuesList(issues);
  var severityLabel = SEVERITY_LANGUAGE[severity];
  var eta = SEVERITY_ETA[severity];
  var priority = SEVERITY_PRIORITY[severity];
  var dataSafety = getDataSafetyStatement(severity, issues);

  // Subject line
  var subject = '[' + priority + '] Update on Your Support Case — ' +
    issues[0].charAt(0).toUpperCase() + issues[0].slice(1) + ' Identified';

  // Greeting
  var greeting = 'Dear Customer,';

  // Opening based on tone
  var opening;
  if (tone === 'empathetic') {
    opening = 'We understand how important your systems are to your operations, and we want to keep you informed about the progress on your support case.';
  } else if (tone === 'urgent') {
    opening = 'We are writing to provide you with an immediate update regarding your support case, which our team is treating with the highest priority.';
  } else {
    opening = 'Thank you for reaching out to us. We are writing to provide you with an update on your support case.';
  }

  // What was found
  var whatFound = 'Our engineering team has completed an initial analysis and identified ' +
    issueDescription + '. This has been classified as ' + severityLabel + '.';

  // Impact explanation
  var impact;
  if (severity === 'CRITICAL') {
    impact = 'This issue may be affecting the availability of some of your services. We have escalated this to our highest priority response team.';
  } else if (severity === 'HIGH') {
    impact = 'This issue may be causing intermittent disruptions or degraded performance in your environment. Our senior engineers are actively working on this.';
  } else if (severity === 'MEDIUM') {
    impact = 'While your core services remain operational, this issue may result in occasional performance variations. Our team is addressing it proactively.';
  } else {
    impact = 'This issue does not currently affect your service availability. We have noted it for attention during the next scheduled maintenance.';
  }

  // What we're doing
  var action;
  if (tone === 'urgent') {
    action = 'Our dedicated response team has been mobilized and is working around the clock to resolve this issue. We are applying targeted remediation steps and continuously monitoring your environment.';
  } else {
    action = 'Our team is actively working on resolving this issue. We are applying corrective measures and will continue to monitor your environment to ensure full stability.';
  }

  // ETA
  var etaStatement = 'Based on our assessment, we expect to have this resolved within ' + eta + '. We will keep you updated on our progress.';

  // Data safety
  var safety = dataSafety;

  // Closing based on tone
  var closing;
  if (tone === 'empathetic') {
    closing = 'We appreciate your patience and trust in our team. Please do not hesitate to reach out if you have any questions or concerns — we are here to help.';
  } else if (tone === 'urgent') {
    closing = 'We recognize the urgency of this situation and are committed to restoring full service as quickly as possible. You will receive our next update within the hour.';
  } else {
    closing = 'If you have any questions or need further clarification, please do not hesitate to contact us. We will provide another update once the resolution is confirmed.';
  }

  // Sign-off
  var signoff = 'Best regards,\nHPE VME L4 Support Team';

  // Assemble body
  var body = [
    greeting,
    '',
    opening,
    '',
    whatFound,
    '',
    impact,
    '',
    action,
    '',
    etaStatement,
    '',
    safety,
    '',
    closing,
    '',
    signoff
  ].join('\n');

  return {
    subject: subject,
    body: body,
    tone: tone
  };
}

// ============================================================
// MAIN: renderCustomerEmailPanel
// ============================================================

/**
 * Render the customer email panel as HTML string.
 * @param {Object} findings - Analysis findings from LogSherlock Pro
 * @param {string} ticketText - Original ticket/log text
 * @returns {string} HTML string for the email panel
 */
function renderCustomerEmailPanel(findings, ticketText) {
  var email = generateCustomerEmail(findings, ticketText, 'professional');
  var panelId = 'customer-email-panel-' + Date.now();

  var html = '';
  html += '<div id="' + panelId + '" class="customer-email-panel" style="' +
    'background: #1e1e2e; border: 1px solid #3a3a5a; border-radius: 12px; padding: 24px; ' +
    'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; ' +
    'max-width: 700px; margin: 16px auto;">';

  // Header
  html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">';
  html += '<h3 style="color: #e0e0e0; margin: 0; font-size: 16px;">📧 Customer Email Generator</h3>';
  html += '<span style="color: #888; font-size: 12px;">LogSherlock Pro</span>';
  html += '</div>';

  // Tone buttons
  html += '<div style="margin-bottom: 16px; display: flex; gap: 8px;">';
  html += '<button onclick="window._customerEmailSetTone(\'' + panelId + '\', \'professional\', this)" ' +
    'class="tone-btn tone-active" style="' +
    'padding: 6px 14px; border-radius: 6px; border: 1px solid #4a9eff; ' +
    'background: #4a9eff22; color: #4a9eff; cursor: pointer; font-size: 13px; font-weight: 500;">' +
    'Professional</button>';
  html += '<button onclick="window._customerEmailSetTone(\'' + panelId + '\', \'empathetic\', this)" ' +
    'class="tone-btn" style="' +
    'padding: 6px 14px; border-radius: 6px; border: 1px solid #555; ' +
    'background: transparent; color: #aaa; cursor: pointer; font-size: 13px; font-weight: 500;">' +
    'Empathetic</button>';
  html += '<button onclick="window._customerEmailSetTone(\'' + panelId + '\', \'urgent\', this)" ' +
    'class="tone-btn" style="' +
    'padding: 6px 14px; border-radius: 6px; border: 1px solid #555; ' +
    'background: transparent; color: #aaa; cursor: pointer; font-size: 13px; font-weight: 500;">' +
    'Urgent</button>';
  html += '</div>';

  // Email preview box
  html += '<div class="email-preview-box" style="' +
    'background: #fafafa; border: 1px solid #ddd; border-radius: 8px; ' +
    'padding: 20px; color: #222; font-size: 14px; line-height: 1.6;">';

  // Subject line
  html += '<div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 12px; margin-bottom: 16px;">';
  html += '<div style="color: #666; font-size: 12px; margin-bottom: 4px;">Subject:</div>';
  html += '<div class="email-subject" style="font-weight: 600; color: #111; font-size: 15px;">' +
    escapeHtml(email.subject) + '</div>';
  html += '</div>';

  // Body
  html += '<div class="email-body" style="white-space: pre-wrap; color: #333; font-size: 14px;">' +
    escapeHtml(email.body) + '</div>';

  html += '</div>'; // end email-preview-box

  // Action buttons
  html += '<div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">';
  html += '<button onclick="window._customerEmailCopy(\'' + panelId + '\')" style="' +
    'padding: 8px 16px; border-radius: 6px; border: 1px solid #4a9eff; ' +
    'background: #4a9eff; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500;">' +
    '📋 Copy Email</button>';
  html += '<button onclick="window._customerEmailToggleEdit(\'' + panelId + '\')" style="' +
    'padding: 8px 16px; border-radius: 6px; border: 1px solid #555; ' +
    'background: transparent; color: #ccc; cursor: pointer; font-size: 13px; font-weight: 500;">' +
    '✏️ Edit</button>';
  html += '<span class="copy-feedback" style="color: #4caf50; font-size: 12px; opacity: 0; transition: opacity 0.3s;"></span>';
  html += '</div>';

  html += '</div>'; // end panel

  return html;
}

// ============================================================
// HELPER: HTML Escaping
// ============================================================
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// WINDOW INTERACTION HANDLERS
// ============================================================

if (typeof window !== 'undefined') {
  /**
   * Store current findings/ticket for re-generation on tone change.
   */
  window._customerEmailState = {};

  /**
   * Change the tone and regenerate the email.
   */
  window._customerEmailSetTone = function(panelId, tone, btn) {
    var panel = document.getElementById(panelId);
    if (!panel) return;

    // Update button styles
    var buttons = panel.querySelectorAll('.tone-btn');
    buttons.forEach(function(b) {
      b.style.border = '1px solid #555';
      b.style.background = 'transparent';
      b.style.color = '#aaa';
    });
    btn.style.border = '1px solid #4a9eff';
    btn.style.background = '#4a9eff22';
    btn.style.color = '#4a9eff';

    // Regenerate email with new tone
    var state = window._customerEmailState[panelId];
    if (!state) return;

    var email = generateCustomerEmail(state.findings, state.ticketText, tone);
    var subjectEl = panel.querySelector('.email-subject');
    var bodyEl = panel.querySelector('.email-body');
    if (subjectEl) subjectEl.textContent = email.subject;
    if (bodyEl) bodyEl.textContent = email.body;
  };

  /**
   * Copy email to clipboard.
   */
  window._customerEmailCopy = function(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel) return;

    var subject = panel.querySelector('.email-subject');
    var body = panel.querySelector('.email-body');
    var text = 'Subject: ' + (subject ? subject.textContent : '') + '\n\n' +
      (body ? body.textContent : '');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        var feedback = panel.querySelector('.copy-feedback');
        if (feedback) {
          feedback.textContent = '✓ Copied!';
          feedback.style.opacity = '1';
          setTimeout(function() { feedback.style.opacity = '0'; }, 2000);
        }
      });
    } else {
      // Fallback for older browsers
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      var feedback = panel.querySelector('.copy-feedback');
      if (feedback) {
        feedback.textContent = '✓ Copied!';
        feedback.style.opacity = '1';
        setTimeout(function() { feedback.style.opacity = '0'; }, 2000);
      }
    }
  };

  /**
   * Toggle edit mode for the email body.
   */
  window._customerEmailToggleEdit = function(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel) return;

    var bodyEl = panel.querySelector('.email-body');
    var subjectEl = panel.querySelector('.email-subject');
    if (!bodyEl) return;

    var isEditable = bodyEl.contentEditable === 'true';

    if (isEditable) {
      bodyEl.contentEditable = 'false';
      subjectEl.contentEditable = 'false';
      bodyEl.style.background = 'transparent';
      bodyEl.style.border = 'none';
      bodyEl.style.outline = 'none';
      subjectEl.style.background = 'transparent';
      subjectEl.style.border = 'none';
      subjectEl.style.outline = 'none';
    } else {
      bodyEl.contentEditable = 'true';
      subjectEl.contentEditable = 'true';
      bodyEl.style.background = '#fff8e1';
      bodyEl.style.border = '1px dashed #ffab00';
      bodyEl.style.borderRadius = '4px';
      bodyEl.style.padding = '8px';
      bodyEl.style.outline = 'none';
      subjectEl.style.background = '#fff8e1';
      subjectEl.style.border = '1px dashed #ffab00';
      subjectEl.style.borderRadius = '4px';
      subjectEl.style.padding = '4px 8px';
      subjectEl.style.outline = 'none';
    }
  };

  // Expose main functions on window
  window.generateCustomerEmail = generateCustomerEmail;
  window.renderCustomerEmailPanel = renderCustomerEmailPanel;
}

// ============================================================
// MODULE EXPORTS (Node.js compatibility)
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCustomerEmail: generateCustomerEmail,
    renderCustomerEmailPanel: renderCustomerEmailPanel
  };
}
