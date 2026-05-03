import os
import json
from dotenv import load_dotenv
load_dotenv()  # 必须在导入 openai 之前加载 .env

import asyncio
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn

from config_generator import generate_config, _get_client
from prompts import CHAT_SYSTEM_PROMPT, VENDOR_STYLES
from kb_engine import (
    search as kb_search, list_vendors, get_vendor_categories, get_category_commands,
    generate_config_from_kb as kb_generate, validate_cli_command,
)
from vision_analyzer import analyze_topology_image

app = FastAPI(title="Network Config Generator")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Models ----
class TopologyRequest(BaseModel):
    topology: dict
    vendor: str = "Huawei"
    globalSettings: dict = None

class ChatRequest(BaseModel):
    messages: list
    topology: dict
    vendor: str = "Huawei"
    configs: dict = {}

# ---- Routes ----
@app.post("/api/generate")
async def api_generate(request: TopologyRequest):
    try:
        config = generate_config(request.topology, request.vendor, global_settings=request.globalSettings)
        return {"status": "success", "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate/kb")
async def api_generate_kb(request: TopologyRequest):
    """KB-only config generation (works offline, no AI call)."""
    try:
        config = kb_generate(request.topology, request.vendor, request.globalSettings)
        return {"status": "success", "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/stream")
async def api_chat_stream(request: ChatRequest):
    vendor = request.vendor.capitalize()
    style = VENDOR_STYLES.get(vendor, VENDOR_STYLES["default"])
    topo_str = json.dumps(request.topology, ensure_ascii=False, indent=2)
    configs_str = json.dumps(request.configs, ensure_ascii=False, indent=2) if request.configs else "尚未生成配置"
    system_prompt = CHAT_SYSTEM_PROMPT.format(
        topology_context=topo_str, vendor=vendor, style=style, configs_context=configs_str,
    )

    api_messages = [{"role": "system", "content": system_prompt}] + request.messages

    async def generate():
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

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ---- Topology Image Analysis ----
@app.post("/api/analyze/topology-image")
async def api_analyze_topology_image(
    file: UploadFile = File(...),
    vendor: str = Form("Huawei"),
    generate_configs: bool = Form(True),
):
    """Upload a network topology diagram image for AI analysis.

    Accepts: jpg, jpeg, png, bmp, webp (max ~20MB in practice)
    Returns: extracted topology, analysis report, and optionally auto-generated configs.
    Time: typically 10-30 seconds depending on image complexity.
    """
    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/bmp", "image/webp", "image/gif"}
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}，仅支持 JPG/PNG/BMP/WebP")

    # Read file
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "上传的文件为空")
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "图片大小不能超过 20MB")

    try:
        # Run vision analysis in thread to avoid blocking (run_in_executor for Py3.8 compat)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: analyze_topology_image(image_bytes, file.filename or "topology.png", vendor)
        )
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"视觉分析失败: {str(e)}")

    response = {
        "status": "success",
        "extracted_topology": result["extracted_topology"],
        "analysis_report": result["analysis_report"],
        "warnings": result.get("warnings", []),
    }

    # Auto-generate configs if requested
    if generate_configs and result["extracted_topology"].get("nodes"):
        try:
            configs = generate_config(result["extracted_topology"], vendor, use_ai_fallback=False)
            response["configs"] = configs
        except Exception as e:
            response["configs"] = {}
            response["config_error"] = str(e)

    return response

# ---- Knowledge Base API ----
@app.get("/api/kb/search")
async def api_kb_search(q: str = "", vendor: str = "all", category: str = "all"):
    return kb_search(q, vendor, category)

@app.get("/api/kb/vendors")
async def api_kb_vendors():
    return {"vendors": list_vendors()}

@app.get("/api/kb/categories")
async def api_kb_categories(vendor: str = "Huawei"):
    return get_vendor_categories(vendor)

@app.get("/api/kb/commands")
async def api_kb_commands(vendor: str = "Huawei", category: str = "vlan"):
    return get_category_commands(vendor, category)

# ---- CLI Validation ----
class CliValidateRequest(BaseModel):
    command: str
    vendor: str = "Huawei"
    mode: str = "user"  # user, system, interface, vlan, ospf
    device_context: dict = {}

@app.post("/api/cli/validate")
async def api_cli_validate(request: CliValidateRequest):
    """Validate a CLI command against the knowledge base."""
    try:
        result = validate_cli_command(request.command, request.vendor, request.mode)
        return result
    except Exception as e:
        return {"valid": True, "response": "", "suggested_fix": None, "help_text": str(e)}

# 开发模式：如果存在前端构建，直接服务静态文件
if os.path.exists("../frontend/dist"):
    app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5732, reload=False)
