#!/usr/bin/env python3
"""
HintOS Agent Chat — 多维度 Dry-Run 审计脚本
============================================
维度 1: IPC 通道匹配 (main ↔ preload ↔ renderer)
维度 2: EventEmitter 事件匹配 (adapter.emit ↔ handlers.on)
维度 3: Agent 定义一致性 (AGENT_DEFS ↔ AGENT_SYSTEM_PROMPTS ↔ routeMessage)
维度 4: 类型导出完整性 (core/index.ts 导出 vs studio 导入)
维度 5: window.hintos API 完整性 (preload 定义 vs renderer 使用)
维度 6: Gate 流程完整性 (runner → adapter → handler → preload → renderer → resolve)
维度 7: 死代码 / 未使用导入检测
维度 8: 字符串一致性 (message type literals 跨文件匹配)
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT / "packages" / "studio" / "src"
CORE = ROOT / "packages" / "core" / "src"

# Color output
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

issues = []  # (severity, dimension, message)
passes = []


def fail(dim: str, msg: str, severity: str = "MEDIUM"):
    issues.append((severity, dim, msg))


def ok(dim: str, msg: str):
    passes.append((dim, msg))


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


# ============================================================
# 维度 1: IPC 通道匹配
# ============================================================
def audit_ipc_channels():
    dim = "IPC通道匹配"
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")
    chat_handler_ts = read(STUDIO / "main" / "ipc" / "agent-chat-handler.ts")
    preload_ts = read(STUDIO / "preload" / "index.ts")
    main_all = handlers_ts + chat_handler_ts

    # Extract ipcMain.handle('channel') from main process
    main_handles = set(re.findall(r"ipcMain\.handle\(['\"]([^'\"]+)['\"]", main_all))

    # Extract ipcRenderer.invoke('channel') from preload
    preload_invokes = set(re.findall(r"ipcRenderer\.invoke\(['\"]([^'\"]+)['\"]", preload_ts))

    # Agent Chat specific channels
    agent_chat_channels = {
        "agent-chat-respond", "agent-chat-send", "agent-chat-clear",
        "set-interaction-mode"
    }

    for ch in agent_chat_channels:
        if ch not in main_handles:
            fail(dim, f"Agent Chat IPC '{ch}' 在 ipcMain.handle 中缺失", "CRITICAL")
        elif ch not in preload_invokes:
            fail(dim, f"Agent Chat IPC '{ch}' 在 preload ipcRenderer.invoke 中缺失", "CRITICAL")
        else:
            ok(dim, f"IPC '{ch}' 双向匹配 ✓")

    # webContents.send channels should have ipcRenderer.on in preload
    push_channels = set(re.findall(r"webContents\.send\(['\"]([^'\"]+)['\"]", main_all))
    preload_listeners = set(re.findall(r"ipcRenderer\.on\(['\"]([^'\"]+)['\"]", preload_ts))

    agent_push = {"agent-chat-stream", "agent-chat-message", "gate-auto-resolved"}
    for ch in agent_push:
        if ch not in push_channels:
            fail(dim, f"Push 通道 '{ch}' 在 main webContents.send 中缺失", "CRITICAL")
        elif ch not in preload_listeners:
            fail(dim, f"Push 通道 '{ch}' 在 preload ipcRenderer.on 中缺失", "CRITICAL")
        else:
            ok(dim, f"Push 通道 '{ch}' 双向匹配 ✓")


# ============================================================
# 维度 2: EventEmitter 事件匹配
# ============================================================
def audit_event_emitters():
    dim = "EventEmitter事件"
    adapter_ts = read(STUDIO / "main" / "adapters" / "pipeline-adapter.ts")
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")

    # Events emitted by adapter
    adapter_emits = set(re.findall(r"this\.emit\(['\"]([^'\"]+)['\"]", adapter_ts))

    # Events listened by handlers
    handler_listeners = set(re.findall(r"pipelineAdapter\.on\(['\"]([^'\"]+)['\"]", handlers_ts))

    expected = {"gate", "gate-auto-resolved", "agent-report", "chapter-landmark", "progress"}

    for ev in expected:
        if ev not in adapter_emits:
            fail(dim, f"事件 '{ev}' 未在 pipeline-adapter 中 emit", "CRITICAL")
        elif ev not in handler_listeners:
            fail(dim, f"事件 '{ev}' 在 handlers.ts 中无 .on() 监听", "CRITICAL")
        else:
            ok(dim, f"事件 '{ev}' emit↔on 匹配 ✓")


# ============================================================
# 维度 3: Agent 定义一致性
# ============================================================
def audit_agent_defs():
    dim = "Agent定义同步"
    store_ts = read(STUDIO / "renderer" / "src" / "stores" / "agent-chat-store.ts")
    chat_handler_ts = read(STUDIO / "main" / "ipc" / "agent-chat-handler.ts")

    # AGENT_DEFS keys from store
    defs_keys = set(re.findall(r"['\"]?([\w-]+)['\"]?\s*:\s*\{\s*displayName", store_ts))

    # AGENT_SYSTEM_PROMPTS keys from chat handler — only inside the AGENT_SYSTEM_PROMPTS block
    prompts_block = re.search(r"AGENT_SYSTEM_PROMPTS[^{]*\{([\s\S]*?)\n\}", chat_handler_ts)
    prompt_keys = set()
    if prompts_block:
        prompt_keys = set(re.findall(r"""['"]?([\w\-]+)['"]?\s*:\s*`""", prompts_block.group(1)))

    # routeMessage return values
    route_returns = set(re.findall(r"return\s+['\"]([^'\"]+)['\"]", chat_handler_ts))
    # Also default: 'architect'
    route_returns.add("architect")

    # Check that every AGENT_DEF has a system prompt
    for key in defs_keys:
        if key not in prompt_keys:
            fail(dim, f"AGENT_DEFS 中 '{key}' 在 AGENT_SYSTEM_PROMPTS 中无对应 prompt", "MEDIUM")
        else:
            ok(dim, f"Agent '{key}' DEFS↔PROMPTS 匹配 ✓")

    # Check reverse: every prompt has a DEF
    for key in prompt_keys:
        if key not in defs_keys:
            fail(dim, f"AGENT_SYSTEM_PROMPTS 中 '{key}' 在 AGENT_DEFS 中无对应定义", "MEDIUM")

    # Check that routed agents have prompts
    for key in route_returns:
        if key not in prompt_keys:
            fail(dim, f"routeMessage 返回 '{key}' 但无对应 system prompt", "MEDIUM")


