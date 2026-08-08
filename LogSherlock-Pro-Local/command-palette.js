/**
 * LogSherlock Pro — Command Palette (Ctrl+K)
 * VS Code style command palette for instant navigation to any feature.
 * Standalone IIFE — no dependencies required.
 */
(function() {
    if (typeof window.LogSherlockCommandPalette !== 'undefined') return;
    window.LogSherlockCommandPalette = true;

    // ─── Helper ───────────────────────────────────────────────────────────────
    function scrollToPanel(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ─── Commands Registry ────────────────────────────────────────────────────
    const COMMANDS = [
        { name: 'Scan Logs', shortcut: 'Drop files', action: () => document.getElementById('dropZone')?.click() },
        { name: 'Root Cause Chain', icon: '⛓️', action: () => scrollToPanel('rootCauseChainPanel') },
        { name: 'Compliance Export', icon: '📋', action: () => scrollToPanel('complianceExportPanel') },
        { name: 'Shift Handoff', icon: '🔄', action: () => scrollToPanel('shiftHandoffPanel') },
        { name: 'Runbook Executor', icon: '📖', action: () => scrollToPanel('runbookExecutorPanel') },
        { name: 'Log Diff Analyzer', icon: '🔀', action: () => scrollToPanel('logDiffPanel') },
        { name: 'Blast Radius', icon: '💥', action: () => scrollToPanel('blastRadiusPanel') },
        { name: 'Executive Summary', icon: '📄', action: () => scrollToPanel('executiveSummaryPanel') },
        { name: 'Pattern Confidence', icon: '🎯', action: () => scrollToPanel('patternConfidencePanel') },
        { name: 'Knowledge Base', icon: '📚', action: () => scrollToPanel('knowledgeBasePanel') },
        { name: 'Multi-Tenant Workspace', icon: '👥', action: () => scrollToPanel('multiTenantPanel') },
        { name: 'Team Dashboard', icon: '👥', action: () => { if (typeof openTeamDashboard === 'function') openTeamDashboard(); } },
        { name: 'ROI Calculator', icon: '📊', action: () => scrollToPanel('roiPanel') },
        { name: 'Temporal Clusters', icon: '⏰', action: () => scrollToPanel('temporalClusterPanel') },
        { name: 'Pinned Findings', icon: '📌', action: () => scrollToPanel('pinnedPanel') },
        { name: 'Custom Patterns', icon: '✏️', action: () => scrollToPanel('customPatternPanel') },
        { name: 'Noise Suppression', icon: '🔇', action: () => scrollToPanel('noiseSuppressionPanel') },
        { name: 'Session Resume', icon: '💾', action: () => scrollToPanel('sessionPanel') },
        { name: 'Recent Scans', icon: '🕐', action: () => scrollToPanel('recentScansPanel') },
        { name: 'Baseline Subtraction', icon: '📏', action: () => scrollToPanel('baselinePanel') },
        { name: 'Export Snapshot', icon: '📤', action: () => scrollToPanel('snapshotPanel') },
        { name: 'Ticket Advisor', icon: '🎯', action: () => document.querySelector('[data-tab="advisor"]')?.click() },
        { name: 'Copy Jira Report', icon: '📋', action: () => { const btn = document.querySelector('[onclick*="copyJira"]'); if(btn) btn.click(); } },
        { name: 'Toggle Dark/Light Theme', icon: '🌓', action: () => document.body.classList.toggle('light-theme') },
        { name: 'Scroll to Top', icon: '⬆️', action: () => window.scrollTo({top:0,behavior:'smooth'}) },
        { name: 'Scroll to Findings', icon: '🔍', action: () => document.getElementById('findingsList')?.scrollIntoView({behavior:'smooth'}) },
    ];

    // ─── State ────────────────────────────────────────────────────────────────
    let overlay = null;
    let input = null;
    let list = null;
    let activeIndex = 0;
    let filtered = [...COMMANDS];

    // ─── Styles ───────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('cmd-palette-styles')) return;
        const style = document.createElement('style');
        style.id = 'cmd-palette-styles';
        style.textContent = `
            .cmd-palette-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                z-index: 99999;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 15vh;
                animation: cmdFadeIn 0.15s ease;
            }
            @keyframes cmdFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .cmd-palette-modal {
                width: 500px;
                max-width: 90vw;
                background: #1e1e2e;
                border: 1px solid #01a982;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(1, 169, 130, 0.1);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-height: 60vh;
                animation: cmdSlideIn 0.15s ease;
            }
            @keyframes cmdSlideIn {
                from { transform: translateY(-10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .cmd-palette-input-wrap {
                padding: 16px;
                border-bottom: 1px solid #2a2a3e;
            }
            .cmd-palette-input {
                width: 100%;
                background: #2a2a3e;
                border: 1px solid #3a3a5e;
                border-radius: 8px;
                padding: 12px 16px;
                font-size: 15px;
                color: #e0e0e0;
                outline: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }
            .cmd-palette-input:focus {
                border-color: #01a982;
            }
            .cmd-palette-input::placeholder {
                color: #666;
            }
            .cmd-palette-list {
                overflow-y: auto;
                flex: 1;
                padding: 8px;
            }
            .cmd-palette-list::-webkit-scrollbar {
                width: 6px;
            }
            .cmd-palette-list::-webkit-scrollbar-track {
                background: transparent;
            }
            .cmd-palette-list::-webkit-scrollbar-thumb {
                background: #3a3a5e;
                border-radius: 3px;
            }
            .cmd-palette-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.1s;
                color: #ccc;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .cmd-palette-item:hover,
            .cmd-palette-item.active {
                background: rgba(1, 169, 130, 0.15);
                color: #fff;
            }
            .cmd-palette-item.active {
                border-left: 3px solid #01a982;
            }
            .cmd-palette-item-icon {
                font-size: 18px;
                width: 24px;
                text-align: center;
                flex-shrink: 0;
            }
            .cmd-palette-item-name {
                flex: 1;
            }
            .cmd-palette-item-shortcut {
                font-size: 11px;
                color: #666;
                background: #2a2a3e;
                padding: 2px 8px;
                border-radius: 4px;
            }
            .cmd-palette-hint {
                padding: 10px 16px;
                border-top: 1px solid #2a2a3e;
                font-size: 11px;
                color: #555;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .cmd-palette-empty {
                padding: 24px;
                text-align: center;
                color: #555;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Fuzzy Match ──────────────────────────────────────────────────────────
    function fuzzyMatch(query, text) {
        const q = query.toLowerCase();
        const t = text.toLowerCase();
        if (!q) return true;
        let qi = 0;
        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
            if (t[ti] === q[qi]) qi++;
        }
        return qi === q.length;
    }

    // ─── Render List ──────────────────────────────────────────────────────────
    function renderList() {
        if (!list) return;
        list.innerHTML = '';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'cmd-palette-empty';
            empty.textContent = 'No matching commands';
            list.appendChild(empty);
            return;
        }

        filtered.forEach((cmd, i) => {
            const item = document.createElement('div');
            item.className = 'cmd-palette-item' + (i === activeIndex ? ' active' : '');
            item.setAttribute('data-index', i);

            const icon = document.createElement('span');
            icon.className = 'cmd-palette-item-icon';
            icon.textContent = cmd.icon || '▸';
            item.appendChild(icon);

            const name = document.createElement('span');
            name.className = 'cmd-palette-item-name';
            name.textContent = cmd.name;
            item.appendChild(name);

            if (cmd.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'cmd-palette-item-shortcut';
                shortcut.textContent = cmd.shortcut;
                item.appendChild(shortcut);
            }

            item.addEventListener('click', () => executeCommand(i));
            item.addEventListener('mouseenter', () => {
                activeIndex = i;
                updateActive();
            });

            list.appendChild(item);
        });
    }

    // ─── Update Active Highlight ──────────────────────────────────────────────
    function updateActive() {
        if (!list) return;
        const items = list.querySelectorAll('.cmd-palette-item');
        items.forEach((el, i) => {
            el.classList.toggle('active', i === activeIndex);
        });
        // Scroll active into view
        const activeEl = list.querySelector('.cmd-palette-item.active');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }

    // ─── Execute Command ──────────────────────────────────────────────────────
    function executeCommand(index) {
        const cmd = filtered[index];
        if (cmd && typeof cmd.action === 'function') {
            closePalette();
            // Slight delay to let palette close animation complete
            setTimeout(() => {
                try {
                    cmd.action();
                } catch (e) {
                    console.warn('[CommandPalette] Error executing:', cmd.name, e);
                }
            }, 50);
        }
    }

    // ─── Open Palette ─────────────────────────────────────────────────────────
    function openPalette() {
        if (overlay) return;
        injectStyles();

        // Create overlay
        overlay = document.createElement('div');
        overlay.className = 'cmd-palette-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePalette();
        });

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'cmd-palette-modal';

        // Input wrapper
        const inputWrap = document.createElement('div');
        inputWrap.className = 'cmd-palette-input-wrap';

        input = document.createElement('input');
        input.className = 'cmd-palette-input';
        input.type = 'text';
        input.placeholder = 'Type a command...';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');

        input.addEventListener('input', () => {
            const query = input.value.trim();
            filtered = COMMANDS.filter(cmd => fuzzyMatch(query, cmd.name));
            activeIndex = 0;
            renderList();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
                updateActive();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                updateActive();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0) {
                    executeCommand(activeIndex);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePalette();
            }
        });

        inputWrap.appendChild(input);
        modal.appendChild(inputWrap);

        // List
        list = document.createElement('div');
        list.className = 'cmd-palette-list';
        modal.appendChild(list);

        // Hint
        const hint = document.createElement('div');
        hint.className = 'cmd-palette-hint';
        hint.textContent = 'Ctrl+K to open • ↑↓ navigate • Enter select • Esc close';
        modal.appendChild(hint);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Reset state
        filtered = [...COMMANDS];
        activeIndex = 0;
        renderList();

        // Focus input
        requestAnimationFrame(() => input.focus());
    }

    // ─── Close Palette ────────────────────────────────────────────────────────
    function closePalette() {
        if (overlay) {
            overlay.remove();
            overlay = null;
            input = null;
            list = null;
        }
    }

    // ─── Toggle Palette ───────────────────────────────────────────────────────
    function togglePalette() {
        if (overlay) {
            closePalette();
        } else {
            openPalette();
        }
    }

    // ─── Keyboard Listener ────────────────────────────────────────────────────
    function registerShortcut() {
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;
            if (modifier && e.key === 'k') {
                e.preventDefault();
                e.stopPropagation();
                togglePalette();
            }
        });
    }

    // ─── Initialize ───────────────────────────────────────────────────────────
    function init() {
        registerShortcut();
        console.log('[LogSherlock] Command Palette ready (Ctrl+K)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    window.openCommandPalette = openPalette;

})();
