import json

import httpx
from app.ai.settings import AISettings

ENDPOINT = "https://api.openai.com/v1/responses"
TRANSIENT_STATUS = {408, 429, 500, 502, 503, 504}


class ProviderError(RuntimeError):
    def __init__(
        self, message: str, *, retryable: bool = False, retry_after: float = 0.3
    ):
        super().__init__(message)
        self.retryable = retryable
        self.retry_after = retry_after


def extract_output(body: object) -> str:
    if not isinstance(body, dict):
        raise ProviderError("Provider returned an invalid response envelope.")
    if body.get("status") != "completed":
        raise ProviderError(
            "Provider did not complete the response; check the output-token budget or provider status."
        )
    output = body.get("output")
    if not isinstance(output, list):
        raise ProviderError("Provider response contains no output list.")
    texts = []
    for item in output:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        content = item.get("content")
        if not isinstance(content, list):
            raise ProviderError("Provider returned malformed message content.")
        for part in content:
            if not isinstance(part, dict):
                raise ProviderError("Provider returned malformed content.")
            if part.get("type") == "refusal":
                raise ProviderError("Provider declined to generate this assessment.")
            if part.get("type") == "output_text" and isinstance(part.get("text"), str):
                texts.append(part["text"])
    if not texts:
        raise ProviderError("Provider returned no assessment text.")
    return "".join(texts)


class ResponsesProvider:
    def __init__(
        self, settings: AISettings, transport: httpx.AsyncBaseTransport | None = None
    ):
        self.settings = settings
        self.transport = transport

    async def generate(
        self, instructions: str, facts: dict, schema: dict, feedback: str | None = None
    ) -> str:
        input_data = {"scenario_evidence": facts}
        if feedback:
            input_data["validation_feedback"] = feedback
        payload = {
            "model": self.settings.model,
            "instructions": instructions,
            "input": [
                {
                    "role": "user",
                    "content": json.dumps(
                        input_data, ensure_ascii=False, allow_nan=False
                    ),
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "akim_grounded_analysis",
                    "strict": True,
                    "schema": schema,
                }
            },
            "max_output_tokens": self.settings.max_output_tokens,
            "store": False,
        }
        try:
            async with httpx.AsyncClient(
                transport=self.transport,
                timeout=httpx.Timeout(
                    self.settings.total_timeout,
                    connect=min(5.0, self.settings.total_timeout),
                ),
                follow_redirects=False,
            ) as client:
                response = await client.post(
                    ENDPOINT,
                    json=payload,
                    headers={
                        "Authorization": "Bearer " + self.settings.api_key,
                        "Accept": "application/json",
                    },
                )
        except httpx.RequestError:
            raise ProviderError(
                "Could not reach the AI provider.", retryable=True
            ) from None
        if response.status_code != 200:
            delay = 0.3
            try:
                delay = min(
                    1.0, max(0.0, float(response.headers.get("retry-after", "0.3")))
                )
            except ValueError:
                pass
            # Never include provider bodies or request headers in an exception or log.
            raise ProviderError(
                f"AI provider returned HTTP {response.status_code}; check credentials, access and quota.",
                retryable=response.status_code in TRANSIENT_STATUS,
                retry_after=delay,
            )
        try:
            body = response.json()
        except ValueError:
            raise ProviderError(
                "AI provider returned a non-JSON response envelope."
            ) from None
        return extract_output(body)