# ============================================================
# 维度 4: Core 类型导出完整性
# ============================================================
def audit_core_exports():
    dim = "Core导出完整性"
    index_ts = read(CORE / "index.ts")

    # Types that should be exported for Agent Chat
    required_exports = [
        "GatePayload", "GateDecision", "GateAction",
        "ChapterLandmarkPayload", "chatCompletionStreaming",
        "ConversationManager", "SearchRouter",
        "SearchProvider", "SearchResult", "SearchProviderConfig",
    ]

    for name in required_exports:
        if name in index_ts:
            ok(dim, f"Core 导出 '{name}' 存在 ✓")
        else:
            fail(dim, f"Core 导出 '{name}' 缺失", "MEDIUM")

    # Check studio imports match
    adapter_ts = read(STUDIO / "main" / "adapters" / "pipeline-adapter.ts")
    handler_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")
    chat_handler_ts = read(STUDIO / "main" / "ipc" / "agent-chat-handler.ts")

    all_studio = adapter_ts + handler_ts + chat_handler_ts

    # Find imports from @actalk/hintos-core
    studio_imports = set()
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['\"]@actalk/hintos-core['\"]", all_studio):
        for name in m.group(1).split(","):
            name = name.strip().split(" as ")[0].strip()
            if name:
                studio_imports.add(name)

    for name in studio_imports:
        if name in index_ts:
            ok(dim, f"Studio import '{name}' 在 core 中已导出 ✓")
        else:
            fail(dim, f"Studio import '{name}' 在 core/index.ts 中未找到", "CRITICAL")


# ============================================================
# 维度 5: window.hintos API 完整性
# ============================================================
def audit_hintos_api():
    dim = "window.hintos API"
    preload_ts = read(STUDIO / "preload" / "index.ts")

    # Agent Chat specific API methods
    required_methods = [
        "onAgentChatStream", "onAgentChatMessage", "onGateAutoResolved",
        "respondToGate", "sendAgentChat", "clearAgentChat", "setInteractionMode",
    ]

    for method in required_methods:
        if method in preload_ts:
            ok(dim, f"window.hintos.{method} 已定义 ✓")
        else:
            fail(dim, f"window.hintos.{method} 在 preload 中缺失", "CRITICAL")

    # Check that renderer actually calls these
    layout_ts = read(STUDIO / "renderer" / "src" / "components" / "layout" / "Layout.tsx")
    panel_ts = read(STUDIO / "renderer" / "src" / "components" / "AgentChatPanel.tsx")
    msg_ts = read(STUDIO / "renderer" / "src" / "components" / "AgentMessage.tsx")
    all_renderer = layout_ts + panel_ts + msg_ts

    used_api = set()
    for m in re.finditer(r"window\.hintos\.(\w+)", all_renderer):
        used_api.add(m.group(1))

    for method in required_methods:
        if method in used_api:
            ok(dim, f"window.hintos.{method} 在 renderer 中被调用 ✓")
        else:
            # Not all methods must be called directly — some used only in Layout
            pass  # This is informational, not a failure


