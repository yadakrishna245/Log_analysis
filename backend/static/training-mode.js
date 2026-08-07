/**
 * LogSherlock Pro - Training Mode / Challenge Feature
 * Gamified training for new engineers to practice log analysis skills.
 * Standalone, self-initializing module.
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════
  const STYLES = `
    .training-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.92); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
      animation: training-fadeIn 0.3s ease;
    }
    @keyframes training-fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes training-slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes training-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes training-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }
    @keyframes training-starPop { 0% { transform: scale(0) rotate(-20deg); } 60% { transform: scale(1.3) rotate(5deg); } 100% { transform: scale(1) rotate(0); } }
    @keyframes training-confetti { 0% { transform: translateY(0) rotate(0); opacity:1; } 100% { transform: translateY(-80px) rotate(720deg); opacity:0; } }

    .training-modal {
      background: #1a1d23; border-radius: 16px; padding: 32px;
      max-width: 720px; width: 92%; max-height: 88vh; overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.15);
      animation: training-slideUp 0.4s ease;
      color: #e0e0e0;
    }
    .training-modal::-webkit-scrollbar { width: 6px; }
    .training-modal::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

    .training-header { text-align: center; margin-bottom: 24px; }
    .training-header h2 { color: #ffd700; font-size: 1.8rem; margin: 0 0 8px; }
    .training-header p { color: #aaa; margin: 0; }

    .training-btn {
      background: linear-gradient(135deg, #ffd700, #ffaa00);
      color: #1a1d23; border: none; padding: 12px 28px;
      border-radius: 8px; font-weight: 700; font-size: 1rem;
      cursor: pointer; transition: all 0.2s;
    }
    .training-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,215,0,0.4); }
    .training-btn:active { transform: translateY(0); }
    .training-btn-secondary {
      background: #2a2d35; color: #ffd700; border: 1px solid #ffd700;
      padding: 10px 22px; border-radius: 8px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .training-btn-secondary:hover { background: #3a3d45; }
    .training-btn-close {
      position: absolute; top: 16px; right: 20px;
      background: none; border: none; color: #888; font-size: 1.5rem;
      cursor: pointer; transition: color 0.2s;
    }
    .training-btn-close:hover { color: #fff; }

    .training-challenge-list { display: grid; gap: 12px; margin-top: 16px; }
    .training-challenge-card {
      background: #22252d; border-radius: 10px; padding: 16px 20px;
      display: flex; align-items: center; gap: 16px;
      border: 1px solid #333; cursor: pointer; transition: all 0.2s;
    }
    .training-challenge-card:hover { border-color: #ffd700; transform: translateX(4px); }
    .training-challenge-card.completed { border-color: #4caf50; }
    .training-challenge-card.locked { opacity: 0.5; cursor: not-allowed; }

    .training-difficulty {
      padding: 4px 10px; border-radius: 4px; font-size: 0.75rem;
      font-weight: 700; text-transform: uppercase;
    }
    .training-difficulty-easy { background: #1b5e20; color: #69f0ae; }
    .training-difficulty-medium { background: #e65100; color: #ffab40; }
    .training-difficulty-hard { background: #b71c1c; color: #ff5252; }

    .training-stars { color: #ffd700; font-size: 1.2rem; letter-spacing: 2px; }
    .training-stars .empty { color: #444; }
    .training-star-anim { display: inline-block; animation: training-starPop 0.4s ease forwards; }

    .training-timer {
      font-size: 2rem; font-weight: 700; text-align: center;
      font-variant-numeric: tabular-nums; margin: 12px 0;
    }
    .training-timer.warning { color: #ff5252; animation: training-pulse 0.8s infinite; }
    .training-timer.normal { color: #69f0ae; }

    .training-findings {
      background: #0d1117; border: 1px solid #333; border-radius: 8px;
      padding: 16px; margin: 16px 0; font-family: 'Cascadia Code', monospace;
      font-size: 0.85rem; line-height: 1.6; max-height: 200px; overflow-y: auto;
    }
    .training-findings .log-line { margin: 2px 0; }
    .training-findings .severity-critical { color: #ff5252; }
    .training-findings .severity-warning { color: #ffab40; }
    .training-findings .severity-info { color: #64b5f6; }

    .training-options { display: grid; gap: 10px; margin: 16px 0; }
    .training-option {
      background: #2a2d35; border: 2px solid #444; border-radius: 8px;
      padding: 14px 18px; cursor: pointer; transition: all 0.2s;
      text-align: left; color: #e0e0e0; font-size: 0.95rem;
    }
    .training-option:hover { border-color: #ffd700; background: #33363e; }
    .training-option.selected { border-color: #ffd700; background: #33363e; }
    .training-option.correct { border-color: #4caf50; background: #1b5e20; animation: training-pulse 0.5s; }
    .training-option.wrong { border-color: #ff5252; background: #4a1111; animation: training-shake 0.5s; }

    .training-hint-btn {
      background: #2a2d35; border: 1px dashed #ffd700; color: #ffd700;
      padding: 8px 16px; border-radius: 6px; cursor: pointer;
      font-size: 0.85rem; transition: all 0.2s;
    }
    .training-hint-btn:hover { background: #33363e; }
    .training-hint-box {
      background: #1a2a1a; border: 1px solid #4caf50; border-radius: 6px;
      padding: 12px; margin-top: 8px; color: #a5d6a7; font-size: 0.9rem;
    }

    .training-result {
      text-align: center; padding: 24px;
    }
    .training-result-icon { font-size: 4rem; margin-bottom: 16px; }
    .training-result h3 { font-size: 1.5rem; margin: 8px 0; }
    .training-result .correct-text { color: #4caf50; }
    .training-result .wrong-text { color: #ff5252; }

    .training-profile {
      background: #22252d; border-radius: 12px; padding: 20px;
      margin-bottom: 20px; border: 1px solid #333;
    }
    .training-profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
    .training-profile-avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #ffd700, #ff8f00);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 700; color: #1a1d23;
    }
    .training-rank { color: #ffd700; font-weight: 700; font-size: 1.1rem; }
    .training-progress-bar {
      height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin-top: 8px;
    }
    .training-progress-fill {
      height: 100%; background: linear-gradient(90deg, #ffd700, #ff8f00);
      border-radius: 4px; transition: width 0.5s ease;
    }

    .training-leaderboard { margin-top: 16px; }
    .training-leaderboard-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid #2a2d35;
    }
    .training-leaderboard-row:first-child { color: #ffd700; font-weight: 700; }

    .training-confetti {
      position: absolute; pointer-events: none;
      animation: training-confetti 1.5s ease forwards;
    }

    .training-tab-bar {
      display: flex; gap: 4px; margin-bottom: 20px;
      border-bottom: 2px solid #333; padding-bottom: 0;
    }
    .training-tab {
      padding: 10px 20px; cursor: pointer; color: #888;
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      transition: all 0.2s; background: none; border-top: none;
      border-left: none; border-right: none; font-size: 0.95rem;
    }
    .training-tab:hover { color: #ffd700; }
    .training-tab.active { color: #ffd700; border-bottom-color: #ffd700; font-weight: 600; }
  `;

  // ═══════════════════════════════════════════════════════════════
  // CHALLENGE DATA (10 challenges, increasing difficulty)
  // ═══════════════════════════════════════════════════════════════
  const CHALLENGES = [
    {
      id: 1,
      title: 'Identify the kernel panic cause',
      difficulty: 'easy',
      description: 'A production server crashed. Review the 5 findings below and identify the root cause of the kernel panic.',
      findings: [
        { text: '[CRITICAL] kernel: BUG: unable to handle kernel NULL pointer dereference at 0000000000000048', severity: 'critical' },
        { text: '[WARNING] kernel: CPU#3 stuck for 22s! [migration/3:22]', severity: 'warning' },
        { text: '[INFO] systemd: Started Daily apt download activities.', severity: 'info' },
        { text: '[CRITICAL] kernel: Call Trace: ext4_iget+0x3a/0xb60 → NULL ptr dereference in ext4 module', severity: 'critical' },
        { text: '[INFO] kernel: Memory cgroup stats - usage: 2.1GB / 8GB limit', severity: 'info' }
      ],
      question: 'What caused the kernel panic?',
      options: [
        'Out of memory (OOM)',
        'Corrupted ext4 filesystem causing NULL pointer dereference',
        'CPU overload from migration threads',
        'Systemd apt activity conflict',
        'Memory cgroup limit exceeded'
      ],
      correct_answer: 1,
      hints: [
        'Look at the CRITICAL severity entries',
        'The Call Trace shows which kernel module failed',
        'ext4_iget deals with filesystem inode operations'
      ],
      points: 10,
      time_limit_seconds: 120
    },
    {
      id: 2,
      title: 'Which service crashed first?',
      difficulty: 'easy',
      description: 'Multiple services failed in a cascade. Put the crash events in chronological order to identify which service failed FIRST.',
      findings: [
        { text: '[14:03:22] nginx: upstream timed out (110: Connection timed out) while reading response from upstream', severity: 'warning' },
        { text: '[14:02:58] postgresql: FATAL: too many connections for role "appuser"', severity: 'critical' },
        { text: '[14:03:45] app-server: CRITICAL - Health check failed, shutting down', severity: 'critical' },
        { text: '[14:02:45] redis: # Server started, Redis version=6.2.6', severity: 'info' },
        { text: '[14:02:30] postgresql: LOG: connection received: host=10.0.1.5 port=45832 (connection #251 of 250 max)', severity: 'warning' }
      ],
      question: 'Which service experienced the first sign of trouble?',
      options: [
        'nginx',
        'Redis',
        'PostgreSQL (connection limit hit)',
        'App Server',
        'All crashed simultaneously'
      ],
      correct_answer: 2,
      hints: [
        'Look at the timestamps carefully',
        'The earliest warning timestamp is the first issue',
        'PostgreSQL logged a connection limit warning at 14:02:30'
      ],
      points: 10,
      time_limit_seconds: 90
    },
    {
      id: 3,
      title: 'What severity is this issue?',
      difficulty: 'easy',
      description: 'A monitoring alert fired. Based on the findings below, classify the correct severity level for the incident ticket.',
      findings: [
        { text: '[WARNING] disk: /dev/sda1 usage at 89% (threshold: 85%)', severity: 'warning' },
        { text: '[INFO] cron: Successfully rotated logs, freed 2.1GB', severity: 'info' },
        { text: '[WARNING] disk: /dev/sda1 usage at 91% after rotation (growing 2%/hour)', severity: 'warning' },
        { text: '[INFO] app: Serving 1,200 req/s normally', severity: 'info' },
        { text: '[INFO] backup: Next scheduled backup in 4 hours (requires 5GB free, currently 11GB free)', severity: 'info' }
      ],
      question: 'What severity should this ticket be classified as?',
      options: [
        'SEV-1 Critical: Immediate page required',
        'SEV-2 High: Fix within 1 hour',
        'SEV-3 Medium: Fix within 4 hours',
        'SEV-4 Low: Fix within 24 hours',
        'No action needed'
      ],
      correct_answer: 2,
      hints: [
        'Consider the growth rate vs available space',
        'At 2%/hour growth, when will the disk hit 100%?',
        'The backup needs 5GB and runs in 4 hours'
      ],
      points: 10,
      time_limit_seconds: 90
    },
    {
      id: 4,
      title: 'Find the root cause in 3 files',
      difficulty: 'medium',
      description: 'The application crashed. Logs from 3 different files are presented. Correlate them to find the root cause.',
      findings: [
        { text: '[app.log] 09:14:02 ERROR ConnectionPool exhausted: waited 30s, no available connection', severity: 'critical' },
        { text: '[app.log] 09:14:03 FATAL Application shutting down - cannot serve requests', severity: 'critical' },
        { text: '[db.log] 09:13:30 WARNING Long-running query detected: SELECT * FROM orders JOIN inventory (running 45s)', severity: 'warning' },
        { text: '[db.log] 09:13:31 WARNING 48 of 50 connections in use by long queries', severity: 'warning' },
        { text: '[deploy.log] 09:12:00 INFO Deployed version 2.4.1 - includes new inventory report query', severity: 'info' },
        { text: '[deploy.log] 09:12:01 INFO Migration: Added full table scan query to report generator', severity: 'info' }
      ],
      question: 'What is the root cause of the application crash?',
      options: [
        'Database server ran out of memory',
        'Network connectivity issue between app and DB',
        'New deployment (v2.4.1) introduced unoptimized full-table-scan query that exhausted DB connection pool',
        'Connection pool configuration is too small',
        'Too many users accessing the system simultaneously'
      ],
      correct_answer: 2,
      hints: [
        'Correlate the deploy timestamp with when issues started',
        'The deploy log mentions a "full table scan query"',
        'The DB shows long-running queries consuming almost all connections'
      ],
      points: 20,
      time_limit_seconds: 180
    },
    {
      id: 5,
      title: 'Determine the cascade chain',
      difficulty: 'medium',
      description: 'A multi-service outage occurred. Determine the correct order of the failure cascade from first cause to final effect.',
      findings: [
        { text: '[10:05:00] DNS resolver: cache expired for payments.internal.svc', severity: 'warning' },
        { text: '[10:05:01] payment-service: DNS lookup failed for database host', severity: 'critical' },
        { text: '[10:05:03] order-service: payment processing timeout after 3s', severity: 'critical' },
        { text: '[10:05:05] frontend: 504 Gateway Timeout on /checkout', severity: 'critical' },
        { text: '[10:05:06] monitoring: PagerDuty alert fired - checkout failure rate > 50%', severity: 'critical' }
      ],
      question: 'What is the correct cascade order from root cause to final symptom?',
      options: [
        'Frontend → Order Service → Payment → DNS → Monitor',
        'DNS cache expired → Payment DNS failure → Order timeout → Frontend 504 → PagerDuty alert',
        'Payment Service → DNS → Order → Frontend → Monitor',
        'PagerDuty → Frontend → Order → Payment → DNS',
        'Order Service → Payment → Frontend → DNS → Monitor'
      ],
      correct_answer: 1,
      hints: [
        'Root cause is always the earliest event in the chain',
        'Each service depends on the one before it responding',
        'DNS is the foundational service here'
      ],
      points: 20,
      time_limit_seconds: 150
    },
    {
      id: 6,
      title: 'Estimate time to resolve',
      difficulty: 'medium',
      description: 'Based on the incident characteristics and findings, estimate the most realistic time to resolve this issue.',
      findings: [
        { text: '[CRITICAL] kubernetes: Pod app-server-7f8b9 CrashLoopBackOff - restarted 8 times', severity: 'critical' },
        { text: '[ERROR] app-server: ENOMEM - JavaScript heap out of memory', severity: 'critical' },
        { text: '[INFO] kubernetes: Node memory: 14.8GB / 16GB (92.5% used)', severity: 'warning' },
        { text: '[INFO] kubernetes: HPA current replicas: 12 (max: 12) - cannot scale further', severity: 'warning' },
        { text: '[INFO] deploy-history: Last change was 3 days ago. No recent deployments.', severity: 'info' },
        { text: '[INFO] traffic: Request volume 340% above normal (viral social media post)', severity: 'info' }
      ],
      question: 'What is the most realistic resolution path and time estimate?',
      options: [
        '5 minutes - just restart the pods',
        '15-30 minutes - increase HPA max replicas and node pool size',
        '1-2 hours - requires code optimization to reduce memory usage',
        '4-8 hours - need to redesign the architecture',
        '24+ hours - fundamental infrastructure replacement needed'
      ],
      correct_answer: 1,
      hints: [
        'The root cause is traffic spike, not a code bug (no recent deploys)',
        'HPA is maxed out - it needs more capacity, not code fixes',
        'Increasing node pool and HPA limits is an infrastructure config change'
      ],
      points: 20,
      time_limit_seconds: 180
    },
    {
      id: 7,
      title: 'Write the customer communication',
      difficulty: 'medium',
      description: 'The incident is confirmed. Choose the best customer-facing status update for this ongoing issue.',
      findings: [
        { text: 'Incident: Payment processing failures affecting ~30% of checkout attempts', severity: 'critical' },
        { text: 'Root cause: Third-party payment gateway experiencing degraded performance', severity: 'critical' },
        { text: 'Impact: Users see "Payment failed" error. No data loss. Retrying works ~70% of the time.', severity: 'warning' },
        { text: 'Mitigation: Engineering team has enabled automatic retry logic and alerted the gateway provider', severity: 'info' },
        { text: 'ETA: Gateway provider acknowledged and working on fix. No ETA from them yet.', severity: 'info' }
      ],
      question: 'Which customer communication is most appropriate?',
      options: [
        '"Everything is fine, no issues detected."',
        '"CRITICAL: Our payment system is completely broken. We don\'t know when it will be fixed."',
        '"We are investigating reports of intermittent payment failures affecting some users. Payments may require a retry. Our team is actively working with our payment provider to resolve this. We will update within 30 minutes."',
        '"Due to our vendor\'s incompetence, payments are failing. We recommend using a different platform until this is resolved."',
        '"Some users may experience a brief delay in payment processing. No action needed."'
      ],
      correct_answer: 2,
      hints: [
        'Good status updates acknowledge the issue without causing panic',
        'Never blame vendors publicly or say "everything is fine" when it isn\'t',
        'Include: what\'s happening, impact, what you\'re doing, when the next update is'
      ],
      points: 20,
      time_limit_seconds: 150
    },
    {
      id: 8,
      title: 'Full RCA from 8 findings',
      difficulty: 'hard',
      description: 'Perform a full Root Cause Analysis. You have 8 findings from a major production outage that lasted 2 hours. Identify the true root cause.',
      findings: [
        { text: '[02:00] cron: Certificate renewal job started (Let\'s Encrypt)', severity: 'info' },
        { text: '[02:01] cron: Certificate renewed successfully for *.api.company.com', severity: 'info' },
        { text: '[02:01] nginx: Received SIGHUP - reloading configuration', severity: 'info' },
        { text: '[02:01] nginx: [emerg] SSL_CTX_use_certificate: error:0B080074 - wrong certificate chain order', severity: 'critical' },
        { text: '[02:01] nginx: configuration reload failed, keeping previous config... but TLS terminated', severity: 'critical' },
        { text: '[02:02] monitoring: HTTPS health checks failing for all API endpoints', severity: 'critical' },
        { text: '[02:03] clients: Connection reset errors across all mobile and web clients', severity: 'critical' },
        { text: '[04:15] on-call: Engineer manually fixed cert chain and reloaded nginx', severity: 'info' }
      ],
      question: 'What is the root cause of this 2-hour outage?',
      options: [
        'Let\'s Encrypt issued an invalid certificate',
        'The certificate renewal cron job produced a cert with incorrect chain order, causing nginx TLS termination failure',
        'nginx has a bug in its reload mechanism',
        'The monitoring system failed to detect the issue quickly enough',
        'The on-call engineer took too long to respond'
      ],
      correct_answer: 1,
      hints: [
        'Root cause is the FIRST thing that went wrong in the chain, not the symptoms',
        'The cert renewed "successfully" but with wrong chain order',
        'The cron job didn\'t validate the certificate chain before deploying it'
      ],
      points: 30,
      time_limit_seconds: 240
    },
    {
      id: 9,
      title: 'Identify the MISLEADING pattern',
      difficulty: 'hard',
      description: 'Not everything that looks like a problem IS a problem. One of these findings is actively misleading investigators. Find the RED HERRING.',
      findings: [
        { text: '[ERROR] app: Request latency p99 = 4200ms (threshold: 1000ms)', severity: 'critical' },
        { text: '[WARNING] db: Replication lag = 45 seconds on read replica', severity: 'warning' },
        { text: '[ERROR] app: Connection refused to cache-server:6379', severity: 'critical' },
        { text: '[INFO] cron: Nightly analytics aggregation job running (expected: high DB load for 20min/night)', severity: 'info' },
        { text: '[WARNING] kernel: TCP retransmits increased 300% in last 5 minutes', severity: 'warning' },
        { text: '[ERROR] cache: Redis process OOM-killed at 03:42:01', severity: 'critical' }
      ],
      question: 'Which finding is the MISLEADING red herring that could waste investigation time?',
      options: [
        'High request latency (p99 = 4200ms)',
        'Database replication lag (45s)',
        'Nightly analytics job causing high DB load',
        'TCP retransmits increased 300%',
        'Redis OOM-killed'
      ],
      correct_answer: 2,
      hints: [
        'Read the INFO entry carefully - what does it say about expected behavior?',
        'The analytics job runs nightly and is EXPECTED to cause high DB load',
        'The real issue chain is: Redis killed → cache miss → DB overload → latency'
      ],
      points: 30,
      time_limit_seconds: 200
    },
    {
      id: 10,
      title: 'Triage 3 tickets by priority',
      difficulty: 'hard',
      description: 'You are the on-call engineer. Three tickets came in simultaneously. Rank them from HIGHEST to LOWEST priority.',
      findings: [
        { text: 'TICKET-A: "Login page returns 500 for all users globally. Revenue impact: $50K/hour."', severity: 'critical' },
        { text: 'TICKET-A detail: Started 2 minutes ago. Auth service pod crash.', severity: 'critical' },
        { text: 'TICKET-B: "Batch job failed - monthly financial report not generated. Due to CFO in 6 hours."', severity: 'warning' },
        { text: 'TICKET-B detail: Can be re-run manually. Data is not lost.', severity: 'info' },
        { text: 'TICKET-C: "Staging environment database corrupted after migration test."', severity: 'warning' },
        { text: 'TICKET-C detail: Blocks QA testing for tomorrow\'s release. No prod impact.', severity: 'info' }
      ],
      question: 'What is the correct priority order from HIGHEST to LOWEST?',
      options: [
        'B → A → C (CFO deadline is most important)',
        'A → B → C (Revenue impact first, then deadline, then staging)',
        'C → A → B (Staging blocks release which could cause future outages)',
        'A → C → B (Prod first, then release blocker, then report)',
        'All equal priority - work them in parallel'
      ],
      correct_answer: 1,
      hints: [
        'Production revenue-impacting issues ALWAYS take top priority',
        'Ticket B has a 6-hour window and can be re-run - it\'s not urgent',
        'Staging has zero customer impact but time-sensitivity for the release'
      ],
      points: 30,
      time_limit_seconds: 180
    }
  ];


  // ═══════════════════════════════════════════════════════════════
  // RANK SYSTEM
  // ═══════════════════════════════════════════════════════════════
  const RANKS = [
    { name: 'Novice', minPoints: 0, icon: '🌱' },
    { name: 'Engineer', minPoints: 50, icon: '⚙️' },
    { name: 'Senior', minPoints: 120, icon: '🔧' },
    { name: 'Expert', minPoints: 200, icon: '🏆' },
    { name: 'Master', minPoints: 300, icon: '👑' }
  ];

  const STORAGE_KEY = 'logsherlock_training';
  const LEADERBOARD_KEY = 'logsherlock_leaderboard';

  // ═══════════════════════════════════════════════════════════════
  // STATE & STORAGE
  // ═══════════════════════════════════════════════════════════════
  let state = {
    currentView: 'menu', // menu | challenge | result
    currentChallenge: null,
    timer: null,
    timeRemaining: 0,
    hintsUsed: 0,
    selectedAnswer: null,
    overlayEl: null
  };

  function loadProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { completed: {}, totalPoints: 0, playerName: 'Engineer' };
    } catch (e) {
      return { completed: {}, totalPoints: 0, playerName: 'Engineer' };
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* silent fail */ }
  }

  function loadLeaderboard() {
    try {
      const data = localStorage.getItem(LEADERBOARD_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLeaderboard(board) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    } catch (e) { /* silent fail */ }
  }

  function getRank(points) {
    let rank = RANKS[0];
    for (const r of RANKS) {
      if (points >= r.minPoints) rank = r;
    }
    return rank;
  }

  function getStars(timeUsed, timeLimit, hintsUsed) {
    const timeRatio = timeUsed / timeLimit;
    let stars = 3;
    if (hintsUsed >= 2) stars = Math.min(stars, 1);
    else if (hintsUsed === 1) stars = Math.min(stars, 2);
    if (timeRatio > 0.8) stars = Math.min(stars, 1);
    else if (timeRatio > 0.5) stars = Math.min(stars, 2);
    return stars;
  }

  function renderStars(count, animate = false) {
    let html = '';
    for (let i = 0; i < 3; i++) {
      if (i < count) {
        html += `<span class="${animate ? 'training-star-anim' : ''}" style="${animate ? `animation-delay: ${i * 0.2}s` : ''}">★</span>`;
      } else {
        html += `<span class="empty">★</span>`;
      }
    }
    return html;
  }

  function calculateTimeBonus(timeRemaining, timeLimit) {
    const ratio = timeRemaining / timeLimit;
    return Math.floor(ratio * 10); // up to 10 bonus points
  }

  // ═══════════════════════════════════════════════════════════════
  // INJECT STYLES
  // ═══════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('training-mode-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'training-mode-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: MAIN MENU
  // ═══════════════════════════════════════════════════════════════
  function renderMenu() {
    const progress = loadProgress();
    const rank = getRank(progress.totalPoints);
    const nextRank = RANKS[RANKS.indexOf(rank) + 1];
    const completedCount = Object.keys(progress.completed).length;
    const progressPercent = nextRank
      ? Math.min(100, ((progress.totalPoints - rank.minPoints) / (nextRank.minPoints - rank.minPoints)) * 100)
      : 100;

    let challengeListHTML = CHALLENGES.map((ch, idx) => {
      const done = progress.completed[ch.id];
      const isLocked = idx > 0 && !progress.completed[CHALLENGES[idx - 1].id] && !done;
      const stars = done ? renderStars(done.stars) : renderStars(0);
      const diffClass = `training-difficulty-${ch.difficulty}`;
      const cardClass = done ? 'completed' : (isLocked ? 'locked' : '');

      return `
        <div class="training-challenge-card ${cardClass}" data-challenge-id="${ch.id}" ${isLocked ? '' : `onclick="window._trainingStartChallenge(${ch.id})"`}>
          <span class="training-difficulty ${diffClass}">${ch.difficulty}</span>
          <div style="flex:1">
            <div style="font-weight:600; color:#fff">${idx + 1}. ${ch.title}</div>
            <div style="font-size:0.8rem; color:#888; margin-top:4px">${ch.points} pts · ${ch.time_limit_seconds}s</div>
          </div>
          <div class="training-stars">${stars}</div>
          ${isLocked ? '<span style="color:#666">🔒</span>' : (done ? '<span style="color:#4caf50">✓</span>' : '<span style="color:#ffd700">→</span>')}
        </div>
      `;
    }).join('');

    return `
      <div class="training-modal" style="position:relative">
        <button class="training-btn-close" onclick="window._trainingClose()">✕</button>
        <div class="training-header">
          <h2>🎯 Training Mode</h2>
          <p>Master log analysis through hands-on challenges</p>
        </div>

        <div class="training-tab-bar">
          <button class="training-tab active" onclick="window._trainingShowTab('challenges')">Challenges</button>
          <button class="training-tab" onclick="window._trainingShowTab('leaderboard')">Leaderboard</button>
        </div>

        <div id="training-tab-challenges">
          <div class="training-profile">
            <div class="training-profile-header">
              <div class="training-profile-avatar">${rank.icon}</div>
              <div>
                <div class="training-rank">${rank.name}</div>
                <div style="color:#aaa; font-size:0.85rem">${progress.totalPoints} points · ${completedCount}/10 challenges</div>
              </div>
            </div>
            <div class="training-progress-bar">
              <div class="training-progress-fill" style="width:${progressPercent}%"></div>
            </div>
            <div style="font-size:0.75rem; color:#666; margin-top:4px; text-align:right">
              ${nextRank ? `${nextRank.minPoints - progress.totalPoints} pts to ${nextRank.name}` : 'Max rank achieved! 🎉'}
            </div>
          </div>

          <div class="training-challenge-list">
            ${challengeListHTML}
          </div>
        </div>

        <div id="training-tab-leaderboard" style="display:none">
          ${renderLeaderboard()}
        </div>
      </div>
    `;
  }

  function renderLeaderboard() {
    const board = loadLeaderboard();
    if (board.length === 0) {
      return '<div style="text-align:center; color:#666; padding:40px">No entries yet. Complete challenges to appear here!</div>';
    }
    const rows = board.sort((a, b) => b.points - a.points).slice(0, 10).map((entry, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
      return `
        <div class="training-leaderboard-row">
          <span>${medal} ${entry.name}</span>
          <span style="color:#ffd700; font-weight:600">${entry.points} pts</span>
        </div>
      `;
    }).join('');
    return `<div class="training-leaderboard">${rows}</div>`;
  }


  // ═══════════════════════════════════════════════════════════════
  // RENDER: CHALLENGE VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChallenge(challenge) {
    const findingsHTML = challenge.findings.map(f => {
      const sevClass = f.severity === 'critical' ? 'severity-critical' : f.severity === 'warning' ? 'severity-warning' : 'severity-info';
      return `<div class="log-line ${sevClass}">${escapeHtml(f.text)}</div>`;
    }).join('');

    const optionsHTML = challenge.options.map((opt, idx) => {
      return `<button class="training-option" data-idx="${idx}" onclick="window._trainingSelectAnswer(${idx})">${String.fromCharCode(65 + idx)}. ${escapeHtml(opt)}</button>`;
    }).join('');

    return `
      <div class="training-modal" style="position:relative">
        <button class="training-btn-close" onclick="window._trainingClose()">✕</button>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
          <span class="training-difficulty training-difficulty-${challenge.difficulty}">${challenge.difficulty}</span>
          <span style="color:#888; font-size:0.85rem">${challenge.points} points</span>
        </div>

        <h3 style="color:#fff; margin:0 0 8px; font-size:1.3rem">${escapeHtml(challenge.title)}</h3>
        <p style="color:#aaa; margin:0 0 16px; font-size:0.9rem">${escapeHtml(challenge.description)}</p>

        <div id="training-timer" class="training-timer normal">${formatTime(state.timeRemaining)}</div>

        <div class="training-findings">${findingsHTML}</div>

        <h4 style="color:#ffd700; margin:16px 0 8px">❓ ${escapeHtml(challenge.question)}</h4>

        <div class="training-options" id="training-options">
          ${optionsHTML}
        </div>

        <div style="display:flex; gap:12px; align-items:center; margin-top:16px; flex-wrap:wrap">
          <button class="training-btn" id="training-submit-btn" onclick="window._trainingSubmit()" disabled style="opacity:0.5">
            Submit Answer
          </button>
          <button class="training-hint-btn" onclick="window._trainingUseHint()">
            💡 Use Hint (${challenge.hints.length - state.hintsUsed} remaining)
          </button>
          <button class="training-btn-secondary" onclick="window._trainingBackToMenu()">← Back</button>
        </div>

        <div id="training-hints-area" style="margin-top:12px"></div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: RESULT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderResult(isCorrect, challenge, timeUsed, hintsUsed) {
    const stars = isCorrect ? getStars(timeUsed, challenge.time_limit_seconds, hintsUsed) : 0;
    const timeBonus = isCorrect ? calculateTimeBonus(state.timeRemaining, challenge.time_limit_seconds) : 0;
    const totalEarned = isCorrect ? challenge.points + timeBonus : 0;

    return `
      <div class="training-modal" style="position:relative">
        <div class="training-result">
          <div class="training-result-icon">${isCorrect ? '🎉' : '❌'}</div>
          <h3 class="${isCorrect ? 'correct-text' : 'wrong-text'}">
            ${isCorrect ? 'Correct!' : 'Incorrect'}
          </h3>
          ${isCorrect ? `
            <div class="training-stars" style="font-size:2rem; margin:16px 0">${renderStars(stars, true)}</div>
            <div style="color:#aaa; margin:8px 0">
              <div>Challenge Points: <strong style="color:#ffd700">+${challenge.points}</strong></div>
              <div>Time Bonus: <strong style="color:#69f0ae">+${timeBonus}</strong></div>
              <div style="font-size:1.2rem; margin-top:8px; color:#fff">Total: <strong style="color:#ffd700">${totalEarned}</strong></div>
            </div>
          ` : `
            <p style="color:#aaa; margin:16px 0">The correct answer was:</p>
            <div style="background:#1b5e20; border:1px solid #4caf50; border-radius:8px; padding:12px; color:#a5d6a7; text-align:left">
              ${String.fromCharCode(65 + challenge.correct_answer)}. ${escapeHtml(challenge.options[challenge.correct_answer])}
            </div>
          `}
          <div style="display:flex; gap:12px; justify-content:center; margin-top:24px; flex-wrap:wrap">
            ${!isCorrect ? `<button class="training-btn" onclick="window._trainingStartChallenge(${challenge.id})">🔄 Retry</button>` : ''}
            <button class="training-btn-secondary" onclick="window._trainingBackToMenu()">← Back to Challenges</button>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // TIMER
  // ═══════════════════════════════════════════════════════════════
  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      state.timeRemaining--;
      const timerEl = document.getElementById('training-timer');
      if (timerEl) {
        timerEl.textContent = formatTime(state.timeRemaining);
        timerEl.className = state.timeRemaining <= 30 ? 'training-timer warning' : 'training-timer normal';
      }
      if (state.timeRemaining <= 0) {
        clearInterval(state.timer);
        handleTimeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function handleTimeUp() {
    const challenge = state.currentChallenge;
    const timeUsed = challenge.time_limit_seconds;
    showResult(false, challenge, timeUsed, state.hintsUsed);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════
  function openOverlay(html) {
    closeOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'training-overlay';
    overlay.id = 'training-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    state.overlayEl = overlay;
    // Close on clicking outside modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  function closeOverlay() {
    stopTimer();
    const el = document.getElementById('training-overlay');
    if (el) el.remove();
    state.overlayEl = null;
    state.currentChallenge = null;
    state.selectedAnswer = null;
    state.hintsUsed = 0;
  }

  function showMenu() {
    state.currentView = 'menu';
    openOverlay(renderMenu());
  }

  function showChallenge(challengeId) {
    const challenge = CHALLENGES.find(c => c.id === challengeId);
    if (!challenge) return;
    state.currentView = 'challenge';
    state.currentChallenge = challenge;
    state.timeRemaining = challenge.time_limit_seconds;
    state.hintsUsed = 0;
    state.selectedAnswer = null;
    openOverlay(renderChallenge(challenge));
    startTimer();
  }

  function showResult(isCorrect, challenge, timeUsed, hintsUsed) {
    stopTimer();
    state.currentView = 'result';

    if (isCorrect) {
      const stars = getStars(timeUsed, challenge.time_limit_seconds, hintsUsed);
      const timeBonus = calculateTimeBonus(state.timeRemaining, challenge.time_limit_seconds);
      const totalEarned = challenge.points + timeBonus;
      const progress = loadProgress();

      // Only update if better score
      if (!progress.completed[challenge.id] || progress.completed[challenge.id].stars < stars) {
        const prevPoints = progress.completed[challenge.id] ? progress.completed[challenge.id].earned : 0;
        progress.completed[challenge.id] = { stars, earned: totalEarned, time: timeUsed };
        progress.totalPoints = progress.totalPoints - prevPoints + totalEarned;
        saveProgress(progress);
      }

      // Update leaderboard
      const board = loadLeaderboard();
      const existing = board.find(e => e.name === progress.playerName);
      if (existing) {
        existing.points = progress.totalPoints;
      } else {
        board.push({ name: progress.playerName, points: progress.totalPoints });
      }
      saveLeaderboard(board);
    }

    openOverlay(renderResult(isCorrect, challenge, timeUsed, hintsUsed));
  }


  // ═══════════════════════════════════════════════════════════════
  // WINDOW-LEVEL ACTION HANDLERS (used by onclick in rendered HTML)
  // ═══════════════════════════════════════════════════════════════
  window._trainingClose = closeOverlay;
  window._trainingBackToMenu = showMenu;
  window._trainingStartChallenge = showChallenge;

  window._trainingSelectAnswer = function (idx) {
    state.selectedAnswer = idx;
    const options = document.querySelectorAll('#training-options .training-option');
    options.forEach((el, i) => {
      el.classList.toggle('selected', i === idx);
    });
    const submitBtn = document.getElementById('training-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  };

  window._trainingSubmit = function () {
    if (state.selectedAnswer === null || !state.currentChallenge) return;
    stopTimer();

    const challenge = state.currentChallenge;
    const isCorrect = state.selectedAnswer === challenge.correct_answer;
    const timeUsed = challenge.time_limit_seconds - state.timeRemaining;

    // Animate answer
    const options = document.querySelectorAll('#training-options .training-option');
    options.forEach((el, i) => {
      el.style.pointerEvents = 'none';
      if (i === challenge.correct_answer) {
        el.classList.add('correct');
      } else if (i === state.selectedAnswer && !isCorrect) {
        el.classList.add('wrong');
      }
    });

    // Delay to show animation, then show result
    setTimeout(() => {
      showResult(isCorrect, challenge, timeUsed, state.hintsUsed);
    }, 1200);
  };

  window._trainingUseHint = function () {
    if (!state.currentChallenge) return;
    const challenge = state.currentChallenge;
    if (state.hintsUsed >= challenge.hints.length) return;

    state.hintsUsed++;
    const hintsArea = document.getElementById('training-hints-area');
    if (hintsArea) {
      const hintText = challenge.hints[state.hintsUsed - 1];
      const hintBox = document.createElement('div');
      hintBox.className = 'training-hint-box';
      hintBox.textContent = `💡 Hint ${state.hintsUsed}: ${hintText}`;
      hintsArea.appendChild(hintBox);
    }

    // Update hint button
    const hintBtn = document.querySelector('.training-hint-btn');
    if (hintBtn) {
      const remaining = challenge.hints.length - state.hintsUsed;
      if (remaining <= 0) {
        hintBtn.disabled = true;
        hintBtn.textContent = '💡 No hints remaining';
        hintBtn.style.opacity = '0.5';
      } else {
        hintBtn.textContent = `💡 Use Hint (${remaining} remaining)`;
      }
    }
  };

  window._trainingShowTab = function (tab) {
    const challengesTab = document.getElementById('training-tab-challenges');
    const leaderboardTab = document.getElementById('training-tab-leaderboard');
    const tabs = document.querySelectorAll('.training-tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'challenges') {
      if (challengesTab) challengesTab.style.display = 'block';
      if (leaderboardTab) leaderboardTab.style.display = 'none';
      tabs[0] && tabs[0].classList.add('active');
    } else {
      if (challengesTab) challengesTab.style.display = 'none';
      if (leaderboardTab) {
        leaderboardTab.style.display = 'block';
        leaderboardTab.innerHTML = renderLeaderboard();
      }
      tabs[1] && tabs[1].classList.add('active');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORTED API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns HTML string for the "Start Training" button.
   */
  function renderTrainingButton() {
    return `<button class="training-btn" onclick="window._trainingOpen()" title="Open Training Mode">
      🎯 Start Training
    </button>`;
  }

  /**
   * Opens the training mode modal.
   */
  function startTraining() {
    injectStyles();
    showMenu();
  }

  /**
   * Returns the user's training progress/stats.
   */
  function getTrainingStats() {
    const progress = loadProgress();
    const rank = getRank(progress.totalPoints);
    const completedCount = Object.keys(progress.completed).length;
    const totalStars = Object.values(progress.completed).reduce((sum, c) => sum + (c.stars || 0), 0);
    return {
      totalPoints: progress.totalPoints,
      rank: rank.name,
      rankIcon: rank.icon,
      challengesCompleted: completedCount,
      totalChallenges: CHALLENGES.length,
      totalStars: totalStars,
      maxStars: CHALLENGES.length * 3,
      completed: progress.completed,
      playerName: progress.playerName
    };
  }

  // Global open handler (used by rendered button)
  window._trainingOpen = startTraining;

  // ═══════════════════════════════════════════════════════════════
  // EXPORTS (UMD-style)
  // ═══════════════════════════════════════════════════════════════
  const TrainingMode = { renderTrainingButton, startTraining, getTrainingStats };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrainingMode;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return TrainingMode; });
  } else {
    window.TrainingMode = TrainingMode;
  }

  // ═══════════════════════════════════════════════════════════════
  // SELF-INITIALIZE ON DOMContentLoaded
  // ═══════════════════════════════════════════════════════════════
  function autoInit() {
    injectStyles();
    // Auto-inject button if a placeholder exists
    const placeholder = document.getElementById('training-mode-placeholder');
    if (placeholder) {
      placeholder.innerHTML = renderTrainingButton();
    }
    console.log('[LogSherlock] Training Mode loaded. Use TrainingMode.startTraining() to begin.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})();
