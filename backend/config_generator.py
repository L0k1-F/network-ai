import json
import os
from openai import OpenAI
from prompts import VENDOR_STYLES, SYSTEM_PROMPT_TEMPLATE
from kb_engine import generate_config_from_kb

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com"
        )
    return _client

def _ai_generate(topology_json: dict, vendor: str) -> dict:
    """Call DeepSeek AI to generate configs."""
    vendor = vendor.capitalize()
    style = VENDOR_STYLES.get(vendor, VENDOR_STYLES["default"])
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(vendor=vendor, style=style)

    user_prompt = json.dumps(topology_json, ensure_ascii=False, indent=2)

    response = _get_client().chat.completions.create(
        model="deepseek-v4-pro",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,
        max_tokens=4096,
    )

    content = response.choices[0].message.content.strip()
    # Clean markdown code block
    if content.startswith("```"):
        lines = content.split('\n')
        content = '\n'.join(lines[1:-1])
    return json.loads(content)

def generate_config(topology_json: dict, vendor: str, use_ai_fallback: bool = True, global_settings: dict = None) -> dict:
    """Generate configurations. Tries KB template engine first, falls back to AI.

    Args:
        topology_json: The topology dict (nodes + links)
        vendor: Target vendor name
        use_ai_fallback: If True, fall back to AI when KB generates empty configs
        global_settings: Optional dict with ntpServers, snmpCommunity, adminUser, adminPassword, domainName, dnsServers
    """
    # Step 1: Try KB template engine (works offline)
    kb_configs = generate_config_from_kb(topology_json, vendor, global_settings)

    # If KB produces configs for ALL devices, return directly
    nodes = topology_json.get("nodes", {})
    if kb_configs and all(key in kb_configs for key in nodes):
        return kb_configs

    # Step 2: If some devices missing or no configs, and AI fallback enabled
    if use_ai_fallback:
        try:
            ai_configs = _ai_generate(topology_json, vendor)
            # Merge: KB configs as base, AI configs fill gaps
            merged = dict(kb_configs)
            for key, cmds in ai_configs.items():
                if key not in merged or not merged[key]:
                    merged[key] = cmds
            return merged
        except Exception:
            # If AI fails, return whatever KB produced
            if kb_configs:
                return kb_configs
            raise

    return kb_configs
