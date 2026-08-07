"""
Knowledge Base Manager
======================

Core module for managing knowledge entries in LogSherlock Pro.
Provides CRUD operations, full-text search, tagging, and import/export.

Categories:
    - known_issues: Documented bugs and their workarounds
    - solutions: Verified fixes for common problems
    - runbooks: Step-by-step investigation procedures
    - product_info: Product documentation, versions, compatibility

Tags:
    - product: Which HPE product (morpheus, kvm, alletra, gfs2, pacemaker, vme)
    - component: Sub-component (api, provisioning, storage, network, cluster)
    - severity: critical, high, medium, low, informational

Usage:
    kb = KBManager()
    kb.add_entry(KnowledgeEntry(
        id="MORPH-001",
        title="Cloud Sync Failure",
        category=KBCategory.KNOWN_ISSUES,
        ...
    ))
    results = kb.search("cloud sync timeout")
"""

import json
import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional


class KBCategory(str, Enum):
    """Categories for knowledge base entries."""
    KNOWN_ISSUES = "known_issues"
    SOLUTIONS = "solutions"
    RUNBOOKS = "runbooks"
    PRODUCT_INFO = "product_info"


class KBTag:
    """
    Tag system for knowledge entries.
    
    Tags allow filtering and grouping entries by product, component, or severity.
    
    Example:
        tags = [
            KBTag(type="product", value="morpheus"),
            KBTag(type="component", value="api"),
            KBTag(type="severity", value="high"),
        ]
    """
    
    # Valid tag types and their allowed values
    VALID_TYPES = {
        "product": [
            "morpheus", "kvm", "alletra", "gfs2", "pacemaker", "vme", "networking"
        ],
        "component": [
            "api", "provisioning", "storage", "network", "cluster", "vm_lifecycle",
            "migration", "disk", "multipath", "dlm", "fencing", "quorum",
            "deployment", "smad", "iptables", "netplan", "journal", "lun",
            "datastore", "cloud_sync", "libvirt", "scsi", "resource",
            "log_rotation", "hvmos"
        ],
        "severity": [
            "critical", "high", "medium", "low", "informational"
        ],
    }

    def __init__(self, tag_type: str, value: str):
        """
        Create a new tag.
        
        Args:
            tag_type: One of 'product', 'component', 'severity'
            value: The tag value (validated against VALID_TYPES)
        """
        if tag_type not in self.VALID_TYPES:
            raise ValueError(
                f"Invalid tag type '{tag_type}'. Must be one of: {list(self.VALID_TYPES.keys())}"
            )
        # Allow custom values but warn if not in predefined list
        self.type = tag_type
        self.value = value.lower().strip()

    def __repr__(self):
        return f"KBTag({self.type}={self.value})"

    def __eq__(self, other):
        if isinstance(other, KBTag):
            return self.type == other.type and self.value == other.value
        return False

    def __hash__(self):
        return hash((self.type, self.value))

    def to_dict(self) -> dict:
        return {"type": self.type, "value": self.value}

    @classmethod
    def from_dict(cls, data: dict) -> "KBTag":
        return cls(tag_type=data["type"], value=data["value"])


