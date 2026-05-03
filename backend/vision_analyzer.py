"""Vision-based topology diagram analyzer.
Supports: DashScope Qwen-VL (image→text) + DeepSeek (text→structured JSON),
          Anthropic Claude (native vision), OpenAI GPT-4o (native vision).
"""
import base64
import io
import json
import os
import re
from typing import Dict, Any, Tuple, Optional

from dotenv import load_dotenv
load_dotenv()

VISION_PROVIDER = os.getenv("VISION_PROVIDER", "dashscope").lower()
VISION_MODEL = os.getenv("VISION_MODEL", "qwen-vl-max")

_IMAGE_DESCRIBE_PROMPT = """请详细描述这张网络拓扑图。

列出图中所有信息：
1. 每个设备的名称/标注文字、设备类型（路由器/交换机/防火墙/PC/服务器/AP/AC等）、品牌型号（如能看到）
2. 设备之间的连线关系，谁连到谁
3. 端口标注、VLAN ID、IP 地址、网段等文字信息
4. 安全区域的划分（如 DMZ、内网、外网等标注）
5. 任何其他可见的文字、符号、图例

请用中文详细输出，不要遗漏任何细节。"""

_ANALYSIS_SYSTEM_PROMPT = """你是一位资深网络架构师。你的任务是根据网络拓扑图的文字描述进行完整分析。

## 输出格式（严格遵守JSON，不要包含其他文字）

{
  "extracted_topology": {
    "nodes": {
      "<device_key>": {
        "label": "设备名称（图中标注的实际名称）",
        "category": "router|switch|firewall|terminal|wireless|other",
        "role": "router|core|access|security|endpoint|wireless",
        "vendor": "Huawei|Cisco|H3C|Juniper|Ruijie|ZTE|unknown（如能识别品牌）",
        "zone": "安全区域（外部网络|DMZ区|内部网络|管理区|终端区|无线区）",
        "model": "设备型号（图中标注的，如无法识别填'unknown'）",
        "description": "设备功能描述"
      }
    },
    "links": [
      {
        "from": "源设备key",
        "to": "目标设备key",
        "fromPort": "源端口名（根据设备类型推测：交换机GE0/0/x，路由器GE0/0/x，防火墙GE0/0/x，PC用ETH0）",
        "toPort": "目标端口名",
        "mode": "trunk|access",
        "linkLabel": "链路描述（含可见的IP地址/VLAN信息）",
        "bandwidth": "链路带宽（如标注）"
      }
    ]
  },
  "analysis_report": {
    "topology_overview": "拓扑总览：整体架构描述。包含：1)网络规模（设备数量、类型分布）2)区域划分概况 3)整体架构特点。面向非技术客户，用通俗语言解释。",
    "security_architecture": "安全架构分析：1)安全区域划分逻辑 2)各区域间的防护策略 3)防火墙/安全设备的部署位置和合理性 4)安全边界在哪里。解释为什么这样划分。",
    "redundancy_ha": "冗余与高可用分析：1)关键链路是否有备份 2)是否存在单点故障 3)设备冗余情况 4)故障切换能力。用通俗语言说明可靠性。",
    "traffic_flow": "流量路径分析：1)外部访问内部的典型路径 2)DMZ区域流量走向 3)跨区域流量如何流动 4)关键业务流量的路径。",
    "config_recommendations": "配置建议：1)VLAN规划建议 2)STP部署建议 3)路由协议选择建议 4)ACL/安全策略要点 5)管理IP规划建议。给出具体可执行的配置方向。",
    "risk_notes": "风险提示：1)潜在安全薄弱环节 2)配置注意事项 3)建议改进方向 4)运维关注点。"
  }
}

## 分析要求

1. **设备识别**：仔细分析描述中的每个设备。设备key用有意义的名字（如 core_switch_1, fw_internet_1, router_dmz_1, server_web_1）
2. **设备类型判断**：router=路由器，switch=交换机，firewall=防火墙，terminal=PC/服务器/打印机，wireless=AP/AC
3. **角色判断**：core=核心层设备，access=接入层设备，router=路由设备，security=安全设备，endpoint=终端，wireless=无线设备
4. **安全区域**：根据描述中的文字标注和设备位置判断区域（互联网侧=外部网络，防火墙之间=DMZ区，核心交换机后=内部网络，管理用=管理区，办公区=终端区）
5. **连线mode判断**：交换机之间或交换机与路由器之间=trunk，终端设备连接=access，防火墙互联=trunk
6. **端口命名**：优先使用描述中标注的端口名。如无标注，则交换机用GE0/0/x，路由器用GE0/0/x，防火墙用GE1/0/x，PC/服务器用ETH0
7. **IP地址**：如果描述中标注了IP地址，在linkLabel中记录（如"192.168.1.0/24"）
8. **分析报告**：面向非技术客户，用通俗易懂的中文解释每个设计决策的"为什么"，避免纯技术术语
9. **务虚谨慎**：对于描述中模糊无法确定的信息，标注为"unknown"或给出合理推测并注明

请直接输出JSON，不要包含其他任何文字。"""


