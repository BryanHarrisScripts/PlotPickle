"""PlotPickle local curriculum retrieval service.

The service intentionally stays CPU-resident so the active text, image and video
workflows can own the GPU. It uses Qwen3-Embedding-0.6B for first-pass semantic
retrieval and Qwen3-Reranker-0.6B for the final ordering. The browser never sends
all 81 modules to the generation model; only the bounded ranked passages returned
by this service are assembled into the GUIDE prompt.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import numpy as np
from sentence_transformers import CrossEncoder, SentenceTransformer

HOST = os.environ.get("PLOTPICKLE_RAG_HOST", "127.0.0.1")
PORT = int(os.environ.get("PLOTPICKLE_RAG_PORT", "8091"))
EMBEDDING_MODEL_ID = os.environ.get(
    "PLOTPICKLE_EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B"
)
RERANKER_MODEL_ID = os.environ.get(
    "PLOTPICKLE_RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B"
)
MAX_DOCUMENTS = 4096
MAX_DOCUMENT_CHARACTERS = 1800
MAX_QUERY_CHARACTERS = 2000

_embedding_model: SentenceTransformer | None = None
_reranker_model: CrossEncoder | None = None


def embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_ID, device="cpu")
    return _embedding_model


def reranker_model() -> CrossEncoder:
    global _reranker_model
    if _reranker_model is None:
        _reranker_model = CrossEncoder(RERANKER_MODEL_ID, device="cpu")
    return _reranker_model


def normalized_documents(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    documents: list[dict[str, str]] = []
    for item in value[:MAX_DOCUMENTS]:
        if not isinstance(item, dict):
            continue
        document_id = item.get("id")
        text = item.get("text")
        if not isinstance(document_id, str) or not isinstance(text, str):
            continue
        document_id = document_id.strip()[:300]
        text = " ".join(text.split())[:MAX_DOCUMENT_CHARACTERS]
        if document_id and text:
            documents.append({"id": document_id, "text": text})
    return documents


def cosine_scores(query: np.ndarray, documents: np.ndarray) -> np.ndarray:
    query_norm = np.linalg.norm(query)
    document_norms = np.linalg.norm(documents, axis=1)
    denominator = np.maximum(document_norms * query_norm, 1e-12)
    return (documents @ query) / denominator


def retrieve(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()[:MAX_QUERY_CHARACTERS]
    documents = normalized_documents(payload.get("documents"))
    top_k = max(1, min(32, int(payload.get("topK") or 12)))
    candidate_k = max(top_k, min(96, int(payload.get("candidateK") or max(32, top_k * 4))))
    if not query:
        raise ValueError("A retrieval query is required.")
    if not documents:
        raise ValueError("At least one curriculum passage is required.")

    embedder = embedding_model()
    document_texts = [item["text"] for item in documents]
    query_embedding = np.asarray(
        embedder.encode([query], normalize_embeddings=True, convert_to_numpy=True)[0],
        dtype=np.float32,
    )
    document_embeddings = np.asarray(
        embedder.encode(
            document_texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            batch_size=16,
            show_progress_bar=False,
        ),
        dtype=np.float32,
    )
    semantic_scores = cosine_scores(query_embedding, document_embeddings)
    candidate_indexes = np.argsort(-semantic_scores)[:candidate_k].tolist()

    candidate_documents = [documents[index] for index in candidate_indexes]
    pairs = [(query, item["text"]) for item in candidate_documents]
    rerank_scores = np.asarray(reranker_model().predict(pairs), dtype=np.float32).reshape(-1)
    reranked_order = np.argsort(-rerank_scores)[:top_k].tolist()

    results = []
    for rank, candidate_position in enumerate(reranked_order, start=1):
        source_index = candidate_indexes[candidate_position]
        document = documents[source_index]
        results.append(
            {
                "id": document["id"],
                "rank": rank,
                "embeddingScore": float(semantic_scores[source_index]),
                "rerankScore": float(rerank_scores[candidate_position]),
            }
        )
    return {
        "ok": True,
        "embeddingModel": EMBEDDING_MODEL_ID,
        "rerankerModel": RERANKER_MODEL_ID,
        "device": "cpu",
        "results": results,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "PlotPickleCurriculumRAG/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, status: int, value: dict[str, Any]) -> None:
        data = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_json(404, {"ok": False, "message": "Not found."})
            return
        self.send_json(
            200,
            {
                "ok": True,
                "embeddingModel": EMBEDDING_MODEL_ID,
                "rerankerModel": RERANKER_MODEL_ID,
                "device": "cpu",
                "modelsLoaded": {
                    "embedding": _embedding_model is not None,
                    "reranker": _reranker_model is not None,
                },
            },
        )

    def do_POST(self) -> None:
        if self.path != "/retrieve":
            self.send_json(404, {"ok": False, "message": "Not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 8 * 1024 * 1024:
                raise ValueError("The retrieval request size is invalid.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("The retrieval payload must be an object.")
            self.send_json(200, retrieve(payload))
        except Exception as error:  # noqa: BLE001 - boundary reports a clean local error
            self.send_json(400, {"ok": False, "message": str(error)[:500]})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"PlotPickle curriculum RAG listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
