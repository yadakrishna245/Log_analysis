/**
 * LogSherlock Pro - Topology Map Feature
 * Visual cluster topology showing system components and health status
 * Pure CSS+HTML layout, no external libraries
 */

// ============================================================
// TOPOLOGY NODE DEFINITIONS
// ============================================================
const TOPOLOGY_NODES = [
  // Top tier
  { id: 'load-balancer', name: 'Load Balancer', icon: '⚖️', tier: 'top', keywords: ['load balancer', 'haproxy', 'nginx', 'lb', 'proxy', 'f5'] },
  { id: 'dns', name: 'DNS', icon: '🌐', tier: 'top', keywords: ['dns', 'resolve', 'domain', 'nameserver', 'bind'] },
  { id: 'external-network', name: 'External Network', icon: '🔗', tier: 'top', keywords: ['external', 'internet', 'wan', 'firewall', 'gateway'] },
  // Middle tier - cluster nodes
  { id: 'node-1', name: 'Node 1', icon: '🖥️', tier: 'middle', keywords: ['node1', 'node-1', 'cluster node 1', 'worker-1', 'host1'] },
  { id: 'node-2', name: 'Node 2', icon: '🖥️', tier: 'middle', keywords: ['node2', 'node-2', 'cluster node 2', 'worker-2', 'host2'] },
  { id: 'node-3', name: 'Node 3', icon: '🖥️', tier: 'middle', keywords: ['node3', 'node-3', 'cluster node 3', 'worker-3', 'host3'] },
  // Inner layers (within each node conceptually)
  { id: 'vm-layer', name: 'VM Layer', icon: '📦', tier: 'inner', keywords: ['vm', 'virtual machine', 'hypervisor', 'esxi', 'kvm', 'vmware', 'vCenter'] },
  { id: 'storage-layer', name: 'Storage Layer', icon: '💾', tier: 'inner', keywords: ['storage', 'disk', 'volume', 'lun', 'datastore', 'vsan'] },
  { id: 'os-kernel', name: 'OS/Kernel', icon: '🐧', tier: 'inner', keywords: ['kernel', 'os', 'linux', 'windows', 'system', 'boot', 'grub', 'systemd'] },
  // Bottom tier
  { id: 'san-storage', name: 'SAN/Storage Array', icon: '🗄️', tier: 'bottom', keywords: ['san', 'storage array', 'nimble', '3par', 'primera', 'iscsi', 'fibre channel'] },
  { id: 'backup-system', name: 'Backup System', icon: '🔄', tier: 'bottom', keywords: ['backup', 'restore', 'veeam', 'commvault', 'snapshot', 'recovery'] },
  { id: 'management', name: 'Management (Morpheus)', icon: '🎛️', tier: 'bottom', keywords: ['morpheus', 'management', 'orchestration', 'automation', 'api', 'portal'] },
];

// Connection definitions between nodes
const TOPOLOGY_CONNECTIONS = [
  ['load-balancer', 'node-1'],
  ['load-balancer', 'node-2'],
  ['load-balancer', 'node-3'],
  ['dns', 'load-balancer'],
  ['dns', 'external-network'],
  ['external-network', 'load-balancer'],
  ['node-1', 'vm-layer'],
  ['node-2', 'vm-layer'],
  ['node-3', 'vm-layer'],
  ['vm-layer', 'storage-layer'],
  ['storage-layer', 'os-kernel'],
  ['os-kernel', 'san-storage'],
  ['san-storage', 'backup-system'],
  ['node-1', 'management'],
  ['node-2', 'management'],
  ['node-3', 'management'],
  ['management', 'san-storage'],
  ['storage-layer', 'san-storage'],
  ['backup-system', 'management'],
];