@dataclass
class KnowledgeEntry:
    """
    A single knowledge base entry.
    
    Every entry follows a standard structure so junior engineers can
    quickly understand what the issue is, how to identify it, and how to fix it.
    
    Attributes:
        id: Unique identifier (e.g., "MORPH-7774", "KVM-001")
        title: Short, descriptive title
        category: One of known_issues, solutions, runbooks, product_info
        description: Detailed explanation of the issue/solution (plain English)
        affected_products: List of products affected (e.g., ["morpheus", "gfs2"])
        affected_versions: Version ranges affected (e.g., ["8.0.7-8.0.11"])
        symptoms: What you'll SEE in logs or system behavior
        root_cause: WHY this happens (technical explanation)
        solution: Step-by-step fix instructions
        prevention: How to avoid this in the future
        references: Links to docs, tickets, or KB articles
        tags: List of KBTag objects for filtering
        created_at: When this entry was created
        updated_at: When this entry was last modified
        author: Who wrote this entry
        confidence: How confident we are in the solution (0.0 - 1.0)
    """
    id: str
    title: str
    category: KBCategory
    description: str
    affected_products: list = field(default_factory=list)
    affected_versions: list = field(default_factory=list)
    symptoms: list = field(default_factory=list)
    root_cause: str = ""
    solution: str = ""
    prevention: str = ""
    references: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    author: str = "system"
    confidence: float = 1.0

    def to_dict(self) -> dict:
        """Convert entry to dictionary for JSON serialization."""
        data = asdict(self)
        data["category"] = self.category.value
        data["tags"] = [t.to_dict() if isinstance(t, KBTag) else t for t in self.tags]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "KnowledgeEntry":
        """Create entry from dictionary (e.g., loaded from JSON)."""
        data = data.copy()
        data["category"] = KBCategory(data["category"])
        data["tags"] = [
            KBTag.from_dict(t) if isinstance(t, dict) else t
            for t in data.get("tags", [])
        ]
        return cls(**data)

    def matches_tag(self, tag_type: str, value: str) -> bool:
        """Check if entry has a specific tag."""
        for tag in self.tags:
            if isinstance(tag, KBTag):
                if tag.type == tag_type and tag.value == value.lower():
                    return True
            elif isinstance(tag, dict):
                if tag.get("type") == tag_type and tag.get("value") == value.lower():
                    return True
        return False

    def get_searchable_text(self) -> str:
        """
        Get all text content combined for full-text search.
        This merges title, description, symptoms, solution, etc.
        """
        parts = [
            self.title,
            self.description,
            self.root_cause,
            self.solution,
            self.prevention,
        ]
        parts.extend(self.symptoms)
        parts.extend(self.affected_products)
        parts.extend(self.references)
        return " ".join(str(p) for p in parts if p)


