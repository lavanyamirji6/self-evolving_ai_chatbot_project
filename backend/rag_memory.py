"""
Feature 3: RAG Memory — pure-Python vector store using TF-IDF + cosine similarity.
No compiler or external vector DB needed. Persists to a JSON file.
"""
from __future__ import annotations
import json
import math
import re
import os
from pathlib import Path

MEMORY_FILE = Path(__file__).parent / "rag_memory.json"


STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "to", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now",
    "what", "tell", "show", "give", "please", "me", "my", "i", "you", "your", "it", "this"
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r'\b\w+\b', text.lower())
    filtered = [w for w in words if w not in STOPWORDS and len(w) > 1]
    return filtered if filtered else words   # fallback to all words if query is only stopwords


def _tfidf_vector(tokens: list[str], vocab: dict) -> list[float]:
    freq = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    vec = [0.0] * len(vocab)
    for term, idx in vocab.items():
        tf = freq.get(term, 0) / max(len(tokens), 1)
        vec[idx] = tf
    return vec


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na  = math.sqrt(sum(x * x for x in a))
    nb  = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class RAGMemory:
    """
    Stores past Q&A pairs. On each new query, retrieves the top-k most similar
    past exchanges (excluding downvoted/wrong responses) and injects them as context into the prompt.
    """
    def __init__(self, max_entries: int = 200):
        self.max_entries = max_entries
        self.entries: list[dict] = []   # [{query, response, version, topic, user_id, conversation_id, rating}]
        self._load()

    def _load(self):
        if MEMORY_FILE.exists():
            try:
                self.entries = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
            except Exception:
                self.entries = []

    def _save(self):
        try:
            MEMORY_FILE.write_text(
                json.dumps(self.entries[-self.max_entries:], ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
        except Exception:
            pass

    def add(self, query: str, response: str, version: str = "1.0", topic: str = "general",
            user_id: str = "anonymous", conversation_id: float = None):
        self.entries.append({
            "query": query,
            "response": response[:500],   # cap size
            "version": version,
            "topic": topic,
            "user_id": str(user_id),
            "conversation_id": conversation_id,
            "rating": None
        })
        if len(self.entries) > self.max_entries:
            self.entries = self.entries[-self.max_entries:]
        self._save()

    def update_feedback(self, conversation_id: int, rating: str, query: str = None):
        """Update rating for a conversation. If rating is 'down', prune matching entries so wrong answers are not fed into context."""
        updated = False
        target_queries = set()
        if query:
            target_queries.add(query.strip().lower())

        for e in self.entries:
            if conversation_id is not None and e.get("conversation_id") == conversation_id:
                e["rating"] = rating
                updated = True
                if e.get("query"):
                    target_queries.add(e["query"].strip().lower())

        if rating == "down":
            def is_bad(e):
                if e.get("rating") == "down":
                    return True
                if conversation_id is not None and e.get("conversation_id") == conversation_id:
                    return True
                eq = (e.get("query") or "").strip().lower()
                if eq in target_queries:
                    return True
                for tq in target_queries:
                    if tq and len(tq) > 3 and (tq in eq or eq in tq):
                        return True
                return False

            orig_len = len(self.entries)
            self.entries = [e for e in self.entries if not is_bad(e)]
            if len(self.entries) != orig_len:
                updated = True

        if updated:
            self._save()

    def retrieve(self, query: str, top_k: int = 3, min_score: float = 0.25, user_id: str = "anonymous") -> list[dict]:
        # Exclude downvoted, error, or unhelpful responses
        entries = [
            e for e in self.entries
            if e.get("rating") != "down"
            and not (e.get("response") or "").startswith("Error:")
            and (str(e.get("user_id", "anonymous")) == str(user_id) or str(e.get("user_id", "")) in ("anonymous", ""))
        ]
        if not entries:
            return []

        # Build vocabulary from all stored queries
        all_tokens = []
        for e in entries:
            all_tokens.extend(_tokenize(e["query"]))
        vocab = {t: i for i, t in enumerate(sorted(set(all_tokens)))}

        if not vocab:
            return []

        q_tokens = _tokenize(query)
        q_vec    = _tfidf_vector(q_tokens, vocab)

        scored = []
        for e in entries:
            e_tokens = _tokenize(e["query"])
            e_vec    = _tfidf_vector(e_tokens, vocab)
            score    = _cosine(q_vec, e_vec)
            if score >= min_score:
                scored.append((score, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:top_k]]

    def build_context(self, query: str, user_id: str = "anonymous") -> str:
        """Return a formatted context string of similar past exchanges."""
        similar = self.retrieve(query, user_id=user_id)
        if not similar:
            return ""
        lines = ["Relevant past conversations (for context):"]
        for e in similar:
            lines.append(f"Q: {e['query']}")
            lines.append(f"A: {e['response'][:200]}")
            lines.append("")
        return "\n".join(lines)

    def clear(self):
        self.entries = []
        self._save()


# Singleton
_rag = None

def get_rag() -> RAGMemory:
    global _rag
    if _rag is None:
        _rag = RAGMemory()
    return _rag