// ============================================================
// CSS STYLES
// ============================================================
const TOPOLOGY_STYLES = `
<style id="topology-map-styles">
.topology-panel {
  background: #1e1e2e;
  border-radius: 12px;
  padding: 24px;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #cdd6f4;
  position: relative;
  overflow: hidden;
}
.topology-panel * { box-sizing: border-box; }
.topology-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.topology-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #cdd6f4;
  display: flex;
  align-items: center;
  gap: 8px;
}
.topology-fullscreen-btn {
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.topology-fullscreen-btn:hover {
  background: #45475a;
  border-color: #585b70;
}

/* Tier layout */
.topology-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.topology-tier {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  width: 100%;
  position: relative;
}
.topology-tier-label {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: #585b70;
  text-transform: uppercase;
  letter-spacing: 1px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

/* Connection lines */
.topology-connections {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 4px 0;
}
.topology-conn-line {
  height: 2px;
  width: 60px;
  background: #45475a;
  margin: 0 -4px;
  position: relative;
}
.topology-conn-line.conn-red { background: #f38ba8; }
.topology-conn-vertical {
  width: 2px;
  height: 20px;
  background: #45475a;
  margin: 0 auto;
}
.topology-conn-vertical.conn-red { background: #f38ba8; }
.topology-connector-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  padding: 2px 0;
}
.topology-vlines {
  display: flex;
  justify-content: center;
  gap: 80px;
  padding: 2px 0;
}

/* Node styling */
.topology-node {
  background: #313244;
  border: 2px solid #45475a;
  border-radius: 12px;
  padding: 14px 18px;
  min-width: 140px;
  max-width: 180px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}
.topology-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.topology-node .node-icon {
  font-size: 1.5rem;
  margin-bottom: 6px;
}
.topology-node .node-name {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topology-node .node-count {
  font-size: 0.7rem;
  color: #a6adc8;
}
.topology-node .node-severity {
  font-size: 0.65rem;
  margin-top: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

/* Status colors */
.topology-node.status-healthy {
  border-color: #a6e3a1;
  box-shadow: 0 0 12px rgba(166,227,161,0.15);
}
.topology-node.status-warning {
  border-color: #f9e2af;
  box-shadow: 0 0 12px rgba(249,226,175,0.2);
}
.topology-node.status-degraded {
  border-color: #fab387;
  box-shadow: 0 0 12px rgba(250,179,135,0.25);
}
.topology-node.status-critical {
  border-color: #f38ba8;
  box-shadow: 0 0 16px rgba(243,139,168,0.3);
  animation: pulse-critical 2s ease-in-out infinite;
}
.topology-node.status-unknown {
  border-color: #585b70;
  box-shadow: none;
  opacity: 0.7;
}

@keyframes pulse-critical {
  0%, 100% { box-shadow: 0 0 16px rgba(243,139,168,0.3); }
  50% { box-shadow: 0 0 28px rgba(243,139,168,0.6); }
}

/* Severity badge colors */
.severity-healthy { background: #a6e3a1; color: #1e1e2e; }
.severity-warning { background: #f9e2af; color: #1e1e2e; }
.severity-degraded { background: #fab387; color: #1e1e2e; }
.severity-critical { background: #f38ba8; color: #1e1e2e; }
.severity-unknown { background: #585b70; color: #cdd6f4; }

/* Legend */
.topology-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid #313244;
}
.topology-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: #a6adc8;
}
.topology-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.legend-green { background: #a6e3a1; }
.legend-yellow { background: #f9e2af; }
.legend-orange { background: #fab387; }
.legend-red { background: #f38ba8; }
.legend-grey { background: #585b70; }

/* Node detail popup */
.topology-node-detail {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 12px;
  padding: 24px;
  min-width: 340px;
  max-width: 500px;
  max-height: 70vh;
  overflow-y: auto;
  z-index: 10001;
  box-shadow: 0 20px 60px rgba(0,0,0,0.8);
}
.topology-node-detail.active { display: block; }
.topology-node-detail h3 {
  margin: 0 0 12px 0;
  color: #cdd6f4;
  font-size: 1.1rem;
}
.topology-node-detail .detail-finding {
  background: #313244;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  font-size: 0.8rem;
  border-left: 3px solid #45475a;
}
.topology-node-detail .detail-finding.sev-critical { border-left-color: #f38ba8; }
.topology-node-detail .detail-finding.sev-high { border-left-color: #fab387; }
.topology-node-detail .detail-finding.sev-medium { border-left-color: #f9e2af; }
.topology-node-detail .detail-finding.sev-low { border-left-color: #a6e3a1; }
.topology-detail-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: #a6adc8;
  font-size: 1.2rem;
  cursor: pointer;
}
.topology-detail-close:hover { color: #f38ba8; }
.topology-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 10000;
}
.topology-overlay.active { display: block; }

/* Fullscreen modal */
.topology-fullscreen-modal {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #1e1e2e;
  z-index: 9999;
  padding: 30px;
  overflow-y: auto;
}
.topology-fullscreen-modal.active { display: block; }
.topology-fullscreen-modal .topology-panel {
  max-width: 1200px;
  margin: 0 auto;
  background: transparent;
}
.topology-fullscreen-close {
  position: fixed;
  top: 16px;
  right: 24px;
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10002;
  font-size: 0.9rem;
}
.topology-fullscreen-close:hover { background: #45475a; }

/* Responsive */
@media (max-width: 768px) {
  .topology-node {
    min-width: 100px;
    max-width: 130px;
    padding: 10px 12px;
  }
  .topology-node .node-icon { font-size: 1.2rem; }
  .topology-node .node-name { font-size: 0.7rem; }
  .topology-tier { gap: 8px; }
  .topology-grid { gap: 10px; }
  .topology-legend { gap: 10px; }
  .topology-vlines { gap: 40px; }
}
@media (max-width: 480px) {
  .topology-node {
    min-width: 80px;
    max-width: 110px;
    padding: 8px;
  }
  .topology-node .node-name { font-size: 0.65rem; }
  .topology-panel { padding: 12px; }
}
</style>
`;



