"""
Cross-Node Correlation Engine
==============================

Reconstructs timelines across multiple cluster nodes to identify:
- Events occurring simultaneously on different nodes
- Cascade failures (event on node A triggers event on node B)
- Root cause identification (first error in causal chain)
- Temporal clustering of related events

Architecture:
    Events are sorted into a unified timeline, then analyzed for
    temporal proximity and causal relationships using known failure
    patterns (e.g., fencing -> resource migration -> service restart).
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class TimelineEvent:
    """A single event in the cross-node timeline."""
    timestamp: Optional[datetime]
    node_name: str
    source_file: str
    line_number: int
    matched_text: str
    pattern_name: str
    severity: str
    category: str
    confidence: float
    context_before: list = field(default_factory=list)
    context_after: list = field(default_factory=list)

    @property
    def sort_key(self):
        """Sort key for timeline ordering."""
        if self.timestamp:
            return self.timestamp
        return datetime.max


@dataclass
class CorrelationCluster:
    """A group of temporally related events across nodes."""
    events: list = field(default_factory=list)
    time_window: Optional[timedelta] = None
    nodes_involved: list = field(default_factory=list)
    root_cause_event: Optional[TimelineEvent] = None
    description: str = ""
    cascade_chain: list = field(default_factory=list)

    @property
    def severity(self) -> str:
        """Highest severity in the cluster."""
        severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
        for sev in severity_order:
            if any(e.severity == sev for e in self.events):
                return sev
        return "INFO"

    @property
    def event_count(self) -> int:
        return len(self.events)


@dataclass
class CorrelationResult:
    """Complete correlation analysis result."""
    timeline: list = field(default_factory=list)
    clusters: list = field(default_factory=list)
    root_causes: list = field(default_factory=list)
    cascade_chains: list = field(default_factory=list)
    nodes_analyzed: list = field(default_factory=list)
    time_span: Optional[timedelta] = None
    summary: str = ""


# Known causal relationships for cascade detection
CAUSAL_PATTERNS = {
    "corosync_membership_change": [
        "pacemaker_fencing",
        "pacemaker_resource_migration",
        "quorum_lost",
    ],
    "pacemaker_fencing": [
        "pacemaker_resource_migration",
        "gfs2_withdraw",
        "dlm_lockspace_error",
    ],
    "multipath_all_paths_down": [
        "io_error",
        "gfs2_readonly",
        "vm_paused_io_error",
    ],
    "network_link_down": [
        "corosync_token_timeout",
        "corosync_membership_change",
        "bond_slave_failure",
        "network_unreachable",
    ],
    "oom_kill": [
        "service_failed",
        "vm_paused_io_error",
    ],
    "kernel_panic": [
        "pacemaker_fencing",
        "corosync_membership_change",
    ],
    "io_error": [
        "gfs2_readonly",
        "gfs2_withdraw",
        "vm_disk_io_error",
    ],
    "scsi_reservation_conflict": [
        "gfs2_readonly",
        "multipath_path_down",
    ],
    "dlm_connection_lost": [
        "gfs2_lock_stuck",
        "gfs2_withdraw",
    ],
    "corosync_token_timeout": [
        "corosync_membership_change",
        "quorum_lost",
    ],
}


class CrossNodeCorrelator:
    """
    Cross-node event correlation engine.

    Analyzes pattern matches from multiple nodes to build a unified
    timeline, detect cascade failures, and identify root causes.

    Example:
        correlator = CrossNodeCorrelator()
        result = correlator.correlate(pattern_matches)
        print(f"Root cause: {result.root_causes[0].pattern_name}")
    """

    def __init__(
        self,
        time_window_seconds: float = 30.0,
        cascade_window_seconds: float = 120.0,
    ):
        """
        Initialize correlator.

        Args:
            time_window_seconds: Max seconds between events to consider
                them temporally related.
            cascade_window_seconds: Max seconds for cascade chain detection.
        """
        self.time_window = timedelta(seconds=time_window_seconds)
        self.cascade_window = timedelta(seconds=cascade_window_seconds)

    def correlate(self, pattern_matches: list) -> CorrelationResult:
        """
        Perform full correlation analysis on pattern matches.

        Args:
            pattern_matches: List of PatternMatch objects from PatternEngine.

        Returns:
            CorrelationResult with timeline, clusters, and root causes.
        """
        result = CorrelationResult()

        if not pattern_matches:
            result.summary = "No pattern matches to correlate."
            return result

        # Convert PatternMatch objects to TimelineEvents
        timeline = self._build_timeline(pattern_matches)
        result.timeline = timeline
        result.nodes_analyzed = list(set(e.node_name for e in timeline))

        # Calculate time span
        timed_events = [e for e in timeline if e.timestamp and e.timestamp != datetime.max]
        if len(timed_events) >= 2:
            result.time_span = timed_events[-1].timestamp - timed_events[0].timestamp

        # Cluster temporally related events
        result.clusters = self._find_temporal_clusters(timeline)

        # Detect cascade failures
        result.cascade_chains = self._detect_cascades(timeline)

        # Identify root causes
        result.root_causes = self._identify_root_causes(
            timeline, result.clusters, result.cascade_chains
        )

        # Generate summary
        result.summary = self._generate_summary(result)

        return result

    def _build_timeline(self, pattern_matches: list) -> list:
        """Convert PatternMatch objects to sorted TimelineEvents."""
        events = []

        for pm in pattern_matches:
            # Parse timestamp from match
            ts = self._extract_timestamp(pm)

            event = TimelineEvent(
                timestamp=ts,
                node_name=getattr(pm, 'node_name', ''),
                source_file=getattr(pm, 'source_file', ''),
                line_number=getattr(pm, 'line_number', 0),
                matched_text=getattr(pm, 'matched_text', ''),
                pattern_name=pm.pattern.name if hasattr(pm, 'pattern') else '',
                severity=pm.pattern.severity.value if hasattr(pm, 'pattern') else 'INFO',
                category=pm.pattern.category.value if hasattr(pm, 'pattern') else '',
                confidence=getattr(pm, 'confidence', 0.5),
                context_before=getattr(pm, 'context_before', []),
                context_after=getattr(pm, 'context_after', []),
            )
            events.append(event)

        # Sort by timestamp (None timestamps go to end)
        events.sort(key=lambda e: e.sort_key)
        return events

    def _extract_timestamp(self, pm) -> Optional[datetime]:
        """Extract datetime from a PatternMatch."""
        ts = getattr(pm, 'timestamp', None)
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            for fmt in [
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%b %d %H:%M:%S",
            ]:
                try:
                    dt = datetime.strptime(ts[:19], fmt)
                    if dt.year == 1900:
                        dt = dt.replace(year=datetime.now().year)
                    return dt
                except ValueError:
                    continue
        return None

    def _find_temporal_clusters(self, timeline: list) -> list:
        """
        Group events that occur within the time window of each other.

        Uses a sliding window approach to cluster nearby events.
        """
        clusters = []
        if not timeline:
            return clusters

        timed = [e for e in timeline if e.timestamp and e.timestamp != datetime.max]
        if not timed:
            # If no timestamps, group by node
            return self._cluster_by_node(timeline)

        used = set()
        for i, event in enumerate(timed):
            if i in used:
                continue

            cluster_events = [event]
            used.add(i)

            for j in range(i + 1, len(timed)):
                if j in used:
                    continue
                time_diff = abs(
                    (timed[j].timestamp - event.timestamp).total_seconds()
                )
                if time_diff <= self.time_window.total_seconds():
                    cluster_events.append(timed[j])
                    used.add(j)

            if len(cluster_events) > 1:
                nodes = list(set(e.node_name for e in cluster_events))
                cluster = CorrelationCluster(
                    events=cluster_events,
                    time_window=timedelta(
                        seconds=abs(
                            (cluster_events[-1].timestamp - cluster_events[0].timestamp).total_seconds()
                        )
                    ),
                    nodes_involved=nodes,
                    description=self._describe_cluster(cluster_events),
                )
                clusters.append(cluster)

        # Sort clusters by severity
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        clusters.sort(key=lambda c: severity_order.get(c.severity, 5))
        return clusters

    def _cluster_by_node(self, timeline: list) -> list:
        """Fallback clustering when timestamps are unavailable."""
        by_node = defaultdict(list)
        for event in timeline:
            by_node[event.node_name].append(event)

        clusters = []
        for node, events in by_node.items():
            if len(events) > 1:
                cluster = CorrelationCluster(
                    events=events,
                    nodes_involved=[node],
                    description=f"Multiple events on {node} (no timestamps available)",
                )
                clusters.append(cluster)
        return clusters

    def _detect_cascades(self, timeline: list) -> list:
        """
        Detect cascade failure chains using known causal relationships.

        Looks for patterns where event A is known to cause event B,
        and B occurs after A within the cascade window.
        """
        cascades = []
        timed = [e for e in timeline if e.timestamp and e.timestamp != datetime.max]

        if len(timed) < 2:
            return cascades

        for i, event_a in enumerate(timed):
            if event_a.pattern_name not in CAUSAL_PATTERNS:
                continue

            expected_effects = CAUSAL_PATTERNS[event_a.pattern_name]
            chain = [event_a]

            for j in range(i + 1, len(timed)):
                event_b = timed[j]
                time_diff = (event_b.timestamp - event_a.timestamp).total_seconds()

                if time_diff > self.cascade_window.total_seconds():
                    break

                if time_diff < 0:
                    continue

                if event_b.pattern_name in expected_effects:
                    chain.append(event_b)

            if len(chain) > 1:
                cascade = CorrelationCluster(
                    events=chain,
                    time_window=timedelta(
                        seconds=abs(
                            (chain[-1].timestamp - chain[0].timestamp).total_seconds()
                        )
                    ),
                    nodes_involved=list(set(e.node_name for e in chain)),
                    root_cause_event=chain[0],
                    cascade_chain=[e.pattern_name for e in chain],
                    description=(
                        f"Cascade: {chain[0].pattern_name} on {chain[0].node_name} "
                        f"triggered {len(chain)-1} subsequent event(s)"
                    ),
                )
                cascades.append(cascade)

        # Deduplicate cascades (keep longest chain for same root event)
        cascades.sort(key=lambda c: c.event_count, reverse=True)
        seen_roots = set()
        unique_cascades = []
        for cascade in cascades:
            root_key = (
                cascade.root_cause_event.pattern_name,
                cascade.root_cause_event.node_name,
                cascade.root_cause_event.line_number,
            )
            if root_key not in seen_roots:
                seen_roots.add(root_key)
                unique_cascades.append(cascade)

        return unique_cascades

    def _identify_root_causes(
        self, timeline: list, clusters: list, cascades: list
    ) -> list:
        """
        Identify the most likely root cause events.

        Strategy:
            1. First event in cascade chains
            2. Earliest CRITICAL event
            3. Events that triggered the most downstream effects
        """
        root_causes = []
        seen = set()

        # Root events from cascade chains
        for cascade in cascades:
            if cascade.root_cause_event:
                key = (
                    cascade.root_cause_event.pattern_name,
                    cascade.root_cause_event.node_name,
                    cascade.root_cause_event.line_number,
                )
                if key not in seen:
                    seen.add(key)
                    root_causes.append(cascade.root_cause_event)

        # Earliest CRITICAL events not already identified
        critical_events = [
            e for e in timeline
            if e.severity == "CRITICAL" and e.timestamp and e.timestamp != datetime.max
        ]
        for event in critical_events[:3]:
            key = (event.pattern_name, event.node_name, event.line_number)
            if key not in seen:
                seen.add(key)
                root_causes.append(event)

        # Sort by timestamp (earliest first)
        root_causes.sort(key=lambda e: e.sort_key)
        return root_causes

    def _describe_cluster(self, events: list) -> str:
        """Generate human-readable description for a cluster."""
        nodes = set(e.node_name for e in events)
        patterns = set(e.pattern_name for e in events)
        severities = set(e.severity for e in events)

        parts = []
        if len(nodes) > 1:
            parts.append(f"Multi-node event across {', '.join(sorted(nodes))}")
        else:
            parts.append(f"Event cluster on {next(iter(nodes))}")

        parts.append(f"{len(events)} events")
        parts.append(f"patterns: {', '.join(sorted(patterns)[:3])}")

        if "CRITICAL" in severities:
            parts.append("CRITICAL severity")

        return " | ".join(parts)

    def _generate_summary(self, result: CorrelationResult) -> str:
        """Generate a text summary of correlation findings."""
        parts = []

        parts.append(
            f"Analyzed {len(result.timeline)} events across "
            f"{len(result.nodes_analyzed)} node(s)"
        )

        if result.time_span:
            parts.append(f"Time span: {result.time_span}")

        if result.clusters:
            parts.append(f"Found {len(result.clusters)} event cluster(s)")

        if result.cascade_chains:
            parts.append(
                f"Detected {len(result.cascade_chains)} cascade failure chain(s)"
            )

        if result.root_causes:
            rc = result.root_causes[0]
            parts.append(
                f"Likely root cause: {rc.pattern_name} on {rc.node_name}"
            )

        return ". ".join(parts) + "."

    def find_simultaneous_events(
        self, timeline: list, window_seconds: float = 5.0
    ) -> list:
        """
        Find events happening at the same time on different nodes.

        Args:
            timeline: Sorted list of TimelineEvents.
            window_seconds: Max seconds apart to consider simultaneous.

        Returns:
            List of (event_a, event_b) tuples.
        """
        simultaneous = []
        timed = [e for e in timeline if e.timestamp and e.timestamp != datetime.max]

        for i in range(len(timed)):
            for j in range(i + 1, len(timed)):
                if timed[i].node_name == timed[j].node_name:
                    continue

                time_diff = abs(
                    (timed[j].timestamp - timed[i].timestamp).total_seconds()
                )
                if time_diff <= window_seconds:
                    simultaneous.append((timed[i], timed[j]))
                elif time_diff > window_seconds:
                    break

        return simultaneous
