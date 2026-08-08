(function() {
'use strict';

const LICENSE_STORAGE_KEY = 'lsp_license_data';
const GITHUB_LICENSE_URL = 'https://raw.githubusercontent.com/yadakrishna245/HPE-log_analysis_app-monitor/main/licenses.json';

// Generate hardware fingerprint (browser-based)
function generateFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('LogSherlock-FP', 2, 2);
  const canvasHash = canvas.toDataURL().slice(-50);
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    navigator.platform,
    canvasHash
  ];
  
  // Simple hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'FP-' + Math.abs(hash).toString(36).toUpperCase();
}

// Encrypt/decrypt simple XOR
function xorEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function xorDecrypt(encoded, key) {
  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch(e) { return null; }
}

// Check if already activated on this machine
function checkLocalActivation() {
  const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (!stored) return null;
  
  const fp = generateFingerprint();
  const decrypted = xorDecrypt(stored, fp);
  if (!decrypted) return null;
  
  try {
    const data = JSON.parse(decrypted);
    if (data.fingerprint === fp && data.activated) {
      return data;
    }
  } catch(e) {}
  return null;
}

// Save activation
function saveActivation(username, licenseKey) {
  const fp = generateFingerprint();
  const data = {
    username: username,
    license: licenseKey,
    fingerprint: fp,
    activated: true,
    activatedAt: new Date().toISOString(),
    machine: navigator.platform + ' ' + screen.width + 'x' + screen.height
  };
  const encrypted = xorEncrypt(JSON.stringify(data), fp);
  localStorage.setItem(LICENSE_STORAGE_KEY, encrypted);
}

// Validate license key format (supports standard LS-XXXX-XXXX-XXXX-XXXX and master keys)
function isValidKeyFormat(key) {
  // Standard format: LS-XXXX-XXXX-XXXX-XXXX (4 groups of 4 alphanumeric)
  const standardRegex = /^LS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  // Master key format: LS-MASTER-... (any segments after LS-MASTER-)
  const masterRegex = /^LS-MASTER-[A-Z0-9-]+$/;
  return standardRegex.test(key) || masterRegex.test(key);
}

// Validate license against GitHub
async function validateOnline(username, licenseKey) {
  try {
    const resp = await fetch(GITHUB_LICENSE_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) return { valid: false, error: 'Cannot reach license server' };
    const data = await resp.json();
    const licenses = data.licenses;
    
    if (!licenses || !Array.isArray(licenses)) {
      return { valid: false, error: 'Invalid license data from server' };
    }
    
    const entry = licenses.find(l => 
      l.key === licenseKey && 
      l.issued_to.toLowerCase() === username.toLowerCase() &&
      l.active === true
    );
    
    if (!entry) return { valid: false, error: 'Invalid license key or name' };
    
    // Check if license is already bound to a different machine
    const fp = generateFingerprint();
    if (entry.fingerprint && entry.fingerprint !== '' && entry.fingerprint !== fp) {
      return { valid: false, error: 'This license is already activated on another machine. One license = one machine.' };
    }
    
    return { valid: true, entry: entry };
  } catch(e) {
    return { valid: false, error: 'Network error: ' + e.message + '. If previously activated, click Offline Mode.' };
  }
}