// ============================================================
// CORE LOGIC
// ============================================================

/**
 * Maps findings to topology nodes based on keyword matching
 */
function mapFindingsToNodes(findings) {
  const nodeFindings = {};
  TOPOLOGY_NODES.forEach(node => { nodeFindings[node.id] = []; });

  if (!findings || !Array.isArray(findings)) return nodeFindings;

  findings.forEach(finding => {
    const text = `${finding.title || ''} ${finding.description || ''} ${finding.component || ''} ${finding.source || ''}`.toLowerCase();
    let matched = false;

    TOPOLOGY_NODES.forEach(node => {
      const isMatch = node.keywords.some(kw => text.includes(kw));
      if (isMatch) {
        nodeFindings[node.id].push(finding);
        matched = true;
      }
    });

    // If no specific match, assign to general OS/Kernel
    if (!matched && finding.severity) {
      nodeFindings['os-kernel'].push(finding);
    }
  });

  return nodeFindings;
}

/**
 * Determines node status based on its findings
 * Returns: { status, className, label }
 */
function getNodeStatus(nodeFindings) {
  if (!nodeFindings || nodeFindings.length === 0) {
    return { status: 'unknown', className: 'status-unknown', label: 'No Data' };
  }

  const severities = nodeFindings.map(f => (f.severity || '').toUpperCase());

  if (severities.includes('CRITICAL')) {
    return { status: 'critical', className: 'status-critical', label: 'Critical' };
  }
  if (severities.includes('HIGH')) {
    return { status: 'degraded', className: 'status-degraded', label: 'Degraded' };
  }
  if (severities.includes('MEDIUM')) {
    return { status: 'warning', className: 'status-warning', label: 'Warning' };
  }
  // Has findings but all LOW or INFO
  return { status: 'healthy', className: 'status-healthy', label: 'Healthy' };
}

/**
 * Checks if a connection line should be red (both nodes have issues)
 */
function isConnectionRed(nodeA, nodeB, nodeFindings) {
  const aHasIssues = nodeFindings[nodeA] && nodeFindings[nodeA].length > 0 &&
    nodeFindings[nodeA].some(f => ['CRITICAL','HIGH','MEDIUM'].includes((f.severity||'').toUpperCase()));
  const bHasIssues = nodeFindings[nodeB] && nodeFindings[nodeB].length > 0 &&
    nodeFindings[nodeB].some(f => ['CRITICAL','HIGH','MEDIUM'].includes((f.severity||'').toUpperCase()));
  return aHasIssues && bHasIssues;
}

/**
 * Gets the severity CSS class for a finding
 */
function getFindingSevClass(finding) {
  const sev = (finding.severity || '').toUpperCase();
  if (sev === 'CRITICAL') return 'sev-critical';
  if (sev === 'HIGH') return 'sev-high';
  if (sev === 'MEDIUM') return 'sev-medium';
  return 'sev-low';
}

// Store current findings globally for event handlers
let _topologyFindings = [];
let _topologyNodeFindings = {};



// ============================================================
// RENDER FUNCTION
// ============================================================

/**
 * Renders the topology map panel
 * @param {Array} findings - Array of finding objects with title, description, severity, component
 * @returns {string} HTML string for the topology panel
 */
