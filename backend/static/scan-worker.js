// LogSherlock Pro — Scan Worker (Local Edition)
// Runs pattern matching in a background thread to prevent UI freeze
// Handles: .tar.gz, .tgz, .gz, .zip, plain text files of ANY size
// Copyright 2026 Krishna Yada. All Rights Reserved.

self.onmessage = async function(e) {
    const { file, patterns, prefilterWords, archiveName } = e.data;
    
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
        const binExts = ['.png','.jpg','.gif','.pdf','.rpm','.deb','.bin','.exe','.so','.ko','.pyc','.class','.sqlite','.db','.vmdk','.qcow2','.iso','.img','.jar','.war'];
        for (const ext of binExts) { if (n.endsWith(ext)) return 'skip'; }
        if (size > 100 * 1024 * 1024) return 'skip'; // Skip files > 100MB inside archives
        if (HIGH_PRI_RE.test(n)) return 'high';
        const textExts = ['.log','.err','.out','.txt','.conf','.cfg','.yaml','.yml','.xml','.json','.sh','.py','.pl'];
        for (const ext of textExts) { if (n.endsWith(ext)) return 'medium'; }
        // Files without extension or unknown extension — treat as medium (could be log files like 'messages', 'syslog')
        const lastPart = n.split('/').pop();
        if (!lastPart.includes('.') || lastPart.startsWith('.')) return 'medium';
        return 'low';
    }
    
    // Timestamp extraction patterns for log lines
    const TS_PATTERNS = [
        // ISO format: 2026-08-07T05:37:12 or 2026-08-07T05:37:12.123Z
        /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
        // ISO date+time with space: 2026-08-07 05:37:12.123
        /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
        // Syslog format: Aug  7 05:37:12 or Aug 07 05:37:12
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
        // Syslog with year: Aug 07 2026 05:37:12
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2})/,
    ];

    function extractTimestamp(line) {
        for (const re of TS_PATTERNS) {
            const m = line.match(re);
            if (m) return m[1];
        }
        return '';
    }

    function scanLines(text, fileName, mtime) {
        const lines = text.split('\n');
        filesAnalyzed++;
        const maxLines = text.length > 5*1024*1024 ? 30000 : (text.length > 1024*1024 ? 50000 : 100000);
        // Prepend archive name to file path if available
        const fullFile = archiveName ? archiveName + '/' + fileName : fileName;
        
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
                        file: fullFile,
                        line_number: ln + 1,
                        line_content: line.substring(0, 500),
                        description: p.description,
                        solution_hint: p.solution_hint || '',
                        file_date: mtime ? new Date(mtime * 1000).toISOString() : '',
                        log_timestamp: extractTimestamp(line),
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
        const isZip = file.name.endsWith('.zip');
        
        if (isZip) {
            // ═══ ZIP FILE SUPPORT ═══
            // Read ZIP using manual parsing of local file headers
            const arrayBuf = await file.arrayBuffer();
            const view = new DataView(arrayBuf);
            let offset = 0;
            let mediumCount = 0;
            
            while (offset < arrayBuf.byteLength - 4 && findings.length < MAX_FINDINGS) {
                // Check for local file header signature (PK\x03\x04)
                const sig = view.getUint32(offset, true);
                if (sig !== 0x04034b50) break; // Not a local file header
                
                const compMethod = view.getUint16(offset + 8, true);
                const compSize = view.getUint32(offset + 18, true);
                const uncompSize = view.getUint32(offset + 22, true);
                const nameLen = view.getUint16(offset + 26, true);
                const extraLen = view.getUint16(offset + 28, true);
                
                const nameBytes = new Uint8Array(arrayBuf, offset + 30, nameLen);
                const name = decoder.decode(nameBytes);
                
                const dataOffset = offset + 30 + nameLen + extraLen;
                offset = dataOffset + compSize;
                
                totalEntries++;
                
                // Skip directories, large files, binary files
                const priority = classifyFile(name, uncompSize);
                if (priority === 'skip' || uncompSize === 0) {
                    filesSkipped++;
                    continue;
                }
                if (priority === 'medium' && mediumCount >= 50) {
                    filesSkipped++;
                    continue;
                }
                if (priority === 'medium') mediumCount++;
                
                try {
                    let text = '';
                    const rawData = new Uint8Array(arrayBuf, dataOffset, compSize);
                    
                    if (compMethod === 0) {
                        // Stored (no compression)
                        text = decoder.decode(rawData);
                    } else if (compMethod === 8) {
                        // Deflate — use DecompressionStream
                        const ds = new DecompressionStream('deflate-raw');
                        const writer = ds.writable.getWriter();
                        const reader = ds.readable.getReader();
                        
                        // Write and close
                        writer.write(rawData);
                        writer.close();
                        
                        // Read decompressed
                        const chunks = [];
                        let totalSize = 0;
                        while (true) {
                            const {value, done: rdone} = await reader.read();
                            if (rdone) break;
                            chunks.push(value);
                            totalSize += value.length;
                            if (totalSize > 30 * 1024 * 1024) break; // 30MB safety limit per file
                        }
                        const merged = new Uint8Array(totalSize);
                        let pos = 0;
                        for (const c of chunks) { merged.set(c, pos); pos += c.length; }
                        text = decoder.decode(merged);
                    } else {
                        // Unsupported compression method
                        filesSkipped++;
                        continue;
                    }
                    
                    scanLines(text, name, 0);
                    
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
                } catch(entryErr) {
                    filesSkipped++;
                }
            }
            
        } else if (isTar) {
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
                                file: archiveName ? archiveName + '/' + file.name : file.name, line_number: totalLines, line_content: line.substring(0, 500),
                                description: p.description, solution_hint: p.solution_hint || '', file_date: '',
                                log_timestamp: extractTimestamp(line),
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
                                file: archiveName ? archiveName + '/' + file.name : file.name, line_number: totalLines, line_content: line.substring(0, 500),
                                description: p.description, solution_hint: p.solution_hint || '', file_date: '',
                                log_timestamp: extractTimestamp(line),
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
