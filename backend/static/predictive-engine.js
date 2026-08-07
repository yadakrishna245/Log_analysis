/**
 * LogSherlock Pro - Predictive Failure Warning Engine
 * Analyzes current findings and PREDICTS what will fail next if not fixed.
 * 
 * @module predictive-engine
 */

(function () {
    'use strict';

    /**
     * Prediction rule definitions.
     * Each rule checks findings for specific patterns and returns a prediction object.
     */
    const PREDICTION_RULES = [
        {
            id: 'multipath_path_failed',
            check: (findings) => findings.some(f =>
                /multipath.*(path.*fail|fault|down)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Storage will become unavailable if remaining path fails',
                timeToFailure: '24-48 hours',
                probability: 70,
                trigger: 'Multipath path failure detected — redundancy already degraded',
                consequence: 'Complete storage loss, VMs freeze, data inaccessible',
                prevention: 'Immediately check and restore failed multipath links. Run `multipath -ll` and replace faulty HBA/cable/switch port.'
            }
        },
        {
            id: 'memory_pressure_swap',
            check: (findings) => {
                const hasMemory = findings.some(f =>
                    /memory.*(pressure|low|exhaust|crit)/i.test(f.message || f.title || f.description || '')
                );
                const hasSwap = findings.some(f =>
                    /swap.*(usage|full|high|in|out|activat)/i.test(f.message || f.title || f.description || '')
                );
                return hasMemory && hasSwap;
            },
            prediction: {
                warning: 'OOM killer will terminate VMs',
                timeToFailure: '2-6 hours',
                probability: 85,
                trigger: 'Memory pressure combined with heavy swap usage',
                consequence: 'OOM killer activates, critical processes/VMs terminated without warning',
                prevention: 'Free memory NOW: stop non-essential services, add swap temporarily, or live-migrate VMs to other hosts. Check for memory leaks.'
            }
        },
        {
            id: 'disk_usage_critical',
            check: (findings) => findings.some(f =>
                /disk.*(usage|space|full|9[0-9]%|capacity|low.*space)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Services will crash when disk reaches 100%',
                timeToFailure: '12-24 hours',
                probability: 80,
                trigger: 'Disk usage warnings detected — filesystem filling up',
                consequence: 'Logging stops, databases crash, services fail to write temp files',
                prevention: 'Clean up logs/tmp files immediately. Run `du -sh /var/log/*` and rotate/compress. Expand filesystem or add storage.'
            }
        },
        {
            id: 'bond_slave_down',
            check: (findings) => findings.some(f =>
                /bond.*(slave|interface).*(down|fail|lost)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Complete network loss if second NIC fails',
                timeToFailure: 'Unpredictable',
                probability: 40,
                trigger: 'Bond slave interface is down — running on single NIC',
                consequence: 'Total network isolation, cluster split-brain, service outage',
                prevention: 'Check physical NIC, cable, and switch port. Run `cat /proc/net/bonding/bond0` and restore the slave interface.'
            }
        },
        {
            id: 'gfs2_warnings',
            check: (findings) => {
                const hasGfs2 = findings.some(f =>
                    /gfs2.*(warn|error|slow|lock|stuck|contention)/i.test(f.message || f.title || f.description || '')
                );
                const hasWithdraw = findings.some(f =>
                    /gfs2.*withdraw/i.test(f.message || f.title || f.description || '')
                );
                return hasGfs2 && !hasWithdraw;
            },
            prediction: {
                warning: 'GFS2 will withdraw, all mounts lost',
                timeToFailure: '4-12 hours',
                probability: 75,
                trigger: 'GFS2 warnings accumulating — filesystem under stress',
                consequence: 'GFS2 withdraw triggers, all cluster mounts become inaccessible, services halt',
                prevention: 'Check GFS2 lock contention with `gfs2_tool`. Reduce I/O load, check DLM health, and verify cluster communication.'
            }
        },
        {
            id: 'corosync_warnings',
            check: (findings) => findings.some(f =>
                /corosync.*(warn|retransmit|delay|token.*miss|fail)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Cluster quorum loss imminent',
                timeToFailure: '1-4 hours',
                probability: 65,
                trigger: 'Corosync communication warnings — cluster heartbeat degraded',
                consequence: 'Quorum lost, cluster partitions, fencing storm, all services restart chaotically',
                prevention: 'Check network between nodes immediately. Run `corosync-cfgtool -s` and verify multicast/unicast paths. Fix network latency.'
            }
        },
        {
            id: 'dlm_timeouts',
            check: (findings) => findings.some(f =>
                /dlm.*(timeout|slow|wait|stuck|recover)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'DLM deadlock will freeze all cluster I/O',
                timeToFailure: '2-8 hours',
                probability: 70,
                trigger: 'DLM lock timeouts detected — distributed lock manager stressed',
                consequence: 'Complete I/O freeze across all cluster nodes, GFS2 hangs, VMs unresponsive',
                prevention: 'Check DLM status with `dlm_tool ls`. Verify cluster communication, reduce lock contention, restart dlm_controld if safe.'
            }
        },
        {
            id: 'mysql_slow_queries',
            check: (findings) => findings.some(f =>
                /mysql.*(slow.*quer|lock.*wait|too.*many.*connect|deadlock)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Database will stop accepting connections',
                timeToFailure: '6-24 hours',
                probability: 55,
                trigger: 'MySQL slow queries accumulating — connection pool exhausting',
                consequence: 'Max connections reached, all applications lose DB access, cascading failures',
                prevention: 'Identify and kill long-running queries. Check `SHOW PROCESSLIST`, optimize slow queries, increase max_connections temporarily.'
            }
        },
        {
            id: 'elasticsearch_heap',
            check: (findings) => findings.some(f =>
                /elasticsearch.*(heap|memory|gc.*overhead|circuit.*break)/i.test(f.message || f.title || f.description || '') ||
                /es.*(heap|oom|memory)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Search/logging will fail',
                timeToFailure: '4-12 hours',
                probability: 60,
                trigger: 'Elasticsearch heap usage critically high — GC thrashing',
                consequence: 'Elasticsearch nodes crash, logging pipeline breaks, no search capability',
                prevention: 'Reduce heap pressure: delete old indices, increase heap size, add nodes. Run `curl localhost:9200/_cat/nodes?v&h=heap.percent`.'
            }
        },
        {
            id: 'kernel_warnings',
            check: (findings) => findings.some(f =>
                /kernel.*(warn|oops|bug|taint|rcu.*stall|soft.*lockup|hung.*task)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Kernel panic and host crash likely',
                timeToFailure: 'Unpredictable',
                probability: 50,
                trigger: 'Kernel warnings/oops detected — kernel stability compromised',
                consequence: 'Full host crash, all VMs and services lost without graceful shutdown',
                prevention: 'Plan immediate maintenance window. Live-migrate VMs if possible. Check for known kernel bugs, update kernel, or reboot in controlled manner.'
            }
        },
        {
            id: 'fence_kdump_issues',
            check: (findings) => findings.some(f =>
                /fence.*(kdump|fail|error|timeout|unable)/i.test(f.message || f.title || f.description || '') ||
                /kdump.*(fence|fail|error)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Fencing will fail during next node failure',
                timeToFailure: 'On next failure',
                probability: 80,
                trigger: 'Fence/kdump configuration issues detected',
                consequence: 'Node failure without successful fencing causes split-brain, data corruption across cluster',
                prevention: 'Test fencing NOW: `pcs stonith fence <node>` in maintenance mode. Verify fence_kdump config, network paths, and kdump service status.'
            }
        },
        {
            id: 'io_errors_accumulating',
            check: (findings) => findings.some(f =>
                /(i\/o|io).*(error|fail|timeout|abort|reset)/i.test(f.message || f.title || f.description || '') ||
                /scsi.*(error|abort|reset|timeout)/i.test(f.message || f.title || f.description || '') ||
                /blk.*(error|timeout)/i.test(f.message || f.title || f.description || '')
            ),
            prediction: {
                warning: 'Data corruption risk increasing',
                timeToFailure: 'Continuous',
                probability: 60,
                trigger: 'I/O errors accumulating on storage devices',
                consequence: 'Silent data corruption, filesystem damage, unrecoverable data loss',
                prevention: 'Check disk health with `smartctl -a /dev/sdX`. Replace failing disks immediately. Verify RAID status and backup integrity.'
            }
        }
    ];

    /**
     * Analyzes findings and returns an array of failure predictions.
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
                if (rule.check(findings)) {
                    predictions.push({ ...rule.prediction });
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
     * @param {number} probability - Probability percentage (0-100)
     * @returns {string} CSS color value
     */
    function getProbabilityColor(probability) {
        if (probability > 70) return '#ff4444';
        if (probability >= 50) return '#ff8c00';
        return '#ffd700';
    }

    /**
     * Returns the risk level label for a probability.
     * @param {number} probability - Probability percentage (0-100)
     * @returns {string} Risk level label
     */
    function getRiskLevel(probability) {
        if (probability > 70) return 'HIGH';
        if (probability >= 50) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Renders the predictive failure panel as HTML.
     * @param {Array} findings - Array of finding objects from log analysis
     * @returns {string} HTML string for the predictive panel
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
                    <div class="predictive-panel-title">🔮 Predictive Failure Warnings</div>
                    <div class="no-predictions">✅ No imminent failures predicted</div>
                </div>
            `;
        }

        const cards = predictions.map(prediction => {
            const color = getProbabilityColor(prediction.probability);
            const riskLevel = getRiskLevel(prediction.probability);
            const badgeBg = prediction.probability > 70 ? 'rgba(255,68,68,0.2)' :
                prediction.probability >= 50 ? 'rgba(255,140,0,0.2)' : 'rgba(255,215,0,0.2)';

            return `
                <div class="prediction-card" style="border-left-color: ${color};">
                    <div class="prediction-header">
                        <span class="prediction-icon">⚠️</span>
                        <span class="prediction-warning" style="color: ${color};">${prediction.warning}</span>
                        <span class="prediction-risk-badge" style="background: ${badgeBg}; color: ${color};">${riskLevel} ${prediction.probability}%</span>
                    </div>
                    <div class="prediction-details">
                        <strong>Trigger:</strong> ${prediction.trigger}
                    </div>
                    <div class="prediction-details">
                        <strong>Consequence:</strong> ${prediction.consequence}
                    </div>
                    <div class="prediction-time">
                        ⏳ Estimated: <strong>${prediction.timeToFailure}</strong>
                    </div>
                    <div class="probability-bar-container">
                        <div class="probability-bar-fill" style="width: ${prediction.probability}%; background: ${color};"></div>
                    </div>
                    <div class="probability-label">Probability: ${prediction.probability}%</div>
                    <div class="prediction-prevention">
                        <div class="prediction-prevention-label">🛡️ Prevention — Act NOW:</div>
                        ${prediction.prevention}
                    </div>
                </div>
            `;
        }).join('');

        return `
            ${styles}
            <div class="predictive-panel">
                <div class="predictive-panel-title">🔮 Predictive Failure Warnings</div>
                ${cards}
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
        module.exports = { predictFailures, renderPredictivePanel };
    }
})();