function renderTopologyMap(findings) {
  _topologyFindings = findings || [];
  _topologyNodeFindings = mapFindingsToNodes(_topologyFindings);

  // Helper to render a single node
  function renderNode(nodeDef) {
    const nf = _topologyNodeFindings[nodeDef.id] || [];
    const status = getNodeStatus(nf);
    const count = nf.length;
    const sevClass = status.status === 'unknown' ? 'severity-unknown' :
                     status.status === 'critical' ? 'severity-critical' :
                     status.status === 'degraded' ? 'severity-degraded' :
                     status.status === 'warning' ? 'severity-warning' : 'severity-healthy';

    return `<div class="topology-node ${status.className}" data-node-id="${nodeDef.id}" onclick="window._topologyShowDetail('${nodeDef.id}')">
      <div class="node-icon">${nodeDef.icon}</div>
      <div class="node-name">${nodeDef.name}</div>
      <div class="node-count">${count} finding${count !== 1 ? 's' : ''}</div>
      ${count > 0 ? `<span class="node-severity ${sevClass}">${status.label}</span>` : '<span class="node-severity severity-unknown">No Data</span>'}
    </div>`;
  }

  // Helper to render connector lines between tiers
  function renderVerticalConnectors(count, nodeFindings, topIds, bottomIds) {
    let lines = '';
    for (let i = 0; i < count; i++) {
      const topId = topIds[i] || topIds[0];
      const bottomId = bottomIds[i] || bottomIds[0];
      const red = isConnectionRed(topId, bottomId, nodeFindings) ? ' conn-red' : '';
      lines += `<div class="topology-conn-vertical${red}"></div>`;
    }
    return `<div class="topology-vlines">${lines}</div>`;
  }

  // Helper to render horizontal connector
  function renderHorizontalConnector(leftId, rightId, nodeFindings) {
    const red = isConnectionRed(leftId, rightId, nodeFindings) ? ' conn-red' : '';
    return `<div class="topology-conn-line${red}"></div>`;
  }

  // Get nodes by tier
  const topTier = TOPOLOGY_NODES.filter(n => n.tier === 'top');
  const middleTier = TOPOLOGY_NODES.filter(n => n.tier === 'middle');
  const innerTier = TOPOLOGY_NODES.filter(n => n.tier === 'inner');
  const bottomTier = TOPOLOGY_NODES.filter(n => n.tier === 'bottom');

  // Build HTML
  const html = `
${TOPOLOGY_STYLES}
<div class="topology-panel" id="topology-map-panel">
  <div class="topology-header">
    <h2>🗺️ Cluster Topology Map</h2>
    <button class="topology-fullscreen-btn" onclick="openTopologyFullscreen()">⛶ Fullscreen</button>
  </div>

  <div class="topology-grid">
    <!-- Top Tier: Infrastructure -->
    <div class="topology-tier">
      ${topTier.map(n => renderNode(n)).join('')}
    </div>

    <!-- Connectors: Top → Middle -->
    ${renderVerticalConnectors(3, _topologyNodeFindings, 
      ['load-balancer', 'dns', 'external-network'], 
      ['node-1', 'node-2', 'node-3'])}

    <!-- Middle Tier: Cluster Nodes -->
    <div class="topology-tier">
      ${middleTier.map(n => renderNode(n)).join('')}
    </div>

    <!-- Connectors: Middle → Inner -->
    ${renderVerticalConnectors(3, _topologyNodeFindings, 
      ['node-1', 'node-2', 'node-3'], 
      ['vm-layer', 'storage-layer', 'os-kernel'])}

    <!-- Inner Tier: Layers -->
    <div class="topology-tier">
      ${innerTier.map(n => renderNode(n)).join('')}
    </div>

    <!-- Connectors: Inner → Bottom -->
    ${renderVerticalConnectors(3, _topologyNodeFindings, 
      ['vm-layer', 'storage-layer', 'os-kernel'], 
      ['san-storage', 'backup-system', 'management'])}

    <!-- Bottom Tier: Storage & Management -->
    <div class="topology-tier">
      ${bottomTier.map(n => renderNode(n)).join('')}
    </div>
  </div>

  <!-- Legend -->
  <div class="topology-legend">
    <div class="topology-legend-item">
      <div class="topology-legend-dot legend-green"></div>
      <span>Healthy</span>
    </div>
    <div class="topology-legend-item">
      <div class="topology-legend-dot legend-yellow"></div>
      <span>Warning (Medium)</span>
    </div>
    <div class="topology-legend-item">
      <div class="topology-legend-dot legend-orange"></div>
      <span>Degraded (High)</span>
    </div>
    <div class="topology-legend-item">
      <div class="topology-legend-dot legend-red"></div>
      <span>Critical</span>
    </div>
    <div class="topology-legend-item">
      <div class="topology-legend-dot legend-grey"></div>
      <span>Unknown/No Data</span>
    </div>
  </div>
</div>

<!-- Node Detail Overlay -->
<div class="topology-overlay" id="topology-overlay" onclick="window._topologyCloseDetail()"></div>
<div class="topology-node-detail" id="topology-node-detail">
  <button class="topology-detail-close" onclick="window._topologyCloseDetail()">✕</button>
  <h3 id="topology-detail-title"></h3>
  <div id="topology-detail-findings"></div>
</div>

<!-- Fullscreen Modal -->
<div class="topology-fullscreen-modal" id="topology-fullscreen-modal">
  <button class="topology-fullscreen-close" onclick="window._topologyCloseFullscreen()">✕ Close</button>
  <div id="topology-fullscreen-content"></div>
</div>
`;

  return html;
}



