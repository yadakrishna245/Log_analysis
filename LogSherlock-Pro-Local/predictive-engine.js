/**
 * LogSherlock Pro - Risk Assessment Engine
 * Analyzes current findings and assesses risk of potential failures based on detected patterns.
 * 
 * NOTE: Risk levels are heuristic estimates based on pattern frequency.
 * They are not statistical predictions. Always verify with manual investigation.
 * 
 * @module predictive-engine
 */

(function () {
    'use strict';

    /**
     * Prediction rule definitions.
     * Each rule checks findings for specific patterns and returns a prediction object.
     * Probability is CALCULATED based on matching finding count, not hardcoded.
     */
    const PREDICTION_RULES = [
        {
            id: 'multipath_path_failed',
            check: (findings) => findings.filter(f =>
                /multipath.*(path.*fail|fault|down)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Storage may become unavailable if remaining path fails',
                timeToFailure: 'Monitor closely — timeframe depends on system load and configuration',
                trigger: 'Multipath path failure detected — redundancy already degraded',
                consequence: 'Complete storage loss, VMs freeze, data inaccessible',
                prevention: 'Immediately check and restore failed multipath links. Run `multipath -ll` and replace faulty HBA/cable/switch port.'
            }
        },
        {
            id: 'memory_pressure_swap',
            check: (findings) => {
                const memoryFindings = findings.filter(f =>
                    /memory.*(pressure|low|exhaust|crit)/i.test(f.message || f.title || f.description || '')
                );
                const swapFindings = findings.filter(f =>
                    /swap.*(usage|full|high|in|out|activat)/i.test(f.message || f.title || f.description || '')
                );
                // Return combined matches — both conditions must be present
                if (memoryFindings.length > 0 && swapFindings.length > 0) {
                    return [...memoryFindings, ...swapFindings];
                }
                return [];
            },
            prediction: {
                warning: 'OOM killer may terminate VMs',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'Memory pressure combined with heavy swap usage',
                consequence: 'OOM killer activates, critical processes/VMs may terminate without warning',
                prevention: 'Free memory NOW: stop non-essential services, add swap temporarily, or live-migrate VMs to other hosts. Check for memory leaks.'
            }
        },
        {
            id: 'disk_usage_critical',
            check: (findings) => findings.filter(f =>
                /disk.*(usage|space|full|9[0-9]%|capacity|low.*space)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Services may experience failures when disk reaches 100%',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'Disk usage warnings detected — filesystem filling up',
                consequence: 'Logging stops, databases may experience failures, services fail to write temp files',
                prevention: 'Clean up logs/tmp files immediately. Run `du -sh /var/log/*` and rotate/compress. Expand filesystem or add storage.'
            }
        },
        {
            id: 'bond_slave_down',
            check: (findings) => findings.filter(f =>
                /bond.*(slave|interface).*(down|fail|lost)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Complete network loss possible if second NIC fails',
                timeToFailure: 'Monitor closely — timeframe depends on system load and configuration',
                trigger: 'Bond slave interface is down — running on single NIC',
                consequence: 'Total network isolation, cluster split-brain, service outage',
                prevention: 'Check physical NIC, cable, and switch port. Run `cat /proc/net/bonding/bond0` and restore the slave interface.'
            }
        },
        {
            id: 'gfs2_warnings',
            check: (findings) => {
                const gfs2Findings = findings.filter(f =>
                    /gfs2.*(warn|error|slow|lock|stuck|contention)/i.test(f.message || f.title || f.description || '')
                );
                const hasWithdraw = findings.some(f =>
                    /gfs2.*withdraw/i.test(f.message || f.title || f.description || '')
                );
                return hasWithdraw ? [] : gfs2Findings;
            },
            prediction: {
                warning: 'GFS2 may withdraw, all mounts may become unavailable',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'GFS2 warnings accumulating — filesystem under stress',
                consequence: 'GFS2 withdraw triggers, all cluster mounts become inaccessible, services halt',
                prevention: 'Check GFS2 lock contention with `gfs2_tool`. Reduce I/O load, check DLM health, and verify cluster communication.'
            }
        },
        {
            id: 'corosync_warnings',
            check: (findings) => findings.filter(f =>
                /corosync.*(warn|retransmit|delay|token.*miss|fail)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Cluster quorum loss — elevated risk',
                timeToFailure: 'Monitor closely — timeframe depends on system load and configuration',
                trigger: 'Corosync communication warnings — cluster heartbeat degraded',
                consequence: 'Quorum lost, cluster partitions, fencing storm, all services restart chaotically',
                prevention: 'Check network between nodes immediately. Run `corosync-cfgtool -s` and verify multicast/unicast paths. Fix network latency.'
            }
        },
        {
            id: 'dlm_timeouts',
            check: (findings) => findings.filter(f =>
                /dlm.*(timeout|slow|wait|stuck|recover)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'DLM deadlock may freeze all cluster I/O',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'DLM lock timeouts detected — distributed lock manager stressed',
                consequence: 'Complete I/O freeze across all cluster nodes, GFS2 hangs, VMs unresponsive',
                prevention: 'Check DLM status with `dlm_tool ls`. Verify cluster communication, reduce lock contention, restart dlm_controld if safe.'
            }
        },
        {
            id: 'mysql_slow_queries',
            check: (findings) => findings.filter(f =>
                /mysql.*(slow.*quer|lock.*wait|too.*many.*connect|deadlock)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Database may stop accepting connections',
                timeToFailure: 'Monitor closely — timeframe depends on system load and configuration',
                trigger: 'MySQL slow queries accumulating — connection pool exhausting',
                consequence: 'Max connections reached, all applications lose DB access, cascading failures',
                prevention: 'Identify and kill long-running queries. Check `SHOW PROCESSLIST`, optimize slow queries, increase max_connections temporarily.'
            }
        },
        {
            id: 'elasticsearch_heap',
            check: (findings) => findings.filter(f =>
                /elasticsearch.*(heap|memory|gc.*overhead|circuit.*break)/i.test(f.message || f.title || f.description || '') ||
                /es.*(heap|oom|memory)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Search/logging may experience failures',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'Elasticsearch heap usage critically high — GC thrashing',
                consequence: 'Elasticsearch nodes may experience failures, logging pipeline breaks, no search capability',
                prevention: 'Reduce heap pressure: delete old indices, increase heap size, add nodes. Run `curl localhost:9200/_cat/nodes?v&h=heap.percent`.'
            }
        },
        {
            id: 'kernel_warnings',
            check: (findings) => findings.filter(f =>
                /kernel.*(warn|oops|bug|taint|rcu.*stall|soft.*lockup|hung.*task)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Kernel panic and host failure — elevated risk',
                timeToFailure: 'Monitor closely — timeframe depends on system load and configuration',
                trigger: 'Kernel warnings/oops detected — kernel stability compromised',
                consequence: 'Full host failure possible, all VMs and services lost without graceful shutdown',
                prevention: 'Plan immediate maintenance window. Live-migrate VMs if possible. Check for known kernel bugs, update kernel, or reboot in controlled manner.'
            }
        },
        {
            id: 'fence_kdump_issues',
            check: (findings) => findings.filter(f =>
                /fence.*(kdump|fail|error|timeout|unable)/i.test(f.message || f.title || f.description || '') ||
                /kdump.*(fence|fail|error)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Fencing may fail during next node failure',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'Fence/kdump configuration issues detected',
                consequence: 'Node failure without successful fencing may cause split-brain, data corruption across cluster',
                prevention: 'Test fencing NOW: `pcs stonith fence <node>` in maintenance mode. Verify fence_kdump config, network paths, and kdump service status.'
            }
        },
        {
            id: 'io_errors_accumulating',
            check: (findings) => findings.filter(f =>
                /(i\/o|io).*(error|fail|timeout|abort|reset)/i.test(f.message || f.title || f.description || '') ||
                /scsi.*(error|abort|reset|timeout)/i.test(f.message || f.title || f.description || '') ||
                /blk.*(error|timeout)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Data corruption risk increasing',
                timeToFailure: 'Risk increases if unaddressed',
                trigger: 'I/O errors accumulating on storage devices',
                consequence: 'Silent data corruption, filesystem damage, unrecoverable data loss',
                prevention: 'Check disk health with `smartctl -a /dev/sdX`. Replace failing disks immediately. Verify RAID status and backup integrity.'
            }
        }
    ];

    /**
     * Calculates probability based on the number of matching findings.
     * Formula: baseProb = 20 + (matchCount * 10), capped at 75%.
     * We NEVER claim above 75% — these are heuristic estimates, not statistical predictions.
     * 
     * @param {number} matchCount - Number of findings that matched the rule
     * @returns {number} Calculated probability percentage (30-75)
     */
    function calculateProbability(matchCount) {
        const baseProb = 20 + (matchCount * 10);
        return Math.min(baseProb, 75);
    }

    /**
     * Analyzes findings and returns an array of risk assessments.
     * Requires at least 2 matching findings before showing a prediction.
     * 
     * @param {Array} findings - Array of finding objects from log analysis
     * @returns {Array} Array of prediction objects sorted by probability descending
     */
    function predictFailures(findings) {
        if (!findings || !Array.isArray(findings) || findings.length === 0) {
            return [];
        }

        const predictions = [];

        for (const rule of PREDICTION_RULES) {
            try {
                const matchingFindings = rule.check(findings);
                
                // Require at least 2 matching findings before showing a prediction
                if (Array.isArray(matchingFindings) && matchingFindings.length >= 2) {
                    const probability = calculateProbability(matchingFindings.length);
                    predictions.push({
                        ...rule.prediction,
                        probability: probability,
                        matchCount: matchingFindings.length
                    });
                }
            } catch (e) {
                // Skip rules that error on malformed findings
                console.warn(`Prediction rule '${rule.id}' failed:`, e.message);
            }
        }

        // Sort by probability descending
        predictions.sort((a, b) => b.probability - a.probability);

        return predictions;
    }

    /**
     * Returns the color associated with a probability level.
     * @param {number} probability - Probability percentage (0-75)
     * @returns {string} CSS color value
     */
    function getProbabilityColor(probability) {
        if (probability >= 60) return '#ff8c00';
        if (probability >= 40) return '#ffd700';
        return '#87ceeb';
    }

    /**
     * Returns the risk level label for a probability.
     * @param {number} probability - Probability percentage (0-75)
     * @returns {string} Risk level label
     */
    function getRiskLevel(probability) {
        if (probability >= 60) return 'ELEVATED';
        if (probability >= 40) return 'MODERATE';
        return 'LOW';
    }

    /**
     * Renders the risk assessment panel as HTML.
     * @param {Array} findings - Array of finding objects from log analysis
     * @returns {string} HTML string for the risk assessment panel
     */
    function renderPredictivePanel(findings) {
        const predictions = predictFailures(findings);

        const styles = `
            <style>
                .predictive-panel {
                    background: #1a1a2e;
                    border-radius: 12px;
                    padding: 24px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #e0e0e0;
                    max-width: 900px;
                    margin: 20px auto;
                }
                .predictive-panel-title {
                    font-size: 1.6em;
                    font-weight: 700;
                    margin-bottom: 20px;
                    color: #ffffff;
                    text-align: center;
                }
                .predictive-panel-disclaimer {
                    font-size: 0.82em;
                    color: #999;
                    text-align: center;
                    margin-top: 20px;
                    padding: 12px 16px;
                    background: #0a1628;
                    border-radius: 6px;
                    border-left: 3px solid #666;
                    font-style: italic;
                }
                .prediction-card {
                    background: #16213e;
                    border-radius: 8px;
                    padding: 16px 20px;
                    margin-bottom: 14px;
                    border-left: 5px solid;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .prediction-card:hover {
                    transform: translateX(4px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                .prediction-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }
                .prediction-icon {
                    font-size: 1.4em;
                }
                .prediction-warning {
                    font-weight: 700;
                    font-size: 1.05em;
                    flex: 1;
                }
                .prediction-risk-badge {
                    font-size: 0.7em;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .prediction-details {
                    font-size: 0.9em;
                    color: #b0b0b0;
                    margin: 6px 0;
                }
                .prediction-time {
                    margin: 8px 0;
                    font-size: 0.9em;
                }
                .probability-bar-container {
                    background: #0f3460;
                    border-radius: 6px;
                    height: 10px;
                    margin: 10px 0;
                    overflow: hidden;
                }
                .probability-bar-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 0.5s ease;
                }
                .probability-label {
                    font-size: 0.8em;
                    color: #888;
                    text-align: right;
                    margin-top: 2px;
                }
                .prediction-prevention {
                    background: #0a1628;
                    border-radius: 6px;
                    padding: 10px 14px;
                    margin-top: 10px;
                    font-size: 0.88em;
                    border-left: 3px solid #4caf50;
                }
                .prediction-prevention-label {
                    color: #4caf50;
                    font-weight: 700;
                    margin-bottom: 4px;
                }
                .no-predictions {
                    text-align: center;
                    padding: 40px 20px;
                    font-size: 1.2em;
                    color: #4caf50;
                }
            </style>
        `;

        if (predictions.length === 0) {
            return `
                ${styles}
                <div class="predictive-panel">
                    <div class="predictive-panel-title">⚠️ Risk Assessment (Based on Detected Patterns)</div>
                    <div class="no-predictions">✅ No elevated risk patterns detected</div>
                    <div class="predictive-panel-disclaimer">Note: Risk levels are heuristic estimates based on pattern frequency. They are not statistical predictions. Always verify with manual investigation before taking action.</div>
                </div>
            `;
        }

        const cards = predictions.map(prediction => {
            const color = getProbabilityColor(prediction.probability);
            const riskLevel = getRiskLevel(prediction.probability);
            const badgeBg = prediction.probability >= 60 ? 'rgba(255,140,0,0.2)' :
                prediction.probability >= 40 ? 'rgba(255,215,0,0.2)' : 'rgba(135,206,235,0.2)';

            return `
                <div class="prediction-card" style="border-left-color: ${color};">
                    <div class="prediction-header">
                        <span class="prediction-icon">⚠️</span>
                        <span class="prediction-warning" style="color: ${color};">${prediction.warning}</span>
                        <span class="prediction-risk-badge" style="background: ${badgeBg}; color: ${color};">${riskLevel}</span>
                    </div>
                    <div class="prediction-details">
                        <strong>Trigger:</strong> ${prediction.trigger} (${prediction.matchCount} matching findings)
                    </div>
                    <div class="prediction-details">
                        <strong>Consequence:</strong> ${prediction.consequence}
                    </div>
                    <div class="prediction-time">
                        ⏳ <strong>${prediction.timeToFailure}</strong>
                    </div>
                    <div class="probability-bar-container">
                        <div class="probability-bar-fill" style="width: ${prediction.probability}%; background: ${color};"></div>
                    </div>
                    <div class="probability-label">Risk likelihood: ${prediction.probability}% (estimated)</div>
                    <div class="prediction-prevention">
                        <div class="prediction-prevention-label">🛡️ Recommended Action:</div>
                        ${prediction.prevention}
                    </div>
                </div>
            `;
        }).join('');

        return `
            ${styles}
            <div class="predictive-panel">
                <div class="predictive-panel-title">⚠️ Risk Assessment (Based on Detected Patterns)</div>
                ${cards}
                <div class="predictive-panel-disclaimer">Note: Risk levels are heuristic estimates based on pattern frequency. They are not statistical predictions. Always verify with manual investigation before taking action.</div>
            </div>
        `;
    }

    // Expose globally
    if (typeof window !== 'undefined') {
        window.predictFailures = predictFailures;
        window.renderPredictivePanel = renderPredictivePanel;
    }

    // Also export for Node.js/testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { predictFailures, renderPredictivePanel, calculateProbability };
    }
})();
