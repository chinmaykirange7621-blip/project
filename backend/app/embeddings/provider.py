from abc import ABC, abstractmethod
import hashlib
import math
import re
from google import genai
from google.genai import types
from app.utils.config import get_settings


SYNONYM_GROUPS: list[set[str]] = [
    {"btech", "b.tech", "be", "b.e", "engineering", "technical", "cse", "aiml", "ai", "ml", "computer", "ug", "undergraduate"},
    {"mtech", "m.tech", "me", "pg", "postgraduate", "masters"},
    {"income", "salary", "annual", "family", "ews", "poor", "economically", "low-income", "need", "means"},
    {"lakh", "lakhs", "lac", "lpa"},
    {"girl", "girls", "female", "women", "woman", "pragati", "kanya"},
    {"pwd", "disability", "disabled", "specially-abled", "differently-abled", "handicapped", "saksham", "udid"},
    {"sc", "scheduled", "caste", "dalit"},
    {"st", "tribe", "tribal"},
    {"obc", "ebc", "dnt", "backward"},
    {"minority", "minorities", "muslim", "christian", "sikh", "buddhist", "jain", "parsi"},
    {"nsp", "national", "central", "government", "govt", "portal"},
    {"merit", "marks", "percentage", "cgpa", "gpa", "score", "topper", "80th"},
    {"documents", "document", "certificate", "marksheet", "bonafide", "passbook", "domicile", "proof"},
    {"deadline", "date", "last", "apply", "closing", "application", "portal"},
]


def expand_synonyms(tokens: list[str]) -> list[str]:
    expanded = list(tokens)
    token_set = set(tokens)
    for group in SYNONYM_GROUPS:
        if token_set & group:
            for term in group:
                if term not in token_set:
                    expanded.append(term)
    return expanded


def tokenize_text(text: str) -> list[str]:
    cleaned = text.lower().replace("&", " ").replace("/", " ")
    raw_tokens = re.findall(r"[a-z0-9.]+", cleaned)
    return [t.strip(".") for t in raw_tokens if t.strip(".")]


class EmbeddingProvider(ABC):
    mode_name: str
    dimension: int

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        ...

    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        ...


class DemoEmbeddingProvider(EmbeddingProvider):
    """Deterministic local semantic-hash embedding provider for Demo Mode."""

    mode_name = "demo"
    dimension = 384

    def _embed_one(self, text: str, is_query: bool = False) -> list[float]:
        vec = [0.0] * self.dimension
        tokens = tokenize_text(text)
        if not tokens:
            vec[0] = 1.0
            return vec

        expanded = expand_synonyms(tokens)
        # Word unigrams + bigrams + character 4-grams
        features: list[tuple[str, float]] = []
        for tok in tokens:
            features.append((f"w:{tok}", 2.0))
            if len(tok) >= 4:
                for i in range(len(tok) - 3):
                    features.append((f"c:{tok[i:i+4]}", 0.5))
        for i in range(len(tokens) - 1):
            features.append((f"b:{tokens[i]}_{tokens[i+1]}", 1.5))
        for syn in expanded[len(tokens):]:
            features.append((f"s:{syn}", 0.85 if is_query else 0.7))

        for feat, weight in features:
            digest = hashlib.sha256(feat.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "little") % self.dimension
            sign = 1.0 if (digest[4] & 1) == 0 else -1.0
            idx2 = int.from_bytes(digest[5:9], "little") % self.dimension
            sign2 = 1.0 if (digest[9] & 1) == 0 else -1.0
            vec[idx] += sign * weight
            vec[idx2] += sign2 * (weight * 0.5)

        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t, is_query=False) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_one(text, is_query=True)


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Google Gemini API embedding provider using official google-genai SDK."""

    mode_name = "gemini"
    dimension = 3072  # gemini-embedding-001 default output dimension

    def __init__(self, api_key: str, model_name: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            result = self.client.models.embed_content(
                model=self.model_name,
                contents=batch,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
            )
            for emb in result.embeddings:
                vectors.append(list(emb.values))
        if vectors:
            self.dimension = len(vectors[0])
        return vectors

    def embed_query(self, text: str) -> list[float]:
        result = self.client.models.embed_content(
            model=self.model_name,
            contents=text,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        values = list(result.embeddings[0].values)
        self.dimension = len(values)
        return values


def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()
    if settings.is_demo_mode:
        return DemoEmbeddingProvider()
    return GeminiEmbeddingProvider(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_embedding_model,
    )
