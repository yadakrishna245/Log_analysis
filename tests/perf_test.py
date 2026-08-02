"""Performance test script for LogSherlock Pro quick_analyze endpoint.

Tests the optimized endpoint against a large tar.gz file and measures:
- Upload time
- Analysis time
- Total time
- Findings quality

Usage:
    python perf_test.py [path_to_tar_gz]

Default test file: demo/collect_demovmehost01_20260802_100000.tar.gz
"""

import os
import sys
import time
import json
import requests

# Configuration
DEFAULT_TEST_FILE = r"demo/collect_demovmehost01_20260802_100000.tar.gz"
BASE_URL = os.environ.get("LOGSHERLOCK_URL", "http://127.0.0.1:5000")
API_KEY = os.environ.get("LOGSHERLOCK_API_KEY", "dev-key-123")

# Chunk size for chunked upload test (5MB)
CHUNK_SIZE = 5 * 1024 * 1024


def format_size(size_bytes):
    """Format bytes to human-readable size."""
    if size_bytes >= 1024 * 1024 * 1024:
        return f"{size_bytes / 1024 / 1024 / 1024:.1f} GB"
    elif size_bytes >= 1024 * 1024:
        return f"{size_bytes / 1024 / 1024:.1f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes} bytes"


def test_quick_analyze(filepath):
    """Test the standard /api/analyze/quick endpoint."""
    file_size = os.path.getsize(filepath)
    filename = os.path.basename(filepath)

    print(f"\n{'='*70}")
    print(f"  TEST: /api/analyze/quick (single upload)")
    print(f"  File: {filename} ({format_size(file_size)})")
    print(f"{'='*70}")

    url = f"{BASE_URL}/api/analyze/quick"
    headers = {"X-API-Key": API_KEY}

    print(f"\n  Uploading + analyzing...")
    start_time = time.time()

    with open(filepath, 'rb') as f:
        files = {'file': (filename, f, 'application/gzip')}
        response = requests.post(url, files=files, headers=headers, timeout=120)

    total_time = time.time() - start_time

    if response.status_code != 200:
        print(f"  ❌ ERROR: HTTP {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return None

    result = response.json()

    # Display results
    print(f"\n  ✅ Analysis Complete!")
    print(f"  {'─'*50}")
    print(f"  Total time (upload + analysis): {total_time:.2f}s")
    print(f"  Server analysis_time_seconds:   {result.get('analysis_time_seconds', 'N/A')}s")
    print(f"  Files analyzed:                 {result.get('files_analyzed', 0)}")
    print(f"  Total lines scanned:            {result.get('total_lines', 0):,}")
    print(f"  Findings count:                 {result.get('findings_count', 0)}")
    print(f"  Early terminated:               {result.get('early_terminated', False)}")

    # Severity breakdown
    findings = result.get('findings', [])
    if findings:
        severity_counts = {}
        for f in findings:
            sev = f.get('severity', 'UNKNOWN')
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        print(f"\n  Severity Breakdown:")
        for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']:
            if sev in severity_counts:
                print(f"    {sev:10s}: {severity_counts[sev]}")

    # Performance assessment
    print(f"\n  {'─'*50}")
    if total_time < 30:
        print(f"  🎯 PASS: {total_time:.1f}s < 30s target")
    elif total_time < 60:
        print(f"  ⚠️  CLOSE: {total_time:.1f}s (target: <30s)")
    else:
        print(f"  ❌ SLOW: {total_time:.1f}s >> 30s target")

    return result


def test_chunked_upload(filepath):
    """Test the /api/analyze/quick/chunked endpoint."""
    file_size = os.path.getsize(filepath)
    filename = os.path.basename(filepath)
    total_chunks = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE

    print(f"\n{'='*70}")
    print(f"  TEST: /api/analyze/quick/chunked")
    print(f"  File: {filename} ({format_size(file_size)})")
    print(f"  Chunks: {total_chunks} x {format_size(CHUNK_SIZE)}")
    print(f"{'='*70}")

    url = f"{BASE_URL}/api/analyze/quick/chunked"
    headers = {"X-API-Key": API_KEY}
    upload_id = f"perf_{int(time.time())}"

    print(f"\n  Uploading chunks...")
    start_time = time.time()

    with open(filepath, 'rb') as f:
        for i in range(total_chunks):
            chunk_data = f.read(CHUNK_SIZE)
            files = {'chunk': (f'chunk_{i}', chunk_data, 'application/octet-stream')}
            data = {
                'chunk_index': str(i),
                'total_chunks': str(total_chunks),
                'filename': filename,
                'upload_id': upload_id,
                'description': 'Performance test - cluster node crash',
            }

            response = requests.post(url, files=files, data=data, headers=headers, timeout=120)

            if response.status_code != 200:
                print(f"  ❌ ERROR on chunk {i}: HTTP {response.status_code}")
                print(f"  Response: {response.text[:500]}")
                return None

            result = response.json()

            if result.get('status') == 'uploading':
                progress = result.get('progress_percent', 0)
                elapsed = time.time() - start_time
                speed = (i + 1) * CHUNK_SIZE / elapsed / 1024 / 1024
                print(f"    Chunk {i+1}/{total_chunks} - {progress:.0f}% ({speed:.1f} MB/s)", end='\r')

    total_time = time.time() - start_time
    print(f"\n")

    if result.get('status') == 'complete':
        print(f"  ✅ Chunked Analysis Complete!")
        print(f"  {'─'*50}")
        print(f"  Total time:                     {total_time:.2f}s")
        print(f"  Upload/reassembly:              {result.get('upload_reassembly_seconds', 'N/A')}s")
        print(f"  Server analysis time:           {result.get('analysis_time_seconds', 'N/A')}s")
        print(f"  Files analyzed:                 {result.get('files_analyzed', 0)}")
        print(f"  Total lines scanned:            {result.get('total_lines', 0):,}")
        print(f"  Findings count:                 {result.get('findings_count', 0)}")
        print(f"  Early terminated:               {result.get('early_terminated', False)}")

        findings = result.get('findings', [])
        if findings:
            severity_counts = {}
            for f_item in findings:
                sev = f_item.get('severity', 'UNKNOWN')
                severity_counts[sev] = severity_counts.get(sev, 0) + 1
            print(f"\n  Severity Breakdown:")
            for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']:
                if sev in severity_counts:
                    print(f"    {sev:10s}: {severity_counts[sev]}")

        print(f"\n  {'─'*50}")
        if total_time < 30:
            print(f"  🎯 PASS: {total_time:.1f}s < 30s target")
        elif total_time < 60:
            print(f"  ⚠️  CLOSE: {total_time:.1f}s (target: <30s)")
        else:
            print(f"  ❌ SLOW: {total_time:.1f}s >> 30s target")
    else:
        print(f"  ❌ Unexpected final status: {result.get('status')}")

    return result


def test_small_file():
    """Test with a small file to verify backward compatibility."""
    print(f"\n{'='*70}")
    print(f"  TEST: Small file backward compatibility")
    print(f"{'='*70}")

    # Create a small test log file
    test_content = "\n".join([
        "Jan 15 10:30:45 node1 kernel: Out of memory: Kill process 1234 (java)",
        "Jan 15 10:30:45 node1 kernel: segfault at 0000000000000000",
        "Jan 15 10:30:46 node1 systemd: Starting cleanup...",
        "Jan 15 10:30:47 node1 corosync: error connecting to ring",
        "Jan 15 10:30:48 node1 pacemaker: Fencing node node2",
        "Jan 15 10:30:49 node1 kernel: GFS2 forcing withdraw",
        "Jan 15 10:30:50 node1 kernel: normal log line nothing to see",
    ] * 100)

    url = f"{BASE_URL}/api/analyze/quick"
    headers = {"X-API-Key": API_KEY}

    start_time = time.time()
    files = {'file': ('test_messages.log', test_content.encode(), 'text/plain')}
    response = requests.post(url, files=files, headers=headers, timeout=30)
    elapsed = time.time() - start_time

    if response.status_code == 200:
        result = response.json()
        print(f"\n  ✅ Small file OK: {elapsed:.2f}s, {result.get('findings_count', 0)} findings")
        print(f"  Server time: {result.get('analysis_time_seconds', 'N/A')}s")
    else:
        print(f"\n  ❌ ERROR: HTTP {response.status_code}: {response.text[:200]}")


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEST_FILE

    if not os.path.exists(filepath):
        print(f"❌ Test file not found: {filepath}")
        print(f"   Provide path as argument: python perf_test.py <path_to_tar_gz>")
        sys.exit(1)

    file_size = os.path.getsize(filepath)
    print(f"\n{'═'*70}")
    print(f"  LogSherlock Pro - Performance Test Suite")
    print(f"  Server: {BASE_URL}")
    print(f"  Test file: {os.path.basename(filepath)} ({format_size(file_size)})")
    print(f"{'═'*70}")

    # Test 1: Backward compat with small files
    test_small_file()

    # Test 2: Standard upload
    result1 = test_quick_analyze(filepath)

    # Test 3: Chunked upload
    result2 = test_chunked_upload(filepath)

    # Summary
    print(f"\n{'═'*70}")
    print(f"  PERFORMANCE SUMMARY")
    print(f"{'═'*70}")
    if result1:
        t1 = result1.get('analysis_time_seconds', 'N/A')
        print(f"  Standard upload:  {t1}s analysis ({result1.get('findings_count', 0)} findings)")
    if result2 and result2.get('status') == 'complete':
        t2 = result2.get('analysis_time_seconds', 'N/A')
        print(f"  Chunked upload:   {t2}s analysis ({result2.get('findings_count', 0)} findings)")
    print(f"{'═'*70}\n")


if __name__ == '__main__':
    main()