def _get_dashscope_client():
    """Initialize DashScope OpenAI-compatible client for Qwen-VL."""
    from openai import OpenAI
    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY 未配置，请在 .env 文件中设置。获取地址: https://dashscope.aliyun.com")
    base_url = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    return OpenAI(api_key=api_key, base_url=base_url)


def _get_deepseek_client():
    """Initialize DeepSeek client for text analysis."""
    from openai import OpenAI
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    return OpenAI(api_key=api_key, base_url=base_url)


def _get_anthropic_client():
    """Initialize Anthropic client for Claude vision."""
    import anthropic
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY 未配置，请在 .env 文件中设置")
    return anthropic.Anthropic(api_key=api_key)


def _resize_if_needed(image_bytes: bytes, max_size_mb: float = 5.0) -> bytes:
    """Resize image proportionally if it exceeds max_size_mb."""
    max_bytes = int(max_size_mb * 1024 * 1024)
    if len(image_bytes) <= max_bytes:
        return image_bytes

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        ratio = (max_bytes / len(image_bytes)) ** 0.5
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        img_format = img.format or "JPEG"
        img.save(buf, format=img_format, optimize=True)
        return buf.getvalue()
    except Exception:
        return image_bytes


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".bmp": "image/bmp",
        ".webp": "image/webp", ".gif": "image/gif",
    }.get(ext, "image/png")


def _parse_vision_response(raw_text: str) -> Dict[str, Any]:
    """Multi-strategy JSON parser for vision model responses."""
    text = raw_text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass

    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    try:
        fixed = re.sub(r',\s*}', '}', text)
        fixed = re.sub(r',\s*]', ']', fixed)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    raise ValueError(f"无法解析视觉模型返回的JSON。原始响应前500字符: {text[:500]}")


def _validate_topology(extracted: dict) -> Tuple[bool, list]:
    """Validate extracted topology. Returns (is_valid, warnings)."""
    warnings = []
    nodes = extracted.get("nodes", {})
    links = extracted.get("links", [])

    if not nodes:
        return False, ["拓扑中没有识别到任何设备"]

    valid_categories = {"router", "switch", "firewall", "terminal", "wireless", "other"}
    valid_roles = {"router", "core", "access", "security", "endpoint", "wireless"}
    for key, node in nodes.items():
        cat = node.get("category", "")
        if cat not in valid_categories:
            warnings.append(f"设备 '{key}' 的类型 '{cat}' 不在标准类型中，已标记为 'other'")
            node["category"] = "other"
        role = node.get("role", "")
        if role not in valid_roles:
            node["role"] = "endpoint"

    node_keys = set(nodes.keys())
    for i, link in enumerate(links):
        frm = link.get("from", "")
        to = link.get("to", "")
        if frm and frm not in node_keys:
            warnings.append(f"链路 #{i}: 源设备 '{frm}' 在节点列表中不存在")
        if to and to not in node_keys:
            warnings.append(f"链路 #{i}: 目标设备 '{to}' 在节点列表中不存在")
        if not link.get("mode"):
            link["mode"] = "access"
        if not link.get("fromPort"):
            link["fromPort"] = "GE0/0/1"
        if not link.get("toPort"):
            link["toPort"] = "GE0/0/1"

    return len(warnings) < 5, warnings


def _describe_image_with_qwen(image_b64: str, mime_type: str) -> str:
    """Step 1: Use Qwen-VL to describe the topology image in text."""
    client = _get_dashscope_client()
    data_uri = f"data:{mime_type};base64,{image_b64}"

    response = client.chat.completions.create(
        model=VISION_MODEL,
        max_tokens=2048,
        temperature=0.1,
        timeout=120,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_uri}},
                {"type": "text", "text": _IMAGE_DESCRIBE_PROMPT},
            ],
        }],
    )
    return response.choices[0].message.content.strip()


