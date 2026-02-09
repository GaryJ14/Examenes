# ============================================
# Aplicaciones/examenes/llm_client.py
# ============================================
from django.conf import settings
import httpx
import json
from typing import Any, Dict, List


class LLMClient:
    def __init__(self):
        self.api_key = getattr(settings, "LLM_API_KEY", "")
        self.base_url = getattr(settings, "LLM_BASE_URL", "").rstrip("/")
        self.model = getattr(settings, "LLM_MODEL", "")
        fb = getattr(settings, "LLM_FALLBACK_MODELS", "")
        self.fallback_models: List[str] = [m.strip() for m in fb.split(",") if m.strip()]

        if not self.api_key:
            raise RuntimeError("LLM_API_KEY no configurada.")
        if not self.base_url:
            raise RuntimeError("LLM_BASE_URL no configurada.")
        if not self.model:
            raise RuntimeError("LLM_MODEL no configurada.")

        self.timeout = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)

    def _headers(self) -> Dict[str, str]:
        h = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        if "openrouter.ai" in self.base_url:
            referer = getattr(settings, "OPENROUTER_REFERER", "")
            title = getattr(settings, "OPENROUTER_TITLE", "")
            if referer:
                h["HTTP-Referer"] = referer
            if title:
                h["X-Title"] = title
        return h

    def chat_text(self, user_prompt: str, temperature: float = 0.2, max_tokens: int = 2500) -> str:
        url = f"{self.base_url}/chat/completions"
        models = [self.model] + self.fallback_models

        body = {
            "models": models,
            "temperature": float(temperature),
            "max_tokens": int(max_tokens),
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Devuelve ÚNICAMENTE un JSON válido (RFC 8259). "
                        "No uses YAML, no uses markdown, no escribas texto fuera del JSON. "
                        "Debes iniciar con '{' y terminar con '}'."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            "reasoning": {"effort": "minimal", "exclude": True},
            "provider": {"allow_fallbacks": True, "sort": "throughput"},
        }

        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(url, headers=self._headers(), json=body)

        if r.status_code < 200 or r.status_code >= 300:
            raise RuntimeError(f"LLM HTTP {r.status_code}: {r.text[:900]}")

        data = r.json()

        if isinstance(data, dict) and "error" in data:
            raise RuntimeError(f"LLM error: {data['error']}")

        choices = data.get("choices")
        if not choices or not isinstance(choices, list):
            preview = json.dumps(data, ensure_ascii=False)[:900]
            raise RuntimeError(f"Respuesta sin choices. Preview: {preview}")

        c0 = choices[0] or {}
        if "error" in c0 and c0["error"]:
            raise RuntimeError(f"LLM choice error: {c0['error']}")

        msg = c0.get("message") or {}
        content = msg.get("content")

        if not content:
            preview = json.dumps(data, ensure_ascii=False)[:900]
            raise RuntimeError(f"Respuesta sin content. Preview: {preview}")

        return content

    def chat_json(self, user_prompt: str, temperature: float = 0.2, max_tokens: int = 2500) -> Dict[str, Any]:
        raw = self.chat_text(user_prompt, temperature=temperature, max_tokens=max_tokens)
        return json.loads(raw)