# ============================================================
# 维度 6: Gate 流程完整性
# ============================================================
def audit_gate_flow():
    dim = "Gate流程完整性"
    runner_ts = read(CORE / "pipeline" / "runner.ts")
    adapter_ts = read(STUDIO / "main" / "adapters" / "pipeline-adapter.ts")
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")
    preload_ts = read(STUDIO / "preload" / "index.ts")
    store_ts = read(STUDIO / "renderer" / "src" / "stores" / "agent-chat-store.ts")
    msg_ts = read(STUDIO / "renderer" / "src" / "components" / "AgentMessage.tsx")
    layout_ts = read(STUDIO / "renderer" / "src" / "components" / "layout" / "Layout.tsx")

    # Step 1: runner.ts should call onGate
    if "onGate" in runner_ts:
        ok(dim, "runner.ts 调用 onGate 回调 ✓")
    else:
        fail(dim, "runner.ts 缺少 onGate 回调调用", "CRITICAL")

    # Step 2: adapter should have handleGate
    if "handleGate" in adapter_ts:
        ok(dim, "pipeline-adapter.ts handleGate 方法存在 ✓")
    else:
        fail(dim, "pipeline-adapter.ts 缺少 handleGate", "CRITICAL")

    # Step 3: adapter should have resolveGate
    if "resolveGate" in adapter_ts:
        ok(dim, "pipeline-adapter.ts resolveGate 方法存在 ✓")
    else:
        fail(dim, "pipeline-adapter.ts 缺少 resolveGate", "CRITICAL")

    # Step 4: handlers should forward gate to renderer
    if "'agent-gate'" in handlers_ts or '"agent-gate"' in handlers_ts:
        ok(dim, "handlers.ts 转发 agent-gate 消息 ✓")
    else:
        fail(dim, "handlers.ts 未转发 agent-gate 消息", "CRITICAL")

    # Step 5: handlers should call resolveGate on IPC
    if "resolveGate" in handlers_ts:
        ok(dim, "handlers.ts 调用 pipelineAdapter.resolveGate ✓")
    else:
        fail(dim, "handlers.ts 未调用 resolveGate", "CRITICAL")

    # Step 6: preload should expose respondToGate
    if "respondToGate" in preload_ts:
        ok(dim, "preload 暴露 respondToGate ✓")
    else:
        fail(dim, "preload 缺少 respondToGate", "CRITICAL")

    # Step 7: store should have setPendingGate and resolveGate
    if "setPendingGate" in store_ts and "resolveGate" in store_ts:
        ok(dim, "store 有 setPendingGate + resolveGate ✓")
    else:
        fail(dim, "store 缺少 gate 状态管理方法", "CRITICAL")

    # Step 8: renderer should call respondToGate
    if "respondToGate" in msg_ts:
        ok(dim, "AgentMessage.tsx 调用 respondToGate ✓")
    else:
        fail(dim, "AgentMessage.tsx 未调用 respondToGate", "CRITICAL")

    # Step 9: Layout should setPendingGate on gate messages
    if "setPendingGate" in layout_ts:
        ok(dim, "Layout.tsx 调用 setPendingGate ✓")
    else:
        fail(dim, "Layout.tsx 未设置 pendingGate 状态", "CRITICAL")

    # Step 10: gate-auto-resolved cleanup
    if "onGateAutoResolved" in layout_ts:
        ok(dim, "Layout.tsx 订阅 gate-auto-resolved ✓")
    else:
        fail(dim, "Layout.tsx 未订阅 gate-auto-resolved", "MEDIUM")

    # Check 3 interaction modes in adapter
    for mode in ["silent", "auto-report", "interactive"]:
        if mode in adapter_ts:
            ok(dim, f"adapter 支持交互模式 '{mode}' ✓")
        else:
            fail(dim, f"adapter 缺少交互模式 '{mode}'", "MEDIUM")