def _analyze_description_with_deepseek(description: str, preferred_vendor: str) -> str:
    """Step 2: Use DeepSeek to convert text description into structured JSON."""
    client = _get_deepseek_client()

    user_prompt = (
        f"以下是一张网络拓扑图的文字描述，请根据描述输出分析JSON。\n\n"
        f"=== 拓扑图描述 ===\n{description}\n=== 描述结束 ===\n\n"
        f"假设图中设备厂商为 {preferred_vendor}（如无法识别则标注unknown）。\n"
        f"请严格按照JSON格式输出分析结果。"
    )

    response = client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=16000,
        temperature=0.2,
        timeout=120,
        messages=[
            {"role": "system", "content": _ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content.strip()


def _analyze_with_anthropic(image_b64: str, mime_type: str, preferred_vendor: str) -> str:
    """Native Anthropic Claude vision analysis (single-step)."""
    client = _get_anthropic_client()
    message = client.messages.create(
        model=VISION_MODEL,
        max_tokens=16000,
        temperature=0.2,
        system=_ANALYSIS_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime_type,
                        "data": image_b64,
                    },
                },
                {
                    "type": "text",
                    "text": f"请分析这张网络拓扑图。假设图中设备厂商为 {preferred_vendor}（如无法识别则标注unknown）。请严格按照JSON格式输出分析结果。",
                },
            ],
        }],
    )
    return message.content[0].text


def _analyze_with_openai(image_b64: str, mime_type: str, preferred_vendor: str) -> str:
    """Native OpenAI GPT-4o vision analysis (single-step)."""
    from openai import OpenAI
    api_key = os.getenv("OPENAI_VISION_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_VISION_API_KEY 未配置")
    client = OpenAI(api_key=api_key)
    data_uri = f"data:{mime_type};base64,{image_b64}"

    response = client.chat.completions.create(
        model=VISION_MODEL,
        max_tokens=16000,
        temperature=0.2,
        messages=[{
            "role": "system",
            "content": _ANALYSIS_SYSTEM_PROMPT,
        }, {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_uri, "detail": "high"}},
                {"type": "text", "text": f"请分析这张网络拓扑图。假设图中设备厂商为 {preferred_vendor}（如无法识别则标注unknown）。"},
            ],
        }],
    )
    return response.choices[0].message.content.strip()


def analyze_topology_image(
    image_bytes: bytes,
    filename: str = "topology.png",
    preferred_vendor: str = "Huawei"
) -> Dict[str, Any]:
    """Analyze a network topology diagram image using vision AI.

    Two pipeline modes:
      - dashscope (default): Qwen-VL describes image → DeepSeek produces structured JSON
      - anthropic / openai: single-step native vision analysis

    Args:
        image_bytes: Raw image file bytes
        filename: Original filename (for MIME type detection)
        preferred_vendor: Preferred equipment vendor for config generation

    Returns:
        {
            "extracted_topology": {"nodes": {...}, "links": [...]},
            "analysis_report": {...},
            "warnings": [...]
        }
    """
    image_bytes = _resize_if_needed(image_bytes, max_size_mb=2.0)
    mime_type = _get_mime_type(filename)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    if VISION_PROVIDER == "dashscope":
        # Two-step pipeline: Qwen-VL → DeepSeek
        description = _describe_image_with_qwen(image_b64, mime_type)
        raw_text = _analyze_description_with_deepseek(description, preferred_vendor)

    elif VISION_PROVIDER == "anthropic":
        raw_text = _analyze_with_anthropic(image_b64, mime_type, preferred_vendor)

    elif VISION_PROVIDER == "openai":
        raw_text = _analyze_with_openai(image_b64, mime_type, preferred_vendor)

    else:
        raise ValueError(
            f"不支持的 VISION_PROVIDER: '{VISION_PROVIDER}'。\n"
            f"请设置为 dashscope（推荐，国内可用）、anthropic 或 openai。\n"
            f"在 .env 中修改 VISION_PROVIDER=dashscope 并配置 DASHSCOPE_API_KEY"
        )

    result = _parse_vision_response(raw_text)

    topo = result.get("extracted_topology", {})
    is_valid, warnings = _validate_topology(topo)
    if not is_valid and not topo.get("nodes"):
        raise ValueError(f"拓扑图分析失败：{'; '.join(warnings)}")

    return {
        "extracted_topology": topo,
        "analysis_report": result.get("analysis_report", {}),
        "warnings": warnings,
        "raw_response": raw_text,
    }
