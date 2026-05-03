import json
import os
from openai import OpenAI
from fastapi.responses import StreamingResponse
from prompts import CHAT_SYSTEM_PROMPT, VENDOR_STYLES

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com"
        )
    return _client


def build_system_prompt(topology, vendor, configs):
    vendor = vendor.capitalize()
    style = VENDOR_STYLES.get(vendor, VENDOR_STYLES["default"])
    topo_str = json.dumps(topology, ensure_ascii=False, indent=2)
    configs_str = json.dumps(configs, ensure_ascii=False, indent=2) if configs else "尚未生成配置"
    return CHAT_SYSTEM_PROMPT.format(
        topology_context=topo_str,
        vendor=vendor,
        style=style,
        configs_context=configs_str,
    )


async def stream_chat(messages: list, topology: dict, vendor: str, configs: dict):
    system_prompt = build_system_prompt(topology, vendor, configs)
    api_messages = [{"role": "system", "content": system_prompt}] + messages

    response = _get_client().chat.completions.create(
        model="deepseek-v4-pro",
        messages=api_messages,
        temperature=0.3,
        max_tokens=2048,
        stream=True,
    )

    for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            yield f"data: {json.dumps({'token': delta.content})}\n\n"

    yield "data: [DONE]\n\n"
