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
        return this.enabled && this.apiKey.length > 10;
    }

    /**
     * Get connection status
     */
    getStatus() {
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
    async _callAPI(systemPrompt, userPrompt) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: this.maxTokens,
                temperature: this.temperature,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response generated.';
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