// Create login UI
function showLicenseGate() {
  // Hide main app
  document.body.style.overflow = 'hidden';
  
  const overlay = document.createElement('div');
  overlay.id = 'licenseGate';
  overlay.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 50%,#0d1b2a 100%);padding:20px;">
      <div style="background:#1e1e2e;border-radius:20px;padding:48px 40px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(1,169,130,0.2);">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:48px;margin-bottom:12px;">🔍</div>
          <h1 style="color:#fff;font-size:24px;margin:0 0 8px 0;font-weight:700;">LogSherlock Pro</h1>
          <p style="color:#888;font-size:13px;margin:0;">HPE VM Essentials Log Analysis Engine</p>
          <p style="color:#555;font-size:11px;margin-top:4px;">Enterprise License Required</p>
        </div>
        
        <div id="licenseError" style="display:none;padding:10px 14px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);border-radius:8px;color:#ff4757;font-size:12px;margin-bottom:16px;"></div>
        
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#aaa;font-size:12px;margin-bottom:6px;font-weight:500;">Name</label>
          <input type="text" id="licenseUsername" placeholder="Enter your name" style="width:100%;padding:12px 16px;background:#2a2a3e;border:1px solid #3a3a5e;border-radius:10px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" onfocus="this.style.borderColor='#01A982'" onblur="this.style.borderColor='#3a3a5e'">
        </div>
        
        <div style="margin-bottom:24px;">
          <label style="display:block;color:#aaa;font-size:12px;margin-bottom:6px;font-weight:500;">License Key</label>
          <input type="text" id="licenseKey" placeholder="LS-XXXX-XXXX-XXXX-XXXX" style="width:100%;padding:12px 16px;background:#2a2a3e;border:1px solid #3a3a5e;border-radius:10px;color:#fff;font-size:14px;outline:none;box-sizing:border-box;font-family:monospace;letter-spacing:1px;transition:border-color 0.2s;" onfocus="this.style.borderColor='#01A982'" onblur="this.style.borderColor='#3a3a5e'">
        </div>
        
        <button id="licenseActivateBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#01A982,#00c896);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:transform 0.1s,box-shadow 0.2s;box-shadow:0 4px 15px rgba(1,169,130,0.3);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(1,169,130,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 15px rgba(1,169,130,0.3)'">
          🔑 Activate License
        </button>
        
        <div style="text-align:center;margin-top:16px;">
          <button id="offlineModeBtn" style="background:none;border:none;color:#666;font-size:11px;cursor:pointer;text-decoration:underline;" title="Only works if previously activated on this machine">
            Previously activated? Use Offline Mode
          </button>
        </div>
        
        <div style="text-align:center;margin-top:24px;border-top:1px solid #2a2a3e;padding-top:16px;">
          <p style="color:#555;font-size:11px;margin:0;">Purchase license: <a href="https://github.com/yadakrishna245/HPE-log_analysis_app-monitor" target="_blank" style="color:#01A982;">github.com/yadakrishna245</a></p>
          <p style="color:#444;font-size:10px;margin:4px 0 0 0;">One license = One machine · Fingerprint bound</p>
        </div>
      </div>
    </div>
  `;
  
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;';
  document.body.appendChild(overlay);
  
  // Event handlers
  document.getElementById('licenseActivateBtn').addEventListener('click', handleActivation);
  document.getElementById('offlineModeBtn').addEventListener('click', handleOfflineMode);
  document.getElementById('licenseKey').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleActivation();
  });
  document.getElementById('licenseUsername').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('licenseKey').focus();
  });
  
  // Auto-format license key
  document.getElementById('licenseKey').addEventListener('input', function(e) {
    let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Handle master keys — if it starts with LSMASTER, don't apply standard formatting
    if (val.startsWith('LSMASTER')) {
      // Reconstruct with dashes: LS-MASTER-<rest in groups>
      let rest = val.substring(8); // after LSMASTER
      let formatted = 'LS-MASTER';
      // Re-insert dashes at logical points — let user type freely with LS-MASTER- prefix
      if (rest.length > 0) formatted += '-' + rest;
      e.target.value = formatted;
      return;
    }
    
    // Standard format: LS-XXXX-XXXX-XXXX-XXXX
    if (val.startsWith('LS')) val = val.substring(2);
    let formatted = 'LS';
    for (let i = 0; i < val.length && i < 16; i++) {
      if (i % 4 === 0) formatted += '-';
      formatted += val[i];
    }
    e.target.value = formatted;
  });
}

function showError(msg) {
  const el = document.getElementById('licenseError');
  el.textContent = msg;
  el.style.display = 'block';
}

async function handleActivation() {
  const username = document.getElementById('licenseUsername').value.trim();
  const key = document.getElementById('licenseKey').value.trim();
  
  if (!username) { showError('Please enter your name'); return; }
  if (!key || !isValidKeyFormat(key)) {
    showError('Invalid license key format. Expected: LS-XXXX-XXXX-XXXX-XXXX');
    return;
  }
  
  const btn = document.getElementById('licenseActivateBtn');
  btn.textContent = '⏳ Validating...';
  btn.disabled = true;
  
  const result = await validateOnline(username, key);
  
  if (result.valid) {
    saveActivation(username, key);
    document.getElementById('licenseGate').remove();
    document.body.style.overflow = '';
    // Store username for display
    window._lspUser = username;
    console.log('[LogSherlock] License activated for:', username);
  } else {
    showError(result.error);
    btn.textContent = '🔑 Activate License';
    btn.disabled = false;
  }
}

function handleOfflineMode() {
  const localData = checkLocalActivation();
  if (localData) {
    document.getElementById('licenseGate').remove();
    document.body.style.overflow = '';
    window._lspUser = localData.username;
    console.log('[LogSherlock] Offline mode — previously activated for:', localData.username);
  } else {
    showError('No previous activation found on this machine. Please activate online first.');
  }
}

// --- MAIN ENTRY ---
// Check if already activated on this machine
const existingActivation = checkLocalActivation();
if (existingActivation) {
  // Already activated — let them in
  window._lspUser = existingActivation.username;
  console.log('[LogSherlock] License valid for:', existingActivation.username);
} else {
  // Show license gate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showLicenseGate);
  } else {
    showLicenseGate();
  }
}

})();
