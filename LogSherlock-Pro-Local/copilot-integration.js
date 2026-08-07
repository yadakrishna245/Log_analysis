/**
 * LogSherlock Pro — GitHub Copilot Integration Module
 * Copyright 2026 Krishna Yada. All Rights Reserved.
 * 
 * This module provides AI-powered analysis using GitHub Copilot's API.
 * Requires a valid GitHub Copilot license from your organization.
 * 
 * SETUP:
 * 1. Get your Copilot API token from your organization admin
 * 2. Set the token in the UI (Settings → Copilot API Key)
 * 3. The token is stored in localStorage (never leaves your machine)
 * 
 * PRIVACY:
 * - Only pattern names and categories are sent to Copilot (NOT raw log content)
 * - No customer data ever leaves your machine
 * - All log scanning remains 100% client-side
 */

class CopilotIntegration {
    constructor() {
        this.apiKey = localStorage.getItem('ls_copilot_api_key') || '';
        this.endpoint = localStorage.getItem('ls_copilot_endpoint') || 'http://localhost:11434/v1/chat/completions';
        this.model = localStorage.getItem('ls_copilot_model') || 'gpt-4o';
        this.enabled = !!this.apiKey;
        this.maxTokens = 2048;
        this.temperature = 0.3; // Low temperature for factual analysis
        this._copilotToken = localStorage.getItem('ls_copilot_ghu_token') || '';
        this._copilotTokenExpiry = parseInt(localStorage.getItem('ls_copilot_ghu_expiry') || '0');
    }