class KBManager:
    """
    Knowledge Base Manager - Central hub for all knowledge operations.
    
    This class manages the in-memory knowledge base and provides:
    - Add/update/delete entries
    - Full-text search with relevance scoring
    - Tag-based filtering
    - Import/export as JSON
    
    Example:
        kb = KBManager()
        
        # Load pre-built knowledge
        from knowledge.known_issues import KNOWN_ISSUES_DB
        for issue in KNOWN_ISSUES_DB:
            kb.add_entry(issue)
        
        # Search for relevant entries
        results = kb.search("GFS2 mount failure", category=KBCategory.KNOWN_ISSUES)
        for entry, score in results:
            print(f"{entry.id}: {entry.title} (score: {score:.2f})")
    """

    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize the knowledge base.
        
        Args:
            storage_path: Optional path to persist knowledge as JSON.
                         If None, knowledge lives only in memory.
        """
        self._entries: dict[str, KnowledgeEntry] = {}
        self._storage_path = Path(storage_path) if storage_path else None

        # Load from disk if storage path exists
        if self._storage_path and self._storage_path.exists():
            self._load_from_disk()

    @property
    def entry_count(self) -> int:
        """Total number of entries in the knowledge base."""
        return len(self._entries)

    def add_entry(self, entry: KnowledgeEntry) -> str:
        """
        Add a new entry to the knowledge base.
        
        Args:
            entry: KnowledgeEntry to add
            
        Returns:
            The entry ID
            
        Raises:
            ValueError: If entry with same ID already exists (use update_entry instead)
        """
        if entry.id in self._entries:
            raise ValueError(
                f"Entry '{entry.id}' already exists. Use update_entry() to modify it."
            )
        self._entries[entry.id] = entry
        self._persist()
        return entry.id

    def update_entry(self, entry_id: str, **kwargs) -> KnowledgeEntry:
        """
        Update an existing entry.
        
        Args:
            entry_id: ID of the entry to update
            **kwargs: Fields to update (e.g., title="New Title", solution="...")
            
        Returns:
            The updated entry
            
        Raises:
            KeyError: If entry not found
        """
        if entry_id not in self._entries:
            raise KeyError(f"Entry '{entry_id}' not found in knowledge base.")

        entry = self._entries[entry_id]
        for key, value in kwargs.items():
            if hasattr(entry, key):
                setattr(entry, key, value)
        entry.updated_at = datetime.utcnow().isoformat()
        self._persist()
        return entry

    def delete_entry(self, entry_id: str) -> bool:
        """
        Remove an entry from the knowledge base.
        
        Args:
            entry_id: ID of the entry to remove
            
        Returns:
            True if deleted, False if not found
        """
        if entry_id in self._entries:
            del self._entries[entry_id]
            self._persist()
            return True
        return False

    def get_entry(self, entry_id: str) -> Optional[KnowledgeEntry]:
        """Get a single entry by ID. Returns None if not found."""
        return self._entries.get(entry_id)

    def get_all_entries(self, category: Optional[KBCategory] = None) -> list:
        """
        Get all entries, optionally filtered by category.
        
        Args:
            category: If provided, only return entries in this category
            
        Returns:
            List of KnowledgeEntry objects
        """
        if category:
            return [e for e in self._entries.values() if e.category == category]
        return list(self._entries.values())

    def search(
        self,
        query: str,
        category: Optional[KBCategory] = None,
        product: Optional[str] = None,
        severity: Optional[str] = None,
        max_results: int = 20,
    ) -> list:
        """
        Full-text search across the knowledge base with relevance scoring.
        
        How scoring works:
        - Each word in the query is checked against the entry's searchable text
        - Title matches get 3x weight (because titles are more specific)
        - Symptom matches get 2x weight (because that's what engineers search for)
        - Additional bonus for exact phrase matches
        - Results are sorted by score (highest first)
        
        Args:
            query: Search text (e.g., "GFS2 mount failed dlm")
            category: Optional category filter
            product: Optional product filter (e.g., "gfs2", "morpheus")
            severity: Optional severity filter (e.g., "critical", "high")
            max_results: Maximum number of results to return
            
        Returns:
            List of (KnowledgeEntry, score) tuples, sorted by relevance
        """
        if not query or not query.strip():
            return []

        query_lower = query.lower().strip()
        query_words = set(re.findall(r'\w+', query_lower))

        results = []

        for entry in self._entries.values():
            # Apply filters first (fast rejection)
            if category and entry.category != category:
                continue
            if product and not entry.matches_tag("product", product):
                # Also check affected_products list
                if product.lower() not in [p.lower() for p in entry.affected_products]:
                    continue
            if severity and not entry.matches_tag("severity", severity):
                continue

            # Calculate relevance score
            score = self._calculate_relevance(entry, query_lower, query_words)

            if score > 0:
                results.append((entry, score))

        # Sort by score (highest first)
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:max_results]

    def _calculate_relevance(
        self, entry: KnowledgeEntry, query_lower: str, query_words: set
    ) -> float:
        """
        Calculate how relevant an entry is to the search query.
        
        Scoring breakdown:
        - Title word match: +3.0 per word
        - Symptom word match: +2.0 per word
        - Description/solution word match: +1.0 per word
        - Exact phrase in title: +10.0 bonus
        - Exact phrase in symptoms: +5.0 bonus
        - Entry ID match: +15.0 (direct lookup)
        
        Returns:
            Float score (0.0 = no match, higher = more relevant)
        """
        score = 0.0

        # Direct ID match (highest priority)
        if query_lower.replace("-", "").replace(" ", "") in entry.id.lower().replace("-", ""):
            score += 15.0

        title_lower = entry.title.lower()
        description_lower = entry.description.lower()
        symptoms_text = " ".join(entry.symptoms).lower()
        solution_lower = entry.solution.lower()

        # Exact phrase matches (bonus)
        if query_lower in title_lower:
            score += 10.0
        if query_lower in symptoms_text:
            score += 5.0
        if query_lower in description_lower:
            score += 3.0

        # Word-level matching
        for word in query_words:
            if len(word) < 2:
                continue  # Skip single chars
            if word in title_lower:
                score += 3.0
            if word in symptoms_text:
                score += 2.0
            if word in description_lower:
                score += 1.0
            if word in solution_lower:
                score += 0.5

        # Normalize by query length to avoid bias toward long queries
        if query_words:
            score = score / (len(query_words) ** 0.5)

        return score

    def search_by_tags(
        self, tags: list, match_all: bool = False
    ) -> list:
        """
        Find entries matching specific tags.
        
        Args:
            tags: List of (tag_type, value) tuples
                  e.g., [("product", "gfs2"), ("severity", "critical")]
            match_all: If True, entry must match ALL tags. If False, any tag matches.
            
        Returns:
            List of matching KnowledgeEntry objects
        """
        results = []
        for entry in self._entries.values():
            if match_all:
                if all(entry.matches_tag(t, v) for t, v in tags):
                    results.append(entry)
            else:
                if any(entry.matches_tag(t, v) for t, v in tags):
                    results.append(entry)
        return results

    def get_entries_by_product(self, product: str) -> list:
        """Get all entries for a specific product."""
        product_lower = product.lower()
        return [
            e for e in self._entries.values()
            if product_lower in [p.lower() for p in e.affected_products]
            or e.matches_tag("product", product_lower)
        ]

    def get_entries_by_severity(self, severity: str) -> list:
        """Get all entries with a specific severity level."""
        return self.search_by_tags([("severity", severity)])

    def export_to_json(self, filepath: Optional[str] = None) -> str:
        """
        Export the entire knowledge base to JSON.
        
        Args:
            filepath: If provided, write to this file. Otherwise return JSON string.
            
        Returns:
            JSON string of all entries
        """
        data = {
            "version": "1.0.0",
            "exported_at": datetime.utcnow().isoformat(),
            "entry_count": len(self._entries),
            "entries": [entry.to_dict() for entry in self._entries.values()],
        }

        json_str = json.dumps(data, indent=2, ensure_ascii=False)

        if filepath:
            path = Path(filepath)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json_str, encoding="utf-8")

        return json_str

    def import_from_json(self, source: str, overwrite: bool = False) -> dict:
        """
        Import knowledge entries from JSON.
        
        Args:
            source: Either a file path or a JSON string
            overwrite: If True, overwrite existing entries with same ID
            
        Returns:
            Dict with import stats: {"imported": N, "skipped": N, "errors": N}
        """
        # Determine if source is a file path or JSON string
        source_path = Path(source)
        if source_path.exists():
            raw = source_path.read_text(encoding="utf-8")
        else:
            raw = source

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")

        entries_data = data.get("entries", [])
        stats = {"imported": 0, "skipped": 0, "errors": 0}

        for entry_data in entries_data:
            try:
                entry = KnowledgeEntry.from_dict(entry_data)
                if entry.id in self._entries:
                    if overwrite:
                        self._entries[entry.id] = entry
                        stats["imported"] += 1
                    else:
                        stats["skipped"] += 1
                else:
                    self._entries[entry.id] = entry
                    stats["imported"] += 1
            except Exception:
                stats["errors"] += 1

        self._persist()
        return stats

    def load_known_issues(self):
        """Load all pre-built known issues into the knowledge base."""
        from .known_issues import KNOWN_ISSUES_DB
        for entry in KNOWN_ISSUES_DB:
            if entry.id not in self._entries:
                self._entries[entry.id] = entry

    def load_runbooks(self):
        """Load all runbooks into the knowledge base."""
        from .runbooks import RUNBOOKS
        for runbook in RUNBOOKS:
            if runbook.id not in self._entries:
                self._entries[runbook.id] = runbook

    def get_statistics(self) -> dict:
        """
        Get statistics about the knowledge base.
        
        Returns:
            Dict with counts by category, product, severity, etc.
        """
        stats = {
            "total_entries": len(self._entries),
            "by_category": {},
            "by_product": {},
            "by_severity": {},
        }

        for entry in self._entries.values():
            # Count by category
            cat = entry.category.value
            stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1

            # Count by product
            for prod in entry.affected_products:
                stats["by_product"][prod] = stats["by_product"].get(prod, 0) + 1

            # Count by severity
            for tag in entry.tags:
                if isinstance(tag, KBTag) and tag.type == "severity":
                    stats["by_severity"][tag.value] = (
                        stats["by_severity"].get(tag.value, 0) + 1
                    )

        return stats

    def _persist(self):
        """Save knowledge base to disk if storage path is configured."""
        if self._storage_path:
            self.export_to_json(str(self._storage_path))

    def _load_from_disk(self):
        """Load knowledge base from disk."""
        if self._storage_path and self._storage_path.exists():
            self.import_from_json(str(self._storage_path), overwrite=True)