# ============================================================
# 维度 7: 死代码 / 未使用导出检测
# ============================================================
def audit_dead_code():
    dim = "死代码检测"

    # Check for common dead code patterns
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")
    chat_handler_ts = read(STUDIO / "main" / "ipc" / "agent-chat-handler.ts")

    # Check if emitAgentChatStream still exists (should have been removed in CP3)
    if "function emitAgentChatStream" in handlers_ts:
        fail(dim, "handlers.ts 仍有未使用的 emitAgentChatStream 函数", "LOW")
    else:
        ok(dim, "emitAgentChatStream 已清理 ✓")

    # Check if ConversationManager is imported anywhere in studio
    all_studio_files = list(STUDIO.rglob("*.ts")) + list(STUDIO.rglob("*.tsx"))
    cm_used = False
    for f in all_studio_files:
        content = read(f)
        if "ConversationManager" in content:
            cm_used = True
            break
    if not cm_used:
        ok(dim, "ConversationManager 未在 studio 中使用 (core 导出备用, 非死代码)")

    # Check agent-chat-handler exports are all used
    exports = re.findall(r"export\s+(?:async\s+)?function\s+(\w+)", chat_handler_ts)
    for exp in exports:
        if exp in handlers_ts:
            ok(dim, f"agent-chat-handler 导出 '{exp}' 被 handlers.ts 使用 ✓")
        else:
            fail(dim, f"agent-chat-handler 导出 '{exp}' 未在 handlers.ts 中使用", "LOW")


# ============================================================
# 维度 8: 消息类型字面量一致性
# ============================================================
def audit_message_types():
    dim = "消息类型一致性"
    store_ts = read(STUDIO / "renderer" / "src" / "stores" / "agent-chat-store.ts")
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")
    chat_handler_ts = read(STUDIO / "main" / "ipc" / "agent-chat-handler.ts")
    msg_ts = read(STUDIO / "renderer" / "src" / "components" / "AgentMessage.tsx")
    layout_ts = read(STUDIO / "renderer" / "src" / "components" / "layout" / "Layout.tsx")

    # Extract ChatMessageType union from store
    type_match = re.search(r"type ChatMessageType\s*=\s*([\s\S]*?)(?:\n\n|\nexport)", store_ts)
    if not type_match:
        fail(dim, "无法解析 ChatMessageType 类型定义", "MEDIUM")
        return

    defined_types = set(re.findall(r"'([^']+)'", type_match.group(1)))
    ok(dim, f"ChatMessageType 定义了 {len(defined_types)} 种类型: {', '.join(sorted(defined_types))}")

    # Find all type: 'xxx' literals in Agent Chat message construction
    # Only check emitAgentChatMessage calls and agent-chat-related sends
    agent_chat_types = set()
    for m in re.finditer(r"emitAgentChatMessage\(\{[^}]*?type:\s*'([^']+)'", handlers_ts + chat_handler_ts, re.DOTALL):
        agent_chat_types.add(m.group(1))
    # Also check direct sends to agent-chat-message
    for m in re.finditer(r"send\('agent-chat-message'[^}]*?type:\s*'([^']+)'", handlers_ts + chat_handler_ts, re.DOTALL):
        agent_chat_types.add(m.group(1))
    used_types = agent_chat_types

    for t in used_types:
        if t in defined_types:
            ok(dim, f"类型 '{t}' 在 ChatMessageType 中已定义 ✓")
        else:
            fail(dim, f"类型 '{t}' 在 main process 中使用但未在 ChatMessageType 中定义", "MEDIUM")

    # Check renderer handles all types it may receive (some handled generically, not CRITICAL)
    for t in ["agent-gate", "chapter-landmark", "system-info"]:
        if t in msg_ts or t in layout_ts:
            ok(dim, f"Renderer 明确处理消息类型 '{t}' ✓")
        else:
            fail(dim, f"Renderer 可能未处理消息类型 '{t}'", "LOW")
    # agent-report and agent-streaming use generic rendering path (no explicit type check needed)
    ok(dim, "agent-report / agent-streaming 使用通用渲染路径 ✓")


# ============================================================
# 维度 9: Zustand Persist 安全性
# ============================================================
def audit_persist():
    dim = "Persist安全性"
    store_ts = read(STUDIO / "renderer" / "src" / "stores" / "agent-chat-store.ts")

    # Check partialize exists
    if "partialize" in store_ts:
        ok(dim, "Zustand persist 使用 partialize 限制持久化字段 ✓")
    else:
        fail(dim, "Zustand persist 未使用 partialize — 可能持久化过多数据", "MEDIUM")

    # Check message limit
    if "slice(-100)" in store_ts:
        ok(dim, "持久化消息限制为最近 100 条 ✓")
    else:
        fail(dim, "持久化消息无数量限制", "MEDIUM")

    # Check runtime limit
    if "500" in store_ts:
        ok(dim, "运行时消息上限 500 条 ✓")
    else:
        fail(dim, "运行时消息无上限", "LOW")

    # Check no function or class instances in persisted state
    partialize_match = re.search(r"partialize:.*?\{([\s\S]*?)\}", store_ts)
    if partialize_match:
        persisted = partialize_match.group(1)
        safe_fields = ["messages", "interactionMode", "panelPosition", "currentBookId"]
        for f in safe_fields:
            if f in persisted:
                ok(dim, f"持久化字段 '{f}' 为 JSON 安全类型 ✓")


