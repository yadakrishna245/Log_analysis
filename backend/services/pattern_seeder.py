"""
LogSherlock Pro - Built-in Pattern Seeder
Seeds the database with common log analysis patterns.
"""

from models import db, Pattern


BUILTIN_PATTERNS = [
    {
        "name": "Java NullPointerException",
        "description": "Detects Java NullPointerException stack traces",
        "pattern_type": "regex",
        "pattern_value": r"java\.lang\.NullPointerException",
        "severity": "error",
        "category": "crash",
    },
    {
        "name": "OutOfMemoryError",
        "description": "Detects Java OutOfMemoryError conditions",
        "pattern_type": "regex",
        "pattern_value": r"java\.lang\.OutOfMemoryError|OutOfMemory|OOM\s+killer",
        "severity": "critical",
        "category": "memory_leak",
    },
    {
        "name": "Connection Timeout",
        "description": "Detects connection timeout errors",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(connection\s+timed?\s*out|connect\s+timeout|read\s+timed?\s*out)",
        "severity": "error",
        "category": "timeout",
    },
    {
        "name": "Disk Space Critical",
        "description": "Detects low disk space warnings",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(no\s+space\s+left\s+on\s+device|disk\s+full|filesystem.*100%)",
        "severity": "critical",
        "category": "disk_space",
    },
    {
        "name": "Permission Denied",
        "description": "Detects file/directory permission errors",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(permission\s+denied|access\s+denied|EACCES|forbidden)",
        "severity": "warning",
        "category": "permission",
    },
    {
        "name": "Service Crash/Restart",
        "description": "Detects service crash or unexpected restart events",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(segmentation\s+fault|core\s+dumped|service\s+.*\s+crashed|unexpected\s+shutdown)",
        "severity": "critical",
        "category": "crash",
    },
    {
        "name": "SSL/TLS Error",
        "description": "Detects SSL/TLS certificate and handshake errors",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(ssl\s+handshake\s+failed|certificate\s+expired|cert\s+verify\s+failed|CERTIFICATE_VERIFY_FAILED)",
        "severity": "error",
        "category": "security",
    },
    {
        "name": "Authentication Failure",
        "description": "Detects authentication and login failures",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(authentication\s+failed|login\s+failed|invalid\s+credentials|unauthorized|401)",
        "severity": "warning",
        "category": "security",
    },
    {
        "name": "Database Connection Error",
        "description": "Detects database connectivity issues",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(cannot\s+connect\s+to\s+database|db\s+connection\s+refused|too\s+many\s+connections|deadlock)",
        "severity": "error",
        "category": "database",
    },
    {
        "name": "Network Interface Down",
        "description": "Detects network interface failures",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(link\s+is\s+down|network\s+unreachable|no\s+route\s+to\s+host|interface\s+.*\s+down)",
        "severity": "critical",
        "category": "network",
    },
    {
        "name": "High CPU Usage",
        "description": "Detects high CPU utilization alerts",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(cpu\s+usage\s*(>|above|exceeds)\s*9[0-9]%|cpu\s+100%|load\s+average.*[2-9]\d\.\d)",
        "severity": "warning",
        "category": "performance",
    },
    {
        "name": "Kernel Panic",
        "description": "Detects Linux kernel panic events",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(kernel\s+panic|BUG:\s+|Oops:\s+|Call\s+Trace:)",
        "severity": "critical",
        "category": "crash",
    },
    {
        "name": "HPE iLO Alert",
        "description": "Detects HPE Integrated Lights-Out critical alerts",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(iLO\s+.*\s+(critical|error|failed)|Degraded\s+Array|Drive\s+Failure)",
        "severity": "critical",
        "category": "hardware",
    },
    {
        "name": "Storage Array Error",
        "description": "Detects storage subsystem errors",
        "pattern_type": "regex",
        "pattern_value": r"(?i)(SCSI\s+error|I/O\s+error|medium\s+error|unrecovered\s+read\s+error|RAID\s+degraded)",
        "severity": "error",
        "category": "storage",
    },
    {
        "name": "Process Kill (OOM)",
        "description": "Detects OOM killer terminating processes",
        "pattern_type": "regex",
        "pattern_value": r"Out of memory:.*Killed process|oom-kill|invoked oom-killer",
        "severity": "critical",
        "category": "memory_leak",
    },
]


def seed_builtin_patterns():
    """Seed the database with built-in patterns. Returns count of patterns added."""
    count = 0
    for pattern_data in BUILTIN_PATTERNS:
        existing = Pattern.query.filter_by(name=pattern_data['name']).first()
        if not existing:
            pattern = Pattern(
                name=pattern_data['name'],
                description=pattern_data['description'],
                pattern_type=pattern_data['pattern_type'],
                pattern_value=pattern_data['pattern_value'],
                severity=pattern_data['severity'],
                category=pattern_data['category'],
                is_enabled=True,
                is_builtin=True,
            )
            db.session.add(pattern)
            count += 1

    db.session.commit()
    return count