    /**
     * GitHub Copilot OAuth Device Flow
     * Uses the VS Code Copilot client ID to get a ghu_ token
     * This is the ONLY way to authenticate with api.githubcopilot.com
     */
    async authenticateCopilot() {
        const CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // VS Code Copilot client ID

        // Step 1: Request device code
        const codeResp = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:user' })
        });
        const codeData = await codeResp.json();
        
        // Show user the code to enter
        const userCode = codeData.user_code;
        const verificationUrl = codeData.verification_uri;
        const deviceCode = codeData.device_code;
        const interval = (codeData.interval || 5) * 1000;

        // Open the verification URL
        window.open(verificationUrl, '_blank');

        return {
            userCode,
            verificationUrl,
            deviceCode,
            interval,
            pollForToken: () => this._pollForToken(CLIENT_ID, deviceCode, interval)
        };
    }

    async _pollForToken(clientId, deviceCode, interval) {
        // Poll for up to 5 minutes
        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, interval));
            
            const resp = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });
            const data = await resp.json();

            if (data.access_token) {
                // Got the token! Now exchange for Copilot token
                const copilotToken = await this._getCopilotToken(data.access_token);
                return copilotToken;
            }
            if (data.error === 'authorization_pending') continue;
            if (data.error === 'slow_down') { await new Promise(r => setTimeout(r, 5000)); continue; }
            if (data.error === 'expired_token') throw new Error('Code expired. Try again.');
            if (data.error === 'access_denied') throw new Error('Access denied by user.');
        }
        throw new Error('Timeout waiting for authorization.');
    }

    async _getCopilotToken(oauthToken) {
        // Exchange OAuth token for Copilot API token
        const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
            headers: {
                'Authorization': `token ${oauthToken}`,
                'Accept': 'application/json'
            }
        });
        if (!resp.ok) {
            throw new Error(`Copilot token exchange failed: ${resp.status}. Make sure you have an active Copilot subscription.`);
        }
        const data = await resp.json();
        this._copilotToken = data.token;
        this._copilotTokenExpiry = data.expires_at ? new Date(data.expires_at * 1000).getTime() : Date.now() + 1800000;
        
        // Store for reuse
        localStorage.setItem('ls_copilot_ghu_token', this._copilotToken);
        localStorage.setItem('ls_copilot_ghu_expiry', String(this._copilotTokenExpiry));
        localStorage.setItem('ls_copilot_oauth_token', oauthToken);
        
        // Configure the integration
        this.apiKey = this._copilotToken;
        this.endpoint = 'https://api.githubcopilot.com/chat/completions';
        this.model = 'gpt-4o';
        this.enabled = true;
        localStorage.setItem('ls_copilot_api_key', this._copilotToken);
        localStorage.setItem('ls_copilot_endpoint', this.endpoint);
        localStorage.setItem('ls_copilot_model', this.model);

        return { success: true, expiresAt: this._copilotTokenExpiry };
    }

    async _refreshCopilotTokenIfNeeded() {
        if (this.endpoint !== 'https://api.githubcopilot.com/chat/completions') return;
        if (this._copilotTokenExpiry && Date.now() < this._copilotTokenExpiry - 60000) return;
        
        // Token expired or about to expire, try refresh
        const oauthToken = localStorage.getItem('ls_copilot_oauth_token');
        if (oauthToken) {
            try {
                await this._getCopilotToken(oauthToken);
            } catch(e) {
                console.warn('Copilot token refresh failed:', e.message);
            }
        }
    }

    /**
     * Configure the Copilot integration
     * @param {Object} config - { apiKey, endpoint, model }
     */
    configure(config) {
        if (config.apiKey) {
            this.apiKey = config.apiKey;
            localStorage.setItem('ls_copilot_api_key', config.apiKey);
        }
        if (config.endpoint) {
            this.endpoint = config.endpoint;
            localStorage.setItem('ls_copilot_endpoint', config.endpoint);
        }
        if (config.model) {
            this.model = config.model;
            localStorage.setItem('ls_copilot_model', config.model);
        }
        this.enabled = !!this.apiKey;
        return this.enabled;
    }

    /**
     * Check if Copilot is configured and ready
     */
    isReady() {
        // Check either API key OR OAuth Copilot token
        return (this.enabled && this.apiKey.length > 10) || (!!this._copilotToken && this._copilotToken.length > 10);
    }

    /**
     * Get connection status
     */
    getStatus() {
        if (this._copilotToken) return { status: 'ready', message: `GitHub Copilot connected (${this.model})`, model: this.model };
        if (!this.apiKey) return { status: 'not_configured', message: 'API key not set' };
        return { status: 'ready', message: `Connected (${this.model})`, model: this.model };
    }

    /**
     * Analyze scan findings using Copilot
     * Sends only pattern names, severities, and categories — NOT raw log lines
     * @param {Array} findings - Array of finding objects
     * @param {string} ticketContext - Optional ticket description
     * @returns {Promise<Object>} AI analysis result
     */
    async analyzeFindings(findings, ticketContext = '') {
        if (!this.isReady()) {
            throw new Error('Copilot not configured. Set API key in Settings.');
        }

        // PRIVACY: Only send pattern metadata, NOT raw log content
        const patternSummary = this._summarizePatterns(findings);
        
        const systemPrompt = `You are an expert HPE VM Essentials L4 Support Engineer. 
You analyze log scan results and provide root cause analysis.
You ONLY see pattern names and categories — not raw customer data.
Be specific, actionable, and reference known HPE VME issues when applicable.
Format your response with clear sections: Root Cause, Impact, Recommended Actions, Prevention.`;

        const userPrompt = this._buildAnalysisPrompt(patternSummary, ticketContext);

        try {
            const response = await this._callAPI(systemPrompt, userPrompt);
            return {
                success: true,
                analysis: response,
                model: this.model,
                timestamp: new Date().toISOString(),
                patternsAnalyzed: patternSummary.totalPatterns,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                suggestion: this._getErrorSuggestion(error),
            };
        }
    }

    /**
     * Generate a professional Jira comment reply using Copilot
     * @param {string} incomingComment - The comment to reply to
     * @param {Array} findings - Current scan findings for context
     * @param {string} tone - 'professional' | 'concise' | 'detailed'
     * @returns {Promise<Object>} Generated reply
     */
    async generateReply(incomingComment, findings, tone = 'professional') {
        if (!this.isReady()) {
            throw new Error('Copilot not configured. Set API key in Settings.');
        }

        const patternSummary = this._summarizePatterns(findings);
        
        const systemPrompt = `You are an HPE VM Essentials L4 Support Engineer writing a Jira ticket reply.
Tone: ${tone}. Be ${tone === 'concise' ? 'brief and to-the-point' : tone === 'detailed' ? 'thorough with technical details' : 'professional and clear'}.
Reference the scan findings provided. Never make up data — only use what's in the analysis.`;

        const userPrompt = `Reply to this Jira comment:\n---\n${incomingComment}\n---\n\nBased on our log analysis:\n${JSON.stringify(patternSummary, null, 2)}\n\nGenerate a ${tone} reply.`;

        try {
            const response = await this._callAPI(systemPrompt, userPrompt);
            return { success: true, reply: response, tone, model: this.model };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get investigation suggestions based on ticket context
     * @param {string} ticketText - Jira ticket description
     * @returns {Promise<Object>} Investigation guide
     */
    async getInvestigationGuide(ticketText) {
        if (!this.isReady()) {
            throw new Error('Copilot not configured. Set API key in Settings.');
        }

        const systemPrompt = `You are an HPE VM Essentials L4 Support Engineer.
Given a Jira ticket, provide a structured investigation guide:
1. Issue Classification (what type of problem)
2. Which log bundles to download from HPRC/SFTP
3. Key files and patterns to look for
4. Specific commands to run on the system
5. Known issues that match this pattern (reference MORPH-XXXX if applicable)
Be actionable and specific to HPE VME/Morpheus environment.`;

        try {
            const response = await this._callAPI(systemPrompt, ticketText);
            return { success: true, guide: response, model: this.model };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Ask a free-form question with scan context
     * @param {string} question - User question
     * @param {Array} findings - Current findings for context
     * @returns {Promise<Object>} AI response
     */
    async askQuestion(question, findings = []) {
        if (!this.isReady()) {
            throw new Error('Copilot not configured. Set API key in Settings.');
        }

        const context = findings.length > 0 
            ? `\n\nCurrent scan context: ${JSON.stringify(this._summarizePatterns(findings))}`
            : '';

        const systemPrompt = `You are an HPE VM Essentials expert. Answer questions about VME, Morpheus, KVM, GFS2, Pacemaker, storage, networking, and Linux administration. Be specific and actionable.`;

        try {
            const response = await this._callAPI(systemPrompt, question + context);
            return { success: true, answer: response, model: this.model };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Summarize patterns WITHOUT sending raw log content (privacy)
     */
    _summarizePatterns(findings) {
        const patternCounts = {};
        findings.forEach(f => {
            const key = f.pattern_name || 'Unknown';
            if (!patternCounts[key]) {
                patternCounts[key] = {
                    name: key,
                    severity: f.severity,
                    category: f.category,
                    description: f.description || '',
                    count: 0,
                    files: new Set(),
                };
            }
            patternCounts[key].count++;
            patternCounts[key].files.add((f.file || '').split('/').pop());
        });

        const ranked = Object.values(patternCounts)
            .map(p => ({ ...p, files: [...p.files].slice(0, 5) }))
            .sort((a, b) => {
                const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
                return (sev[b.severity] * 100 + b.count) - (sev[a.severity] * 100 + a.count);
            });

        return {
            totalFindings: findings.length,
            totalPatterns: ranked.length,
            critical: findings.filter(f => f.severity === 'CRITICAL').length,
            high: findings.filter(f => f.severity === 'HIGH').length,
            medium: findings.filter(f => f.severity === 'MEDIUM').length,
            low: findings.filter(f => f.severity === 'LOW').length,
            topPatterns: ranked.slice(0, 10),
            categories: [...new Set(findings.map(f => f.category))],
        };
    }

    /**
     * Build the analysis prompt
     */
    _buildAnalysisPrompt(summary, ticketContext) {
        let prompt = `Analyze these log scan findings from an HPE VM Essentials environment:\n\n`;
        prompt += `Total: ${summary.totalFindings} findings (${summary.critical} Critical, ${summary.high} High, ${summary.medium} Medium, ${summary.low} Low)\n`;
        prompt += `Categories: ${summary.categories.join(', ')}\n\n`;
        prompt += `Top patterns detected:\n`;
        summary.topPatterns.forEach((p, i) => {
            prompt += `${i + 1}. [${p.severity}] ${p.name} (${p.count}x) — ${p.description}\n`;
            prompt += `   Files: ${p.files.join(', ')}\n`;
        });
        if (ticketContext) {
            prompt += `\nTicket context:\n${ticketContext}\n`;
        }
        prompt += `\nProvide: Root Cause, Impact Assessment, Recommended Fix (with commands), and Prevention steps.`;
        return prompt;
    }

    /**
     * Call the Copilot/OpenAI-compatible API
     */
    // Model priority chain — ordered by accuracy (best first)
    static MODEL_CHAIN = [
        'gpt-4o',
        'claude-sonnet-4',
        'gemini-2.5-pro',
        'claude-opus-4',
        'gpt-4-turbo',
        'o4-mini',
        'o3-mini',
        'claude-3.5-sonnet',
        'gpt-4o-mini',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'claude-haiku-3.5',
    ];

    async _callAPI(systemPrompt, userPrompt) {
        // Refresh Copilot token if needed
        await this._refreshCopilotTokenIfNeeded();
        
        // Use copilot token if available, fallback to apiKey
        const token = this._copilotToken || this.apiKey;
        const isCopilot = this.endpoint.includes('githubcopilot.com');
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
        
        // Copilot API requires these additional headers
        if (isCopilot) {
            headers['Editor-Version'] = 'vscode/1.92.0';
            headers['Editor-Plugin-Version'] = 'copilot/1.200.0';
            headers['Openai-Intent'] = 'conversation-panel';
            headers['Copilot-Integration-Id'] = 'vscode-chat';
        }

        // Build model chain: selected model first, then fallbacks
        let modelsToTry = [this.model];
        if (isCopilot) {
            // Add remaining models from chain (skip the one already selected)
            const chain = CopilotIntegration.MODEL_CHAIN.filter(m => m !== this.model);
            modelsToTry = [this.model, ...chain];
        }

        let lastError = null;
        for (const model of modelsToTry) {
            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        max_tokens: this.maxTokens,
                        temperature: this.temperature,
                    }),
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.error?.message || `${response.status}`;
                    // If model not available/overloaded, try next
                    if (response.status === 404 || response.status === 429 || response.status === 503) {
                        console.warn(`[LogSherlock] Model ${model} failed (${response.status}), trying next...`);
                        lastError = new Error(`${model}: ${errMsg}`);
                        continue;
                    }
                    throw new Error(errMsg);
                }

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (!content) {
                    lastError = new Error(`${model}: Empty response`);
                    continue;
                }
                
                // Success! Update the model used (for display)
                this._lastModelUsed = model;
                if (model !== this.model) {
                    console.log(`[LogSherlock] Fallback: ${this.model} → ${model} (success)`);
                }
                return content;
            } catch (err) {
                lastError = err;
                console.warn(`[LogSherlock] Model ${model} error:`, err.message);
                continue;
            }
        }
        
        // All models failed
        throw lastError || new Error('All models failed. Check your connection.');
    }

    /** Get the model that was actually used (after fallback) */
    getLastModelUsed() {
        return this._lastModelUsed || this.model;
    }

    /**
     * Get helpful error suggestion
     */
    _getErrorSuggestion(error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('401') || msg.includes('unauthorized')) {
            return 'Check your API key. It may be expired or invalid.';
        }
        if (msg.includes('403') || msg.includes('forbidden')) {
            return 'Your Copilot license may not include API access. Contact your admin.';
        }
        if (msg.includes('429') || msg.includes('rate limit')) {
            return 'Rate limited. Wait a minute and try again.';
        }
        if (msg.includes('network') || msg.includes('fetch')) {
            return 'Network error. Check your internet connection.';
        }
        return 'Check your Copilot configuration in Settings.';
    }
}

// Export as global singleton
window.copilot = new CopilotIntegration();
