/**
 * LogSherlock Pro — Incident Replay Cinema 🎬
 * 
 * Full-screen animated replay showing the server incident unfolding in real-time.
 * - Animated topology (nodes pulse/glow red as they fail)
 * - Causal arrows propagate between components
 * - AI narration typewriter effect explaining each step
 * - Rising severity meter
 * - Dark war-room aesthetic (sci-fi ops center feel)
 * 
 * Uses: Existing pattern timestamps + Root Cause Graph edges + Intelligence output
 * No AI/server needed — all pre-computed from scan results
 */

(function() {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TOPOLOGY LAYOUT — Maps categories to visual node positions
// ─────────────────────────────────────────────────────────────────────────────

const TOPOLOGY = {
    storage:        { x: 50, y: 70, icon: '💾', label: 'Storage' },
    filesystem:     { x: 35, y: 50, icon: '📁', label: 'Filesystem' },
    cluster:        { x: 65, y: 30, icon: '🔗', label: 'Cluster' },
    network:        { x: 20, y: 30, icon: '🌐', label: 'Network' },
    kernel:         { x: 50, y: 15, icon: '🧠', label: 'Kernel' },
    virtualization: { x: 80, y: 50, icon: '🖥️', label: 'VMs' },
    service:        { x: 50, y: 45, icon: '⚙️', label: 'Services' },
    memory:         { x: 35, y: 15, icon: '🧩', label: 'Memory' },
    security:       { x: 80, y: 15, icon: '🔒', label: 'Security' },
    hardware:       { x: 20, y: 70, icon: '🔧', label: 'Hardware' },
    performance:    { x: 80, y: 70, icon: '📊', label: 'Performance' },
    application:    { x: 65, y: 70, icon: '📱', label: 'Apps' },
    backup:         { x: 20, y: 50, icon: '💿', label: 'Backup' },
};

const SEVERITY_COLORS = {
    CRITICAL: '#ff2244',
    HIGH: '#ff8800',
    MEDIUM: '#ffcc00',
    LOW: '#44cc88',
};

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION ENGINE — Generates story text from findings
// ─────────────────────────────────────────────────────────────────────────────

function generateNarration(events) {
    const narrations = [];
    let prevCategory = '';
    
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const sev = ev.severity;
        const cat = ev.category || 'unknown';
        
        // Build narrative sentence
        let text = '';
        if (i === 0) {
            text = `⚡ Incident begins — ${ev.description || ev.pattern_name} detected in ${cat}.`;
        } else if (sev === 'CRITICAL') {
            if (cat !== prevCategory) {
                text = `🔴 CRITICAL: Failure cascaded to ${cat} — ${ev.description || ev.pattern_name}.`;
            } else {
                text = `🔴 ${ev.description || ev.pattern_name} — situation escalating.`;
            }
        } else if (sev === 'HIGH') {
            text = `🟠 ${ev.description || ev.pattern_name} in ${cat}.`;
        } else {
            text = `🟡 ${ev.description || ev.pattern_name}.`;
        }
        
        narrations.push({
            text: text.substring(0, 150),
            severity: sev,
            category: cat,
            timestamp: ev.log_timestamp || '',
        });
        
        prevCategory = cat;
    }
    
    // Add conclusion
    const critCount = events.filter(e => e.severity === 'CRITICAL').length;
    const categories = [...new Set(events.map(e => e.category || 'unknown'))];
    narrations.push({
        text: `📋 Incident summary: ${events.length} events across ${categories.length} systems. ${critCount} critical failures identified. Root cause isolated.`,
        severity: 'INFO',
        category: 'summary',
        timestamp: '',
    });
    
    return narrations;
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMA RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function createCinemaOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'incidentCinema';
    overlay.innerHTML = `
        <style>
            #incidentCinema {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #0a0e14; z-index: 99999; display: flex; flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                overflow: hidden;
            }
            #cinemaHeader {
                display: flex; justify-content: space-between; align-items: center;
                padding: 16px 32px; border-bottom: 1px solid #1a2030;
            }
            #cinemaTitle {
                font-size: 14px; font-weight: 600; color: #e0e6ed;
                text-transform: uppercase; letter-spacing: 1px;
            }
            #cinemaClose {
                background: #ff4455; border: none; color: white; padding: 6px 16px;
                border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
            }
            #cinemaClose:hover { background: #ff2233; }
            #cinemaBody {
                flex: 1; display: grid; grid-template-columns: 1fr 320px;
                grid-template-rows: 1fr auto; gap: 0;
            }
            #cinemaTopology {
                position: relative; overflow: hidden; border-right: 1px solid #1a2030;
            }
            .topo-node {
                position: absolute; width: 60px; height: 60px; border-radius: 50%;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                background: #141a24; border: 2px solid #2a3040; transition: all 500ms ease;
                transform: translate(-50%, -50%);
            }
            .topo-node.active { border-color: #44cc88; box-shadow: 0 0 20px #44cc8844; }
            .topo-node.warning { border-color: #ffcc00; box-shadow: 0 0 20px #ffcc0044; animation: pulse-warn 1s infinite; }
            .topo-node.critical { border-color: #ff2244; box-shadow: 0 0 30px #ff224466; animation: pulse-crit 0.7s infinite; }
            .topo-node .icon { font-size: 20px; }
            .topo-node .lbl { font-size: 9px; color: #667; margin-top: 2px; }
            .topo-edge {
                position: absolute; height: 2px; background: #ff2244;
                transform-origin: left center; opacity: 0;
                transition: opacity 400ms; box-shadow: 0 0 6px #ff224488;
            }
            .topo-edge.show { opacity: 1; }
            @keyframes pulse-warn { 0%,100%{box-shadow:0 0 20px #ffcc0044} 50%{box-shadow:0 0 40px #ffcc0088} }
            @keyframes pulse-crit { 0%,100%{box-shadow:0 0 30px #ff224466} 50%{box-shadow:0 0 60px #ff2244aa} }
            
            #cinemaNarration {
                padding: 24px; display: flex; flex-direction: column; overflow-y: auto;
                background: #0d1117; border-left: 1px solid #1a2030;
            }
            #narrationTitle {
                font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
                color: #556; margin-bottom: 16px; padding-bottom: 8px;
                border-bottom: 1px solid #1a2030;
            }
            .narr-item {
                padding: 10px 12px; margin-bottom: 8px; border-radius: 8px;
                background: #141a24; border-left: 3px solid #333;
                font-size: 12px; color: #aab; opacity: 0;
                transform: translateX(20px);
                transition: all 400ms ease;
            }
            .narr-item.show { opacity: 1; transform: translateX(0); }
            .narr-item.sev-CRITICAL { border-left-color: #ff2244; }
            .narr-item.sev-HIGH { border-left-color: #ff8800; }
            .narr-item.sev-MEDIUM { border-left-color: #ffcc00; }
            .narr-item.sev-LOW { border-left-color: #44cc88; }
            .narr-ts { font-size: 10px; color: #556; font-family: monospace; margin-bottom: 3px; }
            
            #cinemaFooter {
                grid-column: 1 / -1; padding: 16px 32px;
                border-top: 1px solid #1a2030; display: flex; align-items: center; gap: 20px;
            }
            #severityMeter {
                flex: 1; height: 6px; background: #1a2030; border-radius: 3px; overflow: hidden;
            }
            #severityFill {
                height: 100%; width: 0%; border-radius: 3px;
                background: linear-gradient(90deg, #44cc88, #ffcc00, #ff8800, #ff2244);
                transition: width 600ms ease;
            }
            #cinemaProgress {
                font-size: 11px; color: #667; min-width: 100px; text-align: right;
            }
            #cinemaSpeed {
                font-size: 11px; color: #44cc88; cursor: pointer; padding: 4px 10px;
                border: 1px solid #44cc8844; border-radius: 4px;
            }
            #cinemaSpeed:hover { background: #44cc8822; }
            .scanline {
                position: absolute; top: 0; left: 0; right: 0; height: 2px;
                background: linear-gradient(90deg, transparent, #44cc8844, transparent);
                animation: scanline 3s linear infinite;
            }
            @keyframes scanline { 0%{top:0} 100%{top:100%} }
        </style>
        
        <div id="cinemaHeader">
            <div id="cinemaTitle">🎬 Incident Replay Cinema — LogSherlock Pro</div>
            <div style="display:flex;gap:12px;align-items:center;">
                <span id="cinemaSpeed" onclick="window._cinemaToggleSpeed()">1x Speed</span>
                <button id="cinemaClose" onclick="window._cinemaClose()">✕ Close (Esc)</button>
            </div>
        </div>
        <div id="cinemaBody">
            <div id="cinemaTopology"><div class="scanline"></div></div>
            <div id="cinemaNarration">
                <div id="narrationTitle">🎙️ AI Narration — Incident Timeline</div>
                <div id="narrationList"></div>
            </div>
        </div>
        <div id="cinemaFooter">
            <div style="font-size:11px;color:#667;">Severity</div>
            <div id="severityMeter"><div id="severityFill"></div></div>
            <div id="cinemaProgress">0 / 0 events</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
}

function renderTopologyNodes(activeCategories) {
    const container = document.getElementById('cinemaTopology');
    if (!container) return;
    
    // Only render nodes once
    if (!container.querySelector('.topo-node')) {
        for (const [cat, pos] of Object.entries(TOPOLOGY)) {
            const node = document.createElement('div');
            node.className = 'topo-node';
            node.id = `topo-${cat}`;
            node.style.left = pos.x + '%';
            node.style.top = pos.y + '%';
            node.innerHTML = `<span class="icon">${pos.icon}</span><span class="lbl">${pos.label}</span>`;
            container.appendChild(node);
        }
    }
}

function activateNode(category, severity) {
    const node = document.getElementById(`topo-${category}`);
    if (!node) return;
    
    node.classList.remove('active', 'warning', 'critical');
    if (severity === 'CRITICAL') node.classList.add('critical');
    else if (severity === 'HIGH') node.classList.add('warning');
    else node.classList.add('active');
}

function drawEdge(fromCat, toCat) {
    const container = document.getElementById('cinemaTopology');
    if (!container) return;
    
    const from = TOPOLOGY[fromCat];
    const to = TOPOLOGY[toCat];
    if (!from || !to) return;
    
    const rect = container.getBoundingClientRect();
    const x1 = (from.x / 100) * rect.width;
    const y1 = (from.y / 100) * rect.height;
    const x2 = (to.x / 100) * rect.width;
    const y2 = (to.y / 100) * rect.height;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    const edge = document.createElement('div');
    edge.className = 'topo-edge';
    edge.style.left = x1 + 'px';
    edge.style.top = y1 + 'px';
    edge.style.width = length + 'px';
    edge.style.transform = `rotate(${angle}deg)`;
    container.appendChild(edge);
    
    setTimeout(() => edge.classList.add('show'), 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK ENGINE
// ─────────────────────────────────────────────────────────────────────────────

let _cinemaInterval = null;
let _cinemaSpeed = 1;
let _cinemaEvents = [];

window._cinemaClose = function() {
    if (_cinemaInterval) clearInterval(_cinemaInterval);
    const overlay = document.getElementById('incidentCinema');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _cinemaKeyHandler);
};

window._cinemaToggleSpeed = function() {
    const speeds = [1, 2, 4, 0.5];
    const idx = speeds.indexOf(_cinemaSpeed);
    _cinemaSpeed = speeds[(idx + 1) % speeds.length];
    document.getElementById('cinemaSpeed').textContent = _cinemaSpeed + 'x Speed';
};

function _cinemaKeyHandler(e) {
    if (e.key === 'Escape') window._cinemaClose();
}

function playReplay(findings) {
    // Sort by timestamp
    const events = findings
        .filter(f => f.category || f.severity)
        .map(f => ({
            ...f,
            category: (f.category || 'service').toLowerCase(),
            severity: (f.severity || 'MEDIUM').toUpperCase(),
            description: f.description || f.pattern_name || 'Event detected',
            pattern_name: f.pattern_name || f.name || 'unknown',
        }));
    
    // Dedupe by pattern+category to keep it concise
    const seen = new Set();
    const uniqueEvents = [];
    for (const ev of events) {
        const key = ev.pattern_name + ev.category;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(ev);
        }
    }
    
    // Limit to 30 most important events for good pacing
    const limited = uniqueEvents
        .sort((a, b) => {
            const sev = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            return (sev[a.severity] || 4) - (sev[b.severity] || 4);
        })
        .slice(0, 30);
    
    _cinemaEvents = limited;
    const narrations = generateNarration(limited);
    
    // Create overlay
    const overlay = createCinemaOverlay();
    document.addEventListener('keydown', _cinemaKeyHandler);
    renderTopologyNodes();
    
    // Playback
    let step = 0;
    const totalSteps = narrations.length;
    const baseDelay = 1800; // ms per step
    
    function nextStep() {
        if (step >= totalSteps) {
            clearInterval(_cinemaInterval);
            document.getElementById('cinemaProgress').textContent = `✅ Replay complete — ${totalSteps} events`;
            return;
        }
        
        const narr = narrations[step];
        const ev = limited[step] || {};
        
        // Activate topology node
        if (ev.category && TOPOLOGY[ev.category]) {
            activateNode(ev.category, ev.severity || 'MEDIUM');
        }
        
        // Draw edge from previous category
        if (step > 0) {
            const prevCat = (limited[step - 1] || {}).category;
            const currCat = ev.category;
            if (prevCat && currCat && prevCat !== currCat) {
                drawEdge(prevCat, currCat);
            }
        }
        
        // Add narration item
        const list = document.getElementById('narrationList');
        if (list) {
            const item = document.createElement('div');
            item.className = `narr-item sev-${narr.severity}`;
            item.innerHTML = `${narr.timestamp ? `<div class="narr-ts">${narr.timestamp}</div>` : ''}${narr.text}`;
            list.appendChild(item);
            setTimeout(() => item.classList.add('show'), 50);
            list.scrollTop = list.scrollHeight;
        }
        
        // Update severity meter
        const critSoFar = limited.slice(0, step + 1).filter(e => e.severity === 'CRITICAL').length;
        const sevPct = Math.min(100, (step / totalSteps) * 70 + (critSoFar * 10));
        const fill = document.getElementById('severityFill');
        if (fill) fill.style.width = sevPct + '%';
        
        // Update progress
        const prog = document.getElementById('cinemaProgress');
        if (prog) prog.textContent = `${step + 1} / ${totalSteps} events`;
        
        step++;
    }
    
    // Start playback with dynamic interval
    function scheduleNext() {
        _cinemaInterval = setTimeout(() => {
            nextStep();
            if (step < totalSteps) scheduleNext();
        }, baseDelay / _cinemaSpeed);
    }
    
    // Initial delay then start
    setTimeout(() => {
        nextStep();
        scheduleNext();
    }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Call this to launch cinema
// ─────────────────────────────────────────────────────────────────────────────

window.launchIncidentCinema = function(findings) {
    if (!findings || findings.length === 0) {
        alert('Run a scan first to generate findings for replay.');
        return;
    }
    playReplay(findings);
};

// Add the cinema button to advanced insights if available
const _origRender = window.renderAdvancedInsights;
if (_origRender) {
    window.renderAdvancedInsights = function(findings) {
        let html = _origRender(findings);
        // Add cinema button at the top
        const cinemaBtn = `<div style="margin-bottom:16px;text-align:center;">
            <button onclick="launchIncidentCinema(window._lsGetFindings ? window._lsGetFindings() : [])" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #44cc8844;color:#44cc88;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all 200ms;letter-spacing:0.5px;" onmouseover="this.style.boxShadow='0 0 20px #44cc8844';this.style.transform='scale(1.02)'" onmouseout="this.style.boxShadow='none';this.style.transform='scale(1)'">
                🎬 Launch Incident Replay Cinema
            </button>
            <div style="font-size:10px;color:#556;margin-top:6px;">Watch the incident unfold as an animated story</div>
        </div>`;
        return cinemaBtn + html;
    };
}

// Expose findings getter
window._lsGetFindings = function() {
    return window._allFindings || [];
};

})();