// ============================================================
// EVENT HANDLERS & INTERACTION
// ============================================================

/**
 * Shows the detail popup for a specific node
 */
window._topologyShowDetail = function(nodeId) {
  const nodeDef = TOPOLOGY_NODES.find(n => n.id === nodeId);
  if (!nodeDef) return;

  const findings = _topologyNodeFindings[nodeId] || [];
  const titleEl = document.getElementById('topology-detail-title');
  const findingsEl = document.getElementById('topology-detail-findings');
  const overlay = document.getElementById('topology-overlay');
  const detail = document.getElementById('topology-node-detail');

  if (!titleEl || !findingsEl || !overlay || !detail) return;

  titleEl.textContent = `${nodeDef.icon} ${nodeDef.name}`;

  if (findings.length === 0) {
    findingsEl.innerHTML = '<p style="color:#a6adc8;font-size:0.85rem;">No findings associated with this component.</p>';
  } else {
    findingsEl.innerHTML = findings.map(f => {
      const sevClass = getFindingSevClass(f);
      return `<div class="detail-finding ${sevClass}">
        <strong>${f.severity || 'INFO'}</strong>: ${f.title || f.description || 'Unnamed finding'}
        ${f.description && f.title ? `<br><span style="color:#a6adc8;font-size:0.75rem;">${f.description.substring(0, 120)}${f.description.length > 120 ? '...' : ''}</span>` : ''}
      </div>`;
    }).join('');
  }

  overlay.classList.add('active');
  detail.classList.add('active');
};

/**
 * Closes the node detail popup
 */
window._topologyCloseDetail = function() {
  const overlay = document.getElementById('topology-overlay');
  const detail = document.getElementById('topology-node-detail');
  if (overlay) overlay.classList.remove('active');
  if (detail) detail.classList.remove('active');
};

/**
 * Opens the topology map in fullscreen modal
 */
function openTopologyFullscreen() {
  const modal = document.getElementById('topology-fullscreen-modal');
  const content = document.getElementById('topology-fullscreen-content');
  if (!modal || !content) return;

  // Re-render inside fullscreen
  content.innerHTML = renderTopologyMap(_topologyFindings);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the fullscreen modal
 */
window._topologyCloseFullscreen = function() {
  const modal = document.getElementById('topology-fullscreen-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
};

// ============================================================
// SELF-INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  // Auto-inject into page if a target container exists
  const container = document.getElementById('topology-map-container');
  if (container) {
    // Look for findings data in global scope or data attribute
    const findings = window.logSherlockFindings || window.topologyFindings || [];
    container.innerHTML = renderTopologyMap(findings);
  }

  // Keyboard shortcut: Escape to close modals
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window._topologyCloseDetail();
      window._topologyCloseFullscreen();
    }
  });
});

// ============================================================
// EXPORTS
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderTopologyMap, openTopologyFullscreen };
}

// Also expose globally for script tag usage
window.renderTopologyMap = renderTopologyMap;
window.openTopologyFullscreen = openTopologyFullscreen;
