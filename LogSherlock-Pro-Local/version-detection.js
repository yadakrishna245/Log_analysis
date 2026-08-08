/**
 * LogSherlock Pro — HPE VM Essentials Version Detection Engine
 * 
 * PIPELINE STAGE: Runs FIRST before pattern matching.
 * When user pastes JIRA text or scans logs, this engine:
 * 1. Extracts the VME/HVM version mentioned
 * 2. Identifies component context (Alletra, GFS2, NFS, Ceph, etc.)
 * 3. Boosts/prioritizes patterns relevant to that version
 * 4. Flags version-specific known issues
 * 
 * HPE VME Version History:
 *   8.0.1 → 8.0.3 → 8.0.4 → 8.0.5 → 8.0.6 → 8.0.7 → 8.0.8 → 9.0.0 → 9.0.1
 *   (There is NO 8.1.x series)
 *   Layout versions: 1.0, 1.1, 1.2 (BETA in 8.0.4), 1.3
 *   Installer versions: 1.0.7, 1.0.8, 1.0.9+
 *   Alletra MP plugin: 1.0.0, 1.1.0, 1.1.1, 1.2.0+
 *   Morpheus Agent: 2.9.4, 2.9.7+
 */
(function() {
'use strict';

// ════════════════════════════════════════════════════════════════════
// VERSION INDICATORS — regex patterns that identify VME version in logs/JIRA
// ════════════════════════════════════════════════════════════════════
const VERSION_PATTERNS = [
  // Direct version mentions in JIRA/tickets
  { regex: /(?:HPE\s+)?(?:VM\s*Essentials|VME|Morpheus\s+VM)\s*(?:Software\s*)?v?(\d+\.\d+\.\d+)/i, type: 'vme_version' },
  { regex: /(?:HVM|hypervisor)\s*(?:version\s*)?v?(\d+\.\d+\.\d+)/i, type: 'hvm_version' },
  { regex: /VME\s*(\d+\.\d+\.\d+)/i, type: 'vme_version' },
  { regex: /version\s*[:=]?\s*(\d+\.\d+\.\d+)/i, type: 'generic_version' },
  
  // Layout version (cluster configuration version)
  { regex: /[Ll]ayout\s+version\s*[:=]?\s*(\d+\.\d+)/i, type: 'layout_version' },
  { regex: /cluster\s+layout\s*[:=]?\s*v?(\d+\.\d+)/i, type: 'layout_version' },
  
  // Installer version
  { regex: /[Ii]nstaller\s*(?:version\s*)?v?(\d+\.\d+\.\d+)/i, type: 'installer_version' },
  { regex: /vm[e-]installer\s*(\d+\.\d+\.\d+)/i, type: 'installer_version' },
  
  // Plugin versions
  { regex: /alletra(?:mp)?[-_]plugin\s*v?(\d+\.\d+\.\d+)/i, type: 'alletra_plugin' },
  { regex: /arubacx[-_]plugin\s*v?(\d+\.\d+\.\d+)/i, type: 'aruba_plugin' },
  
  // Agent versions
  { regex: /morpheus[-\s](?:linux[-\s])?agent\s*v?(\d+\.\d+\.\d+)/i, type: 'agent_version' },
  { regex: /morpheus-node.*v?(\d+\.\d+\.\d+)/i, type: 'node_package' },
  
  // From log file paths/names
  { regex: /\/(?:opt\/)?morpheus.*?(\d+\.\d+\.\d+)/i, type: 'morpheus_path_version' },
  { regex: /8\.0\.[1-8]-vme/i, type: 'doc_reference' },
  { regex: /9\.0\.\d+-vme/i, type: 'doc_reference' },
];

// ════════════════════════════════════════════════════════════════════
// VERSION-SPECIFIC KNOWN ISSUES DATABASE
// Source: Official HPE VME release notes (morpheusdata.com docs)
// ════════════════════════════════════════════════════════════════════
const VERSION_KNOWN_ISSUES = {
  '8.0.4': [
    { id: 'VME-804-001', issue: 'Cluster Layout 1.2 is BETA only — not for production', component: 'cluster', severity: 'HIGH' },
    { id: 'VME-804-002', issue: 'Alletra MP: No support for iface for Software iSCSI', component: 'alletra', severity: 'MEDIUM' },
    { id: 'VME-804-003', issue: 'VM Migration fails under heavy write-iops', component: 'alletra', severity: 'HIGH' },
    { id: 'VME-804-004', issue: 'Reconfigure with Alletra datastore fails if CD-ROM attached', component: 'alletra', severity: 'MEDIUM' },
    { id: 'VME-804-005', issue: 'Mixed datastore type not supported for snapshot features', component: 'alletra', severity: 'MEDIUM' },
    { id: 'VME-804-006', issue: 'VM in shutdown state will not migrate until powered on', component: 'alletra', severity: 'MEDIUM' },
    { id: 'VME-804-007', issue: 'Default image store created after virtual image upload causes provisioning issues', component: 'alletra', severity: 'MEDIUM' },
  ],
  '8.0.5': [
    { id: 'VME-805-001', issue: 'Identity source token expiration defaults to one year instead of configured interval', component: 'security', severity: 'MEDIUM' },
  ],
  '8.0.6': [
    { id: 'VME-806-001', issue: 'StorageException: Resource Already Exists (intermittent, alletramp-plugin v1.1.1)', component: 'alletra', severity: 'HIGH' },
    { id: 'VME-806-002', issue: 'Ubuntu VM fails to start after snapshot revert — cdrom device unmapped from host', component: 'alletra', severity: 'HIGH' },
    { id: 'VME-806-003', issue: 'VM creation with ISO virtual images fails volume creation — use Qcow2 images', component: 'alletra', severity: 'HIGH' },
    { id: 'VME-806-004', issue: 'Installer TUI v1.0.7 fails to deploy VME 8.0.6 — must use v1.0.8', component: 'installer', severity: 'CRITICAL' },
    { id: 'VME-806-005', issue: 'Multiple root disk reconfigurations cause false success on new disk add from Alletra', component: 'alletra', severity: 'MEDIUM' },
    { id: 'VME-806-006', issue: 'VM Migration fails under heavy write-iops', component: 'alletra', severity: 'HIGH' },
    { id: 'VME-806-007', issue: 'CD-ROM not removed after successful reconfiguration on Alletra datastore', component: 'alletra', severity: 'LOW' },
  ],
  '8.0.7': [
    { id: 'VME-807-001', issue: 'ISO virtual image volume creation fix included in this release', component: 'alletra', severity: 'INFO' },
  ],
  '8.0.8': [
    { id: 'VME-808-001', issue: 'Latest 8.x release — check release notes for accumulated fixes', component: 'general', severity: 'INFO' },
  ],
  '9.0.0': [
    { id: 'VME-900-001', issue: 'Stretch cluster feature — new failure modes for cross-site quorum', component: 'cluster', severity: 'HIGH' },
    { id: 'VME-900-002', issue: 'Memory overcommit — OOM risk if over-committed beyond physical RAM', component: 'virtualization', severity: 'HIGH' },
    { id: 'VME-900-003', issue: 'Storage orchestration handled by Morpheus agent directly (changed from Pacemaker)', component: 'storage', severity: 'INFO' },
  ],
  '9.0.1': [
    { id: 'VME-901-001', issue: 'Fix for MORPH-13534: NullPointerException on backup restore when source image deleted', component: 'backup', severity: 'HIGH' },
  ],
  // RMT Migration tool (applies to all versions)
  'rmt': [
    { id: 'RMT-001', issue: 'RMT creates qcow2 disks as compatibility v0.10 — Veeam backup fails with "Cannot store dirty bitmaps in qcow2 v2 files"', component: 'migration', severity: 'HIGH' },
    { id: 'RMT-002', issue: 'RMT thick-provisions disks during migration — may exceed available storage', component: 'migration', severity: 'MEDIUM' },
    { id: 'RMT-003', issue: 'Workaround: Storage vMotion disk to another datastore converts to v1.1 compatibility', component: 'migration', severity: 'INFO' },
  ],
};

// ════════════════════════════════════════════════════════════════════
// COMPONENT DETECTION — identify which subsystem is mentioned
// ════════════════════════════════════════════════════════════════════
const COMPONENT_INDICATORS = [
  { regex: /\b(GFS2|gfs2|global file system)\b/i, component: 'gfs2' },
  { regex: /\b(DLM|distributed lock manager|dlm_controld)\b/i, component: 'dlm' },
  { regex: /\b(NFS|nfs[v]?\d?|nfsd|rpc\.mountd)\b/i, component: 'nfs' },
  { regex: /\b(Alletra|alletra[- ]?mp|3PAR|nimble)\b/i, component: 'alletra' },
  { regex: /\b(GreenLake|DSCC|greenlake|data services)\b/i, component: 'greenlake' },
  { regex: /\b(iSCSI|iscsi|iscsid|iscsiadm)\b/i, component: 'iscsi' },
  { regex: /\b(multipath|multipathd|dm-|mpath)\b/i, component: 'multipath' },
  { regex: /\b(Ceph|ceph[-_ ]?osd|ceph[-_ ]?mon|rados)\b/i, component: 'ceph' },
  { regex: /\b(corosync|pacemaker|STONITH|fencing|quorum)\b/i, component: 'cluster' },
  { regex: /\b(KVM|QEMU|qemu-kvm|libvirt|virsh)\b/i, component: 'virtualization' },
  { regex: /\b(VMware|vSphere|vCenter|ESXi|VMDK)\b/i, component: 'vmware' },
  { regex: /\b(migrat|RMT|rapid migration|convert)\b/i, component: 'migration' },
  { regex: /\b(Veeam|backup|snapshot|restore)\b/i, component: 'backup' },
  { regex: /\b(Morpheus|morpheus-ui|morpheus-ctl)\b/i, component: 'morpheus' },
  { regex: /\b(bond\d|LACP|NIC|eth\d|ens\d)/i, component: 'network' },
  { regex: /\b(OOM|out of memory|oom.kill|memory)\b/i, component: 'memory' },
  { regex: /\b(dracut|initramfs|grub|boot|BSOD|VirtIO)\b/i, component: 'boot' },
  { regex: /\b(Zerto|DR|disaster recovery|replication)\b/i, component: 'dr' },
];

// ════════════════════════════════════════════════════════════════════
// MAIN DETECTION FUNCTION
// ════════════════════════════════════════════════════════════════════
function detectVersionAndContext(text) {
  const result = {
    vme_version: null,
    hvm_version: null,
    layout_version: null,
    installer_version: null,
    plugin_versions: {},
    components: [],
    known_issues: [],
    version_confidence: 0,
    raw_versions: [],
  };

  if (!text || typeof text !== 'string') return result;

  // Step 1: Extract all version mentions
  for (const vp of VERSION_PATTERNS) {
    const match = text.match(vp.regex);
    if (match) {
      const ver = match[1];
      result.raw_versions.push({ version: ver, type: vp.type });
      
      switch (vp.type) {
        case 'vme_version':
          result.vme_version = ver;
          result.version_confidence = 95;
          break;
        case 'hvm_version':
          result.hvm_version = ver;
          result.version_confidence = Math.max(result.version_confidence, 90);
          break;
        case 'layout_version':
          result.layout_version = ver;
          result.version_confidence = Math.max(result.version_confidence, 70);
          break;
        case 'installer_version':
          result.installer_version = ver;
          result.version_confidence = Math.max(result.version_confidence, 60);
          break;
        case 'alletra_plugin':
          result.plugin_versions.alletra = ver;
          break;
        case 'aruba_plugin':
          result.plugin_versions.aruba = ver;
          break;
        case 'agent_version':
          result.plugin_versions.agent = ver;
          break;
        case 'generic_version':
          if (!result.vme_version) {
            // Only use generic if no specific version found
            const v = ver;
            if (v.startsWith('8.0.') || v.startsWith('9.0.')) {
              result.vme_version = v;
              result.version_confidence = Math.max(result.version_confidence, 50);
            }
          }
          break;
      }
    }
  }

  // Step 2: Detect components mentioned
  const componentSet = new Set();
  for (const ci of COMPONENT_INDICATORS) {
    if (ci.regex.test(text)) {
      componentSet.add(ci.component);
    }
  }
  result.components = [...componentSet];

  // Step 3: Look up version-specific known issues
  if (result.vme_version) {
    // Get the minor version key (e.g., "8.0.6" from "8.0.6")
    const verKey = result.vme_version;
    if (VERSION_KNOWN_ISSUES[verKey]) {
      result.known_issues = [...VERSION_KNOWN_ISSUES[verKey]];
    }
    // Also check if they match major version issues
    const major = verKey.split('.').slice(0, 2).join('.');
    // For all 8.0.x, include RMT issues if migration is mentioned
    if (result.components.includes('migration') || text.match(/migrat|RMT|VMware.*HVM/i)) {
      result.known_issues.push(...(VERSION_KNOWN_ISSUES['rmt'] || []));
    }
  }

  // Step 4: Filter known issues by detected components
  if (result.components.length > 0 && result.known_issues.length > 0) {
    // Boost issues matching detected components
    result.known_issues.sort((a, b) => {
      const aMatch = result.components.includes(a.component) ? 1 : 0;
      const bMatch = result.components.includes(b.component) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════
// PATTERN BOOSTING — prioritize patterns for detected version/component
// ════════════════════════════════════════════════════════════════════
function boostPatternsByContext(findings, versionContext) {
  if (!findings || !findings.length) return findings;
  if (!versionContext || (!versionContext.vme_version && versionContext.components.length === 0)) {
    return findings;
  }

  // Map component names to pattern product/category matches
  const componentToProduct = {
    'gfs2': ['gfs2', 'filesystem'],
    'dlm': ['gfs2', 'cluster'],
    'nfs': ['nfs'],
    'alletra': ['alletra', 'storage'],
    'greenlake': ['alletra', 'greenlake'],
    'iscsi': ['alletra', 'storage'],
    'multipath': ['storage'],
    'ceph': ['ceph', 'storage'],
    'cluster': ['hvm-cluster', 'cluster'],
    'virtualization': ['hvm', 'virtualization'],
    'vmware': ['hvm-migration', 'vmware'],
    'migration': ['hvm-migration'],
    'backup': ['backup'],
    'morpheus': ['morpheus', 'service'],
    'network': ['network'],
    'memory': ['kernel', 'performance'],
    'boot': ['hvm-migration', 'kernel'],
    'dr': ['backup', 'cluster'],
  };

  const relevantProducts = new Set();
  for (const comp of versionContext.components) {
    const products = componentToProduct[comp] || [];
    products.forEach(p => relevantProducts.add(p));
  }

  // Score each finding
  return findings.map(f => {
    let boost = 0;
    const product = f.product || '';
    const category = (f.category || '').toLowerCase();

    if (relevantProducts.has(product)) boost += 20;
    if (relevantProducts.has(category)) boost += 10;

    // Version-specific boost
    if (versionContext.vme_version) {
      const ver = versionContext.vme_version;
      if (f.description && f.description.includes(ver)) boost += 30;
      if (f.solution_hint && f.solution_hint.includes(ver)) boost += 15;
    }

    return { ...f, _relevance_boost: boost };
  }).sort((a, b) => {
    // Primary: severity (CRITICAL > HIGH > MEDIUM > LOW)
    const sevOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
    const sevDiff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    // Secondary: relevance boost
    return (b._relevance_boost || 0) - (a._relevance_boost || 0);
  });
}

// ════════════════════════════════════════════════════════════════════
// EXPOSE GLOBALLY
// ════════════════════════════════════════════════════════════════════
window.LSP_VersionDetection = {
  detect: detectVersionAndContext,
  boost: boostPatternsByContext,
  knownIssues: VERSION_KNOWN_ISSUES,
  versionPatterns: VERSION_PATTERNS,
  componentIndicators: COMPONENT_INDICATORS,
};

console.log('[LogSherlock] Version Detection Engine loaded — covers VME 8.0.1→9.0.1');

})();