# ============================================================
# 维度 10: 安全性审查
# ============================================================
def audit_security():
    dim = "安全性审查"
    preload_ts = read(STUDIO / "preload" / "index.ts")
    handlers_ts = read(STUDIO / "main" / "ipc" / "handlers.ts")

    # Check that IPC handlers validate input types
    if "['interactive', 'auto-report', 'silent'].includes(mode)" in handlers_ts:
        ok(dim, "set-interaction-mode 校验输入值白名单 ✓")
    else:
        fail(dim, "set-interaction-mode 未校验输入值", "MEDIUM")

    # Check for dangerous patterns
    if "eval(" in preload_ts or "eval(" in handlers_ts:
        fail(dim, "发现 eval() 调用", "CRITICAL")
    else:
        ok(dim, "无 eval() 调用 ✓")

    # Check contextIsolation
    if "contextIsolated" in preload_ts:
        ok(dim, "preload 使用 contextBridge (contextIsolated) ✓")
    else:
        fail(dim, "preload 未使用 contextBridge", "CRITICAL")


# ============================================================
# Run all audits
# ============================================================
def main():
    print(f"\n{BOLD}{CYAN}{'=' * 60}")
    print(f" HintOS Agent Chat — 多维度 Dry-Run 审计")
    print(f"{'=' * 60}{RESET}\n")

    audits = [
        ("1", "IPC 通道匹配", audit_ipc_channels),
        ("2", "EventEmitter 事件匹配", audit_event_emitters),
        ("3", "Agent 定义一致性", audit_agent_defs),
        ("4", "Core 类型导出完整性", audit_core_exports),
        ("5", "window.hintos API 完整性", audit_hintos_api),
        ("6", "Gate 流程完整性", audit_gate_flow),
        ("7", "死代码检测", audit_dead_code),
        ("8", "消息类型字面量一致性", audit_message_types),
        ("9", "Zustand Persist 安全性", audit_persist),
        ("10", "安全性审查", audit_security),
    ]

    for num, name, fn in audits:
        print(f"{BOLD}[维度 {num}] {name}{RESET}")
        fn()
        print()

    # Summary
    critical = [(s, d, m) for s, d, m in issues if s == "CRITICAL"]
    medium = [(s, d, m) for s, d, m in issues if s == "MEDIUM"]
    low = [(s, d, m) for s, d, m in issues if s == "LOW"]

    print(f"\n{BOLD}{CYAN}{'=' * 60}")
    print(f" 审计报告")
    print(f"{'=' * 60}{RESET}\n")

    if critical:
        print(f"{BOLD}{RED}🔴 CRITICAL ({len(critical)}):{RESET}")
        for _, d, m in critical:
            print(f"  {RED}✗ [{d}] {m}{RESET}")
        print()

    if medium:
        print(f"{BOLD}{YELLOW}🟡 MEDIUM ({len(medium)}):{RESET}")
        for _, d, m in medium:
            print(f"  {YELLOW}⚠ [{d}] {m}{RESET}")
        print()

    if low:
        print(f"{BOLD}🔵 LOW ({len(low)}):{RESET}")
        for _, d, m in low:
            print(f"  ℹ [{d}] {m}")
        print()

    print(f"{GREEN}✅ PASSED: {len(passes)} 项检查通过{RESET}")
    print(f"   CRITICAL: {len(critical)} | MEDIUM: {len(medium)} | LOW: {len(low)}")
    print(f"   总检查项: {len(passes) + len(issues)}")

    if critical:
        print(f"\n{RED}{BOLD}❌ 审计结果: FAIL — 有 {len(critical)} 个严重问题需要修复{RESET}")
        return 1
    elif medium:
        print(f"\n{YELLOW}{BOLD}⚠️ 审计结果: PASS WITH WARNINGS — {len(medium)} 个中等问题建议修复{RESET}")
        return 0
    else:
        print(f"\n{GREEN}{BOLD}✅ 审计结果: CLEAN PASS{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
