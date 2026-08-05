// LogSherlock Pro — Scan Worker (Local Edition)
// Runs pattern matching in a background thread to prevent UI freeze
// Handles: .tar.gz, .tgz, .gz, plain text files of ANY size
// Copyright 2026 Krishna Yada. All Rights Reserved.

self.onmessage = async function(e) {
    const { file, patterns, prefilterWords } = e.data;
    
    // Build prefilter regex
    const PREFILTER_RE = new RegExp(prefilterWords.join('|'), 'i');
    
    // Compile patterns
    const compiledPatterns = patterns.map(p => ({
        ...p,
        compiled: new RegExp(p.regex, p.flags || 'i')
    }));
    
    const findings = [];
    const MAX_FINDINGS = 300;
    let filesAnalyzed = 0;
    let totalLines = 0;
    let totalEntries = 0;
    let filesSkipped = 0;
    const mtimes = [];
    const decoder = new TextDecoder('utf-8', {fatal: false});
    
    const HIGH_PRI_RE = /(messages|syslog|dmesg|kern|corosync|pacemaker|cluster|multipath|journal|auth\.log|secure|boot\.log|alert|fence|stonith|dlm|gfs2|iscsi|scsi|storage|crit|emerg|morpheus)/i;
    
    function classifyFile(name, size) {
        if (!name || size === 0) return 'skip';
        const n = name.toLowerCase();
        if (n.endsWith('/')) return 'skip';
        const binExts = ['.png','.jpg','.gif','.pdf','.rpm','.deb','.bin','.exe','.so','.ko','.pyc','.class','.sqlite','.db','.vmdk','.qcow2'];
        for (const ext of binExts) { if (n.endsWith(ext)) return 'skip'; }
        if (size > 30 * 1024 * 1024) return 'skip';
        if (HIGH_PRI_RE.test(n)) return 'high';
        const textExts = ['.log','.err','.out','.txt'];
        for (const ext of textExts) { if (n.endsWith(ext)) return 'medium'; }
        if (n.includes('/') && !n.includes('.')) return 'medium';
        return 'low';
    }
    
    function scanLines(text, fileName, mtime) {
        const lines = text.split('\n');
        filesAnalyzed++;
        const maxLines = text.length > 5*1024*1024 ? 30000 : (text.length > 1024*1024 ? 50000 : 100000);
        
        for (let ln = 0; ln < Math.min(lines.length, maxLines); ln++) {
            totalLines++;
            const line = lines[ln];
            if (!line || !PREFILTER_RE.test(line)) continue;
            for (const p of compiledPatterns) {
                if (p.compiled.test(line)) {
                    findings.push({
                        pattern_name: p.name,
                        severity: p.severity,
                        category: p.category,
                        file: fileName,
                        line_number: ln + 1,
                        line_content: line.substring(0, 500),
                        description: p.description,
                        solution_hint: p.solution_hint || '',
                        file_date: mtime ? new Date(mtime * 1000).toISOString() : '',
                    });
                    if (findings.length >= MAX_FINDINGS) return;
                    break;
                }
            }
            if (findings.length >= MAX_FINDINGS) return;
        }
    }
    
    try {
        const isTar = file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz') || file.name.endsWith('.tar');
        const isGz = file.name.endsWith('.gz') && !isTar;
        
        if (isTar) {
            let stream = file.stream();
            if (file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')) {
                stream = stream.pipeThrough(new DecompressionStream('gzip'));
            }
            const reader = stream.getReader();
            
            let buffer = new Uint8Array(0);
            let done = false;
            
            async function fillBuffer(need) {
                while (buffer.length < need && !done) {
                    const result = await reader.read();
                    if (result.done) { done = true; break; }
                    const newBuf = new Uint8Array(buffer.length + result.value.length);
                    newBuf.set(buffer, 0);
                    newBuf.set(result.value, buffer.length);
                    buffer = newBuf;
                }
                return buffer.length >= need;
            }
            
            function consume(n) {
                const chunk = buffer.slice(0, n);
                buffer = buffer.slice(n);
                return chunk;
            }
            
            let mediumCount = 0;
            
            while (findings.length < MAX_FINDINGS) {
                if (!(await fillBuffer(512))) break;
                const header = consume(512);
                if (header.every(b => b === 0)) break;
                
                let name = decoder.decode(header.slice(0, 100)).replace(/\0/g, '');
                const prefix = decoder.decode(header.slice(345, 500)).replace(/\0/g, '');
                if (prefix) name = prefix + '/' + name;
                
                const sizeStr = decoder.decode(header.slice(124, 136)).replace(/\0/g, '').trim();
                const size = parseInt(sizeStr, 8) || 0;
                const mtimeStr = decoder.decode(header.slice(136, 148)).replace(/\0/g, '').trim();
                const mtime = parseInt(mtimeStr, 8) || 0;
                const type = String.fromCharCode(header[156]);
                const paddedSize = Math.ceil(size / 512) * 512;
                
                totalEntries++;
                
                if ((type === '0' || type === '\0') && size > 0 && size <= 30 * 1024 * 1024) {
                    const priority = classifyFile(name, size);
                    if (priority === 'skip') {
                        if (!(await fillBuffer(paddedSize))) break;
                        consume(paddedSize);
                        filesSkipped++;
                    } else if (priority === 'medium' && mediumCount >= 50) {
                        if (!(await fillBuffer(paddedSize))) break;
                        consume(paddedSize);
                        filesSkipped++;
                    } else {
                        if (priority === 'medium') mediumCount++;
                        if (!(await fillBuffer(paddedSize))) break;
                        const content = consume(paddedSize).slice(0, size);
                        if (mtime > 0) mtimes.push(mtime);
                        const text = decoder.decode(content);
                        scanLines(text, name, mtime);
                        
                        if (filesAnalyzed % 5 === 0) {
                            self.postMessage({
                                type: 'progress',
                                filesAnalyzed,
                                totalEntries,
                                findings: findings.length,
                                totalLines,
                                currentFile: name.split('/').pop(),
                            });
                        }
                    }
                } else {
                    if (paddedSize > 0) {
                        if (!(await fillBuffer(paddedSize))) break;
                        consume(paddedSize);
                    }
                    if (size > 0) filesSkipped++;
                }
            }
            
        } else if (isGz) {
            const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
            const reader = stream.getReader();
            let leftover = '';
            let bytesRead = 0;
            
            while (findings.length < MAX_FINDINGS) {
                const {value, done: streamDone} = await reader.read();
                if (streamDone) break;
                
                bytesRead += value.length;
                const chunk = leftover + decoder.decode(value, {stream: true});
                const lines = chunk.split('\n');
                leftover = lines.pop() || '';
                
                for (const line of lines) {
                    totalLines++;
                    if (!line || !PREFILTER_RE.test(line)) continue;
                    for (const p of compiledPatterns) {
                        if (p.compiled.test(line)) {
                            findings.push({
                                pattern_name: p.name, severity: p.severity, category: p.category,
                                file: file.name, line_number: totalLines, line_content: line.substring(0, 500),
                                description: p.description, solution_hint: p.solution_hint || '', file_date: '',
                            });
                            if (findings.length >= MAX_FINDINGS) break;
                            break;
                        }
                    }
                    if (findings.length >= MAX_FINDINGS) break;
                }
                
                if (totalLines % 50000 === 0) {
                    self.postMessage({
                        type: 'progress',
                        filesAnalyzed: 1,
                        totalEntries: 1,
                        findings: findings.length,
                        totalLines,
                        currentFile: file.name,
                        bytesRead,
                    });
                }
            }
            filesAnalyzed = 1;
            
        } else {
            const stream = file.stream();
            const reader = stream.getReader();
            let leftover = '';
            let bytesRead = 0;
            
            while (findings.length < MAX_FINDINGS) {
                const {value, done: streamDone} = await reader.read();
                if (streamDone) break;
                
                bytesRead += value.length;
                const chunk = leftover + decoder.decode(value, {stream: true});
                const lines = chunk.split('\n');
                leftover = lines.pop() || '';
                
                for (const line of lines) {
                    totalLines++;
                    if (!line || !PREFILTER_RE.test(line)) continue;
                    for (const p of compiledPatterns) {
                        if (p.compiled.test(line)) {
                            findings.push({
                                pattern_name: p.name, severity: p.severity, category: p.category,
                                file: file.name, line_number: totalLines, line_content: line.substring(0, 500),
                                description: p.description, solution_hint: p.solution_hint || '', file_date: '',
                            });
                            if (findings.length >= MAX_FINDINGS) break;
                            break;
                        }
                    }
                    if (findings.length >= MAX_FINDINGS) break;
                }
                
                if (totalLines % 50000 === 0) {
                    self.postMessage({
                        type: 'progress',
                        filesAnalyzed: 1,
                        totalEntries: 1,
                        findings: findings.length,
                        totalLines,
                        currentFile: file.name,
                        bytesRead,
                    });
                }
            }
            filesAnalyzed = 1;
        }
    } catch(err) {
        if (findings.length === 0) {
            self.postMessage({ type: 'error', message: err.message });
            return;
        }
    }
    
    // Done — send results
    self.postMessage({
        type: 'done',
        findings,
        filesAnalyzed,
        totalLines,
        totalEntries,
        filesSkipped,
        mtimes,
    });
};
