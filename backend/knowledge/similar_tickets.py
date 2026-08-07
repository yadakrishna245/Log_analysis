"""
Similar Ticket Matching
========================

Finds tickets similar to a given ticket based on:
1. TF-IDF text similarity on descriptions and findings
2. Pattern/fingerprint overlap scoring
3. Product and component matching

This helps engineers find past tickets with solutions that may apply
to the current issue they're investigating.

Usage:
    from knowledge.similar_tickets import SimilarTicketMatcher, TicketFingerprint

    matcher = SimilarTicketMatcher()

    # Add past tickets to the corpus
    matcher.add_ticket(TicketFingerprint(
        ticket_id="CASE-12345",
        description="GFS2 mount failing after node reboot",
        products=["gfs2", "pacemaker"],
        patterns_found=["dlm_not_running", "quorum_lost"],
        findings=["DLM service inactive", "Quorum: No"],
        solution="Restarted corosync and DLM on all nodes",
    ))

    # Find similar tickets
    results = matcher.find_similar(
        description="GFS2 won't mount, DLM errors in log",
        products=["gfs2"],
        patterns_found=["dlm_not_running"],
        top_n=5,
    )
    for match in results:
        print(f"{match['ticket_id']}: {match['score']:.2f} - {match['solution']}")
"""

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TicketFingerprint:
    """
    A fingerprint represents a past ticket's key characteristics.
    
    Think of it as a summary of what was found and how it was resolved.
    We use these to compare against new tickets and find matches.
    
    Attributes:
        ticket_id: Unique ticket identifier (e.g., "CASE-12345")
        description: Free-text description of the issue
        products: Products involved (e.g., ["gfs2", "pacemaker"])
        components: Specific components (e.g., ["dlm", "journal"])
        patterns_found: Pattern IDs detected during analysis
        findings: List of findings/observations from log analysis
        severity: Ticket severity (critical, high, medium, low)
        solution: How the issue was resolved (the gold - what we want to surface)
        resolution_time_hours: How long it took to resolve (for prioritization)
        tags: Additional tags for filtering
    """
    ticket_id: str
    description: str
    products: list = field(default_factory=list)
    components: list = field(default_factory=list)
    patterns_found: list = field(default_factory=list)
    findings: list = field(default_factory=list)
    severity: str = "medium"
    solution: str = ""
    resolution_time_hours: float = 0.0
    tags: list = field(default_factory=list)

    def get_all_text(self) -> str:
        """Combine all text fields for TF-IDF comparison."""
        parts = [
            self.description,
            " ".join(self.products),
            " ".join(self.components),
            " ".join(self.patterns_found),
            " ".join(self.findings),
            self.solution,
        ]
        return " ".join(parts)

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "ticket_id": self.ticket_id,
            "description": self.description,
            "products": self.products,
            "components": self.components,
            "patterns_found": self.patterns_found,
            "findings": self.findings,
            "severity": self.severity,
            "solution": self.solution,
            "resolution_time_hours": self.resolution_time_hours,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TicketFingerprint":
        """Deserialize from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})



class TFIDFEngine:
    """
    Simple TF-IDF (Term Frequency - Inverse Document Frequency) implementation.
    
    TF-IDF measures how important a word is to a document within a collection.
    Words that appear often in ONE document but rarely in others get high scores.
    
    How it works (for junior engineers):
    - TF (Term Frequency): How often a word appears in THIS document
      Formula: count(word) / total_words_in_document
    - IDF (Inverse Document Frequency): How rare a word is across ALL documents
      Formula: log(total_documents / documents_containing_word)
    - TF-IDF = TF * IDF
    
    A word like "error" appears everywhere (low IDF = not useful for matching).
    A word like "gfs2_withdraw" appears rarely (high IDF = great for matching).
    
    We use this to compare ticket descriptions and find similar ones.
    """

    # Common words that don't help with matching (stop words)
    STOP_WORDS = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "must", "ought",
        "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
        "they", "them", "this", "that", "these", "those", "am", "if", "or",
        "and", "but", "not", "no", "so", "as", "of", "at", "by", "for",
        "with", "about", "between", "through", "during", "before", "after",
        "to", "from", "in", "on", "up", "out", "off", "over", "under",
        "again", "then", "once", "here", "there", "when", "where", "why",
        "how", "all", "each", "every", "both", "few", "more", "most",
        "other", "some", "such", "than", "too", "very", "just", "also",
    }

    def __init__(self):
        """Initialize the TF-IDF engine."""
        self._documents: dict[str, list[str]] = {}  # doc_id -> tokenized words
        self._idf_cache: dict[str, float] = {}
        self._dirty = True  # IDF needs recalculation

    def add_document(self, doc_id: str, text: str):
        """
        Add a document to the corpus.
        
        Args:
            doc_id: Unique document identifier
            text: Raw text content
        """
        tokens = self._tokenize(text)
        self._documents[doc_id] = tokens
        self._dirty = True

    def remove_document(self, doc_id: str):
        """Remove a document from the corpus."""
        if doc_id in self._documents:
            del self._documents[doc_id]
            self._dirty = True

    def _tokenize(self, text: str) -> list:
        """
        Convert text to list of normalized tokens.
        
        Steps:
        1. Lowercase everything
        2. Extract words (alphanumeric + underscores for technical terms)
        3. Remove stop words
        4. Keep words with 2+ characters
        """
        text_lower = text.lower()
        # Keep underscores and hyphens as they're meaningful in technical text
        words = re.findall(r'[a-z0-9][a-z0-9_\-]*[a-z0-9]|[a-z0-9]', text_lower)
        # Remove stop words and very short tokens
        return [w for w in words if w not in self.STOP_WORDS and len(w) >= 2]

    def _compute_tf(self, tokens: list) -> dict:
        """
        Compute Term Frequency for a document's tokens.
        
        TF = count(word) / total_words
        """
        if not tokens:
            return {}
        counts = Counter(tokens)
        total = len(tokens)
        return {word: count / total for word, count in counts.items()}

    def _compute_idf(self):
        """
        Compute Inverse Document Frequency for all words in corpus.
        
        IDF = log(N / df) where:
        - N = total number of documents
        - df = number of documents containing the word
        """
        if not self._dirty:
            return

        n_docs = len(self._documents)
        if n_docs == 0:
            self._idf_cache = {}
            self._dirty = False
            return

        # Count document frequency for each word
        doc_freq: dict[str, int] = {}
        for tokens in self._documents.values():
            unique_tokens = set(tokens)
            for token in unique_tokens:
                doc_freq[token] = doc_freq.get(token, 0) + 1

        # Calculate IDF with smoothing to avoid division by zero
        self._idf_cache = {
            word: math.log((n_docs + 1) / (df + 1)) + 1.0
            for word, df in doc_freq.items()
        }
        self._dirty = False

    def get_tfidf_vector(self, text: str) -> dict:
        """
        Get the TF-IDF vector for a piece of text.
        
        Args:
            text: Raw text to vectorize
            
        Returns:
            Dict mapping words to their TF-IDF scores
        """
        self._compute_idf()
        tokens = self._tokenize(text)
        tf = self._compute_tf(tokens)

        tfidf = {}
        for word, tf_score in tf.items():
            idf_score = self._idf_cache.get(word, 1.0)
            tfidf[word] = tf_score * idf_score

        return tfidf

    def cosine_similarity(self, vec_a: dict, vec_b: dict) -> float:
        """
        Compute cosine similarity between two TF-IDF vectors.
        
        Cosine similarity measures the angle between two vectors:
        - 1.0 = identical direction (very similar documents)
        - 0.0 = orthogonal (completely different documents)
        
        Formula: (A · B) / (|A| * |B|)
        """
        # Find common words
        common_words = set(vec_a.keys()) & set(vec_b.keys())

        if not common_words:
            return 0.0

        # Dot product
        dot_product = sum(vec_a[w] * vec_b[w] for w in common_words)

        # Magnitudes
        mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
        mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

        if mag_a == 0 or mag_b == 0:
            return 0.0

        return dot_product / (mag_a * mag_b)



class SimilarTicketMatcher:
    """
    Finds similar past tickets based on multiple matching strategies.
    
    Scoring combines three signals:
    1. Text Similarity (TF-IDF cosine): How similar are the descriptions?
       Weight: 40% of total score
    2. Pattern Overlap: Do the same analysis patterns appear?
       Weight: 35% of total score
    3. Product/Component Match: Same product area?
       Weight: 25% of total score
    
    The combined score ranges from 0.0 (no match) to 1.0 (perfect match).
    
    Example:
        matcher = SimilarTicketMatcher()
        matcher.add_ticket(past_ticket_fingerprint)
        
        results = matcher.find_similar(
            description="VM won't boot after host crash",
            products=["kvm"],
            patterns_found=["libvirt_domain_missing"],
        )
    """

    # Scoring weights (must sum to 1.0)
    WEIGHT_TEXT_SIMILARITY = 0.40
    WEIGHT_PATTERN_OVERLAP = 0.35
    WEIGHT_PRODUCT_MATCH = 0.25

    def __init__(self):
        """Initialize the matcher with empty corpus."""
        self._tickets: dict[str, TicketFingerprint] = {}
        self._tfidf_engine = TFIDFEngine()

    @property
    def ticket_count(self) -> int:
        """Number of tickets in the corpus."""
        return len(self._tickets)

    def add_ticket(self, ticket: TicketFingerprint):
        """
        Add a resolved ticket to the corpus for future matching.
        
        Args:
            ticket: A TicketFingerprint with all fields populated
        """
        self._tickets[ticket.ticket_id] = ticket
        self._tfidf_engine.add_document(ticket.ticket_id, ticket.get_all_text())

    def add_tickets_batch(self, tickets: list):
        """Add multiple tickets at once."""
        for ticket in tickets:
            self.add_ticket(ticket)

    def remove_ticket(self, ticket_id: str):
        """Remove a ticket from the corpus."""
        if ticket_id in self._tickets:
            del self._tickets[ticket_id]
            self._tfidf_engine.remove_document(ticket_id)

    def find_similar(
        self,
        description: str = "",
        products: Optional[list] = None,
        components: Optional[list] = None,
        patterns_found: Optional[list] = None,
        findings: Optional[list] = None,
        top_n: int = 10,
        min_score: float = 0.1,
    ) -> list:
        """
        Find tickets similar to the given characteristics.
        
        Args:
            description: Free-text description of current issue
            products: Products involved in current issue
            components: Components involved
            patterns_found: Patterns detected in current analysis
            findings: Observations/findings from current analysis
            top_n: Maximum number of results to return
            min_score: Minimum similarity score to include (0.0 - 1.0)
            
        Returns:
            List of dicts with keys:
            - ticket_id: ID of the matching past ticket
            - score: Combined similarity score (0.0 - 1.0)
            - text_score: TF-IDF text similarity component
            - pattern_score: Pattern overlap component
            - product_score: Product/component match component
            - ticket: Full TicketFingerprint object
            - solution: The solution from the past ticket (quick access)
            - description: Past ticket's description
        """
        if not self._tickets:
            return []

        products = products or []
        components = components or []
        patterns_found = patterns_found or []
        findings = findings or []

        # Build query text for TF-IDF
        query_text = " ".join([
            description,
            " ".join(products),
            " ".join(components),
            " ".join(findings),
        ])

        # Get TF-IDF vector for query
        query_vector = self._tfidf_engine.get_tfidf_vector(query_text)

        results = []

        for ticket_id, ticket in self._tickets.items():
            # 1. Text similarity (TF-IDF cosine)
            ticket_vector = self._tfidf_engine.get_tfidf_vector(ticket.get_all_text())
            text_score = self._tfidf_engine.cosine_similarity(query_vector, ticket_vector)

            # 2. Pattern overlap (Jaccard similarity)
            pattern_score = self._pattern_overlap_score(
                patterns_found, ticket.patterns_found
            )

            # 3. Product/component match
            product_score = self._product_match_score(
                products, components, ticket.products, ticket.components
            )

            # Combined weighted score
            combined_score = (
                text_score * self.WEIGHT_TEXT_SIMILARITY
                + pattern_score * self.WEIGHT_PATTERN_OVERLAP
                + product_score * self.WEIGHT_PRODUCT_MATCH
            )

            if combined_score >= min_score:
                results.append({
                    "ticket_id": ticket_id,
                    "score": round(combined_score, 4),
                    "text_score": round(text_score, 4),
                    "pattern_score": round(pattern_score, 4),
                    "product_score": round(product_score, 4),
                    "ticket": ticket,
                    "solution": ticket.solution,
                    "description": ticket.description,
                })

        # Sort by combined score (highest first)
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_n]

    def find_similar_to_ticket(
        self, ticket: TicketFingerprint, top_n: int = 10, min_score: float = 0.1
    ) -> list:
        """
        Find tickets similar to a given ticket fingerprint.
        Convenience method that unpacks the fingerprint fields.
        
        Args:
            ticket: The ticket to find matches for
            top_n: Maximum results
            min_score: Minimum score threshold
            
        Returns:
            List of similar ticket matches (same format as find_similar)
        """
        return self.find_similar(
            description=ticket.description,
            products=ticket.products,
            components=ticket.components,
            patterns_found=ticket.patterns_found,
            findings=ticket.findings,
            top_n=top_n,
            min_score=min_score,
        )

    def _pattern_overlap_score(
        self, patterns_a: list, patterns_b: list
    ) -> float:
        """
        Calculate pattern overlap using Jaccard similarity.
        
        Jaccard = |A ∩ B| / |A ∪ B|
        
        This measures what fraction of patterns are shared between two tickets.
        If both tickets have the same patterns, score = 1.0.
        If no overlap, score = 0.0.
        """
        if not patterns_a and not patterns_b:
            return 0.0

        set_a = set(p.lower() for p in patterns_a)
        set_b = set(p.lower() for p in patterns_b)

        if not set_a and not set_b:
            return 0.0

        intersection = set_a & set_b
        union = set_a | set_b

        if not union:
            return 0.0

        return len(intersection) / len(union)

    def _product_match_score(
        self,
        products_a: list,
        components_a: list,
        products_b: list,
        components_b: list,
    ) -> float:
        """
        Calculate product and component match score.
        
        Scoring:
        - Exact product match: 0.6 per matching product (max 1.0)
        - Component match: 0.4 per matching component (max 1.0)
        - Combined and capped at 1.0
        """
        # Product matching
        set_prod_a = set(p.lower() for p in products_a)
        set_prod_b = set(p.lower() for p in products_b)
        product_overlap = set_prod_a & set_prod_b

        if set_prod_a or set_prod_b:
            product_union = set_prod_a | set_prod_b
            product_score = len(product_overlap) / len(product_union) if product_union else 0.0
        else:
            product_score = 0.0

        # Component matching
        set_comp_a = set(c.lower() for c in components_a)
        set_comp_b = set(c.lower() for c in components_b)
        component_overlap = set_comp_a & set_comp_b

        if set_comp_a or set_comp_b:
            component_union = set_comp_a | set_comp_b
            component_score = (
                len(component_overlap) / len(component_union) if component_union else 0.0
            )
        else:
            component_score = 0.0

        # Weight products more heavily than components
        combined = (product_score * 0.6) + (component_score * 0.4)
        return min(combined, 1.0)


    def get_statistics(self) -> dict:
        """Get statistics about the ticket corpus."""
        if not self._tickets:
            return {"total_tickets": 0}

        products = Counter()
        severities = Counter()
        for ticket in self._tickets.values():
            for p in ticket.products:
                products[p] += 1
            severities[ticket.severity] += 1

        return {
            "total_tickets": len(self._tickets),
            "by_product": dict(products),
            "by_severity": dict(severities),
        }

    def export_corpus(self) -> list:
        """Export all tickets as list of dicts for JSON serialization."""
        return [ticket.to_dict() for ticket in self._tickets.values()]

    def import_corpus(self, data: list):
        """Import tickets from list of dicts."""
        for item in data:
            ticket = TicketFingerprint.from_dict(item)
            self.add_ticket(ticket)


# =============================================================================
# SAMPLE PAST TICKETS (pre-loaded for matching)
# =============================================================================

SAMPLE_PAST_TICKETS = [
    TicketFingerprint(
        ticket_id="CASE-2024-001",
        description="GFS2 filesystem became read-only after node crash. DLM locks stuck.",
        products=["gfs2", "pacemaker"],
        components=["dlm", "journal"],
        patterns_found=["gfs2_withdraw", "dlm_lock_stuck", "node_crash"],
        findings=[
            "GFS2 withdraw detected in dmesg",
            "DLM locks in waiting state for 300+ seconds",
            "Node 3 crashed without proper fencing",
            "Journal recovery failed for jid=2",
        ],
        severity="critical",
        solution=(
            "1. Confirmed node 3 was dead via IPMI\n"
            "2. Manually fenced node 3: pcs stonith confirm node3\n"
            "3. DLM locks released after fencing\n"
            "4. Unmounted GFS2 on all surviving nodes\n"
            "5. Ran fsck.gfs2 -y on the device\n"
            "6. Remounted successfully on all nodes"
        ),
        resolution_time_hours=2.5,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-002",
        description="VMs failing to start after KVM host reboot. Domain not found errors.",
        products=["kvm", "morpheus"],
        components=["libvirt", "vm_lifecycle"],
        patterns_found=["domain_not_found", "libvirt_restart", "xml_missing"],
        findings=[
            "virsh list --all shows 0 VMs after reboot",
            "/etc/libvirt/qemu/ directory is empty",
            "libvirtd service started but no domains loaded",
            "VMs were defined as transient (virsh create, not define)",
        ],
        severity="high",
        solution=(
            "1. Found VM XML backups in /var/backups/libvirt/\n"
            "2. Re-defined all VMs: for f in /var/backups/libvirt/*.xml; do virsh define $f; done\n"
            "3. Started critical VMs: virsh start <vm>\n"
            "4. Converted all to persistent with autostart:\n"
            "   virsh autostart <vm> for each VM\n"
            "5. Set up nightly XML backup cron job"
        ),
        resolution_time_hours=1.0,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-003",
        description="Alletra LUN not visible on new cluster node. Multipath showing 0 paths.",
        products=["alletra", "pacemaker"],
        components=["lun", "multipath"],
        patterns_found=["lun_not_visible", "multipath_no_paths", "scsi_rescan_failed"],
        findings=[
            "multipath -ll returns empty output",
            "SCSI rescan found no new devices",
            "FC ports show 'Online' state",
            "Host initiator WWN not in Alletra host group",
        ],
        severity="high",
        solution=(
            "1. Identified host WWN: cat /sys/class/fc_host/host0/port_name\n"
            "2. Added host WWN to Alletra host group via web console\n"
            "3. Waited 30 seconds for SAN fabric to update\n"
            "4. Rescanned SCSI: echo '- - -' > /sys/class/scsi_host/host*/scan\n"
            "5. Reconfigured multipath: multipath -r\n"
            "6. Verified: multipath -ll showed 4 paths active"
        ),
        resolution_time_hours=0.5,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-004",
        description="Pacemaker cluster lost quorum. All resources stopped on remaining node.",
        products=["pacemaker", "gfs2"],
        components=["quorum", "fencing"],
        patterns_found=["quorum_lost", "resources_stopped", "corosync_timeout"],
        findings=[
            "corosync-quorumtool shows Quorate: No",
            "2 of 3 nodes offline",
            "Token timeout errors in corosync.log",
            "Cluster network switch had brief outage",
        ],
        severity="critical",
        solution=(
            "1. Identified network switch was rebooted (unplanned)\n"
            "2. Verified nodes 2 and 3 were actually healthy (SSH accessible)\n"
            "3. Restarted corosync on nodes 2 and 3\n"
            "4. Quorum restored automatically\n"
            "5. Resources started automatically after quorum\n"
            "6. Added redundant cluster network to prevent recurrence"
        ),
        resolution_time_hours=0.75,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-005",
        description="Morpheus provisioning stuck. Instance in provisioning state for 4 hours.",
        products=["morpheus", "kvm"],
        components=["provisioning", "datastore"],
        patterns_found=["provision_timeout", "datastore_full", "worker_blocked"],
        findings=[
            "Instance history shows 'Waiting for host allocation'",
            "Target datastore at 98% capacity",
            "Morpheus ProvisionWorker thread pool exhausted",
            "Other provisions also queued behind this one",
        ],
        severity="high",
        solution=(
            "1. Cancelled the stuck provisioning instance\n"
            "2. Freed datastore space by removing old snapshots (recovered 200GB)\n"
            "3. Restarted morpheus-ui to reset worker pool\n"
            "4. Re-submitted provisioning request targeting different datastore\n"
            "5. Set up datastore capacity alerting at 85%"
        ),
        resolution_time_hours=1.5,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-006",
        description="iptables rules lost after host reboot. Cluster communication broken.",
        products=["networking", "pacemaker"],
        components=["iptables", "quorum"],
        patterns_found=["firewall_rules_lost", "corosync_blocked", "quorum_lost"],
        findings=[
            "iptables -L shows only default ACCEPT policy (no custom rules)",
            "Corosync ports 5404/5405 not explicitly allowed",
            "iptables-persistent not installed",
            "Previous rules were added manually without saving",
        ],
        severity="high",
        solution=(
            "1. Re-added required firewall rules for corosync:\n"
            "   iptables -A INPUT -p udp --dport 5404:5406 -j ACCEPT\n"
            "2. Added rules for other cluster services\n"
            "3. Installed iptables-persistent: apt install iptables-persistent\n"
            "4. Saved rules: iptables-save > /etc/iptables/rules.v4\n"
            "5. Verified rules survive reboot\n"
            "6. Cluster re-formed after firewall fix"
        ),
        resolution_time_hours=0.5,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-007",
        description="VME deployment hangs at customization phase. VM created but not configured.",
        products=["vme", "kvm"],
        components=["deployment", "smad"],
        patterns_found=["deployment_timeout", "smad_unreachable", "no_network"],
        findings=[
            "VM exists on hypervisor (virsh list shows running)",
            "VM has no IP address (virsh domifaddr returns empty)",
            "smad.log shows 'customization agent not responding'",
            "VM template missing smad agent package",
        ],
        severity="medium",
        solution=(
            "1. Cancelled the stuck deployment\n"
            "2. Started the template VM to fix it:\n"
            "   virsh start template-vm\n"
            "3. Installed smad agent inside template:\n"
            "   ssh template-vm 'apt install smad-agent'\n"
            "4. Shut down and converted back to template\n"
            "5. Retried deployment - completed successfully\n"
            "6. Updated template creation docs to include smad requirement"
        ),
        resolution_time_hours=1.0,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-008",
        description="SCSI reservation conflict preventing second node from accessing shared LUN.",
        products=["alletra", "gfs2", "pacemaker"],
        components=["scsi", "multipath", "fencing"],
        patterns_found=["scsi_reservation_conflict", "io_errors", "node_evicted"],
        findings=[
            "dmesg: 'reservation conflict' on sd devices",
            "Node 2 evicted from cluster 3 days ago but not fenced",
            "sg_persist shows stale registration from evicted node",
            "GFS2 mount failing with device busy on node 1",
        ],
        severity="critical",
        solution=(
            "1. Confirmed node 2 was powered off (physically verified)\n"
            "2. Cleared stale SCSI registration:\n"
            "   sg_persist --out --clear --param-rk=<stale_key> /dev/mapper/mpath0\n"
            "3. Re-registered current node:\n"
            "   sg_persist --out --register --param-sark=<new_key> /dev/mapper/mpath0\n"
            "4. GFS2 mount succeeded after reservation cleared\n"
            "5. Fixed fencing configuration to prevent future stale reservations"
        ),
        resolution_time_hours=3.0,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-009",
        description="System disk 100% full. Services crashing. Logs consuming all space.",
        products=["kvm", "morpheus"],
        components=["log_rotation", "storage"],
        patterns_found=["disk_full", "service_crash", "log_growth"],
        findings=[
            "df -h shows /var at 100%",
            "/var/log/morpheus/morpheus-ui/current is 45GB",
            "logrotate not configured for Morpheus logs",
            "Multiple services failing due to ENOSPC",
        ],
        severity="high",
        solution=(
            "1. Emergency space recovery:\n"
            "   journalctl --vacuum-size=100M\n"
            "   truncate -s 0 /var/log/morpheus/morpheus-ui/current\n"
            "2. Restarted crashed services\n"
            "3. Created logrotate config for Morpheus:\n"
            "   /etc/logrotate.d/morpheus with rotate 7, compress, maxsize 500M\n"
            "4. Verified logrotate works: logrotate -f /etc/logrotate.d/morpheus\n"
            "5. Set up disk usage monitoring alert at 80%"
        ),
        resolution_time_hours=0.5,
    ),
    TicketFingerprint(
        ticket_id="CASE-2024-010",
        description="Live migration failed. CPU model incompatible between source and destination.",
        products=["kvm"],
        components=["migration", "vm_lifecycle"],
        patterns_found=["migration_failed", "cpu_incompatible", "feature_mismatch"],
        findings=[
            "virsh migrate error: 'unsupported configuration'",
            "Source host: Skylake CPU, Destination: Haswell CPU",
            "VM using cpu mode='host-passthrough'",
            "Guest using AVX-512 instructions not available on destination",
        ],
        severity="medium",
        solution=(
            "1. Changed VM CPU mode from host-passthrough to host-model:\n"
            "   virsh edit <vm>\n"
            "   <cpu mode='host-model'/>\n"
            "2. Shutdown and restarted VM with new config\n"
            "3. Migration succeeded after restart\n"
            "4. Updated cluster baseline to use IvyBridge as minimum\n"
            "5. Documented CPU compatibility requirements for the cluster"
        ),
        resolution_time_hours=0.75,
    ),
]


def create_preloaded_matcher() -> SimilarTicketMatcher:
    """
    Create a SimilarTicketMatcher pre-loaded with sample past tickets.
    
    Use this for quick setup in development/testing.
    
    Returns:
        SimilarTicketMatcher with 10 sample tickets loaded
    """
    matcher = SimilarTicketMatcher()
    matcher.add_tickets_batch(SAMPLE_PAST_TICKETS)
    return matcher
