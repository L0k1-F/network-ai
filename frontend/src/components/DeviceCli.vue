<template>
  <div v-if="visible" class="cli-container" :style="{ height: panelHeight + 'px' }">
    <!-- Resize handle -->
    <div class="cli-resize-handle" @mousedown="startResize"></div>

    <!-- Title bar -->
    <div class="cli-titlebar">
      <div class="cli-title-left">
        <el-icon :size="14"><Monitor /></el-icon>
        <span class="cli-device-name">{{ device?.label || 'Device' }}</span>
        <el-tag size="small" type="info" effect="plain">{{ device?.vendor || 'Huawei' }}</el-tag>
        <el-tag size="small" :type="modeTagType" effect="plain" class="mode-tag">{{ modeLabel }}</el-tag>
      </div>
      <div class="cli-title-right">
        <el-button :icon="CopyDocument" size="small" text @click="copySession" title="复制会话内容">复制</el-button>
        <el-button :icon="Delete" size="small" text @click="clearScreen" title="清屏">清屏</el-button>
        <el-button :icon="Close" size="small" text @click="$emit('close')" title="关闭">关闭</el-button>
      </div>
    </div>

    <!-- Terminal output -->
    <div ref="outputRef" class="cli-output" @click="focusInput">
      <div v-for="(line, i) in outputLines" :key="i" class="cli-line" :class="line.type">
        <span v-if="line.prompt" class="cli-prompt">{{ line.prompt }}</span>
        <span class="cli-text" v-html="line.text"></span>
      </div>
      <!-- Current input line -->
      <div class="cli-input-line">
        <span class="cli-prompt">{{ currentPrompt }}</span>
        <span class="cli-input-text">{{ inputBuffer }}</span>
        <span class="cli-cursor">█</span>
      </div>
    </div>

    <!-- Hidden input for keyboard capture -->
    <input
      ref="hiddenInput"
      class="cli-hidden-input"
      @keydown="onKeyDown"
      @paste="onPaste"
      autofocus
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted, computed } from 'vue'
import { Monitor, CopyDocument, Delete, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { DeviceSimulator } from '../topology/deviceSimulator.js'

const props = defineProps({
  device: { type: Object, default: () => ({}) },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'command-executed'])

// ---- State ----
const panelHeight = ref(300)
const outputRef = ref(null)
const hiddenInput = ref(null)
const inputBuffer = ref('')
const outputLines = ref([])
const cmdHistory = ref([])  // per-session
const histIndex = ref(-1)

// CLI mode: 'user' | 'system' | 'interface' | 'vlan' | 'ospf' | 'route'
const cliMode = ref('user')
const subContext = ref('')  // e.g., 'GigabitEthernet0/0/1'

// Device state simulator
const sim = ref(null)
const displayHostname = ref('')

// KB commands cache
const kbCommands = ref([])

// ---- Computed ----
const hostname = computed(() => displayHostname.value || props.device?.hostname || props.device?.label || 'Device')

const currentPrompt = computed(() => {
  const h = hostname.value
  switch (cliMode.value) {
    case 'system': return `[${h}]`
    case 'interface': return `[${h}-${subContext.value}]`
    case 'vlan': return `[${h}-vlan${subContext.value}]`
    case 'ospf': return `[${h}-ospf-${subContext.value}]`
    case 'user': default: return `<${h}>`
  }
})

const modeLabel = computed(() => {
  const map = { user: '用户视图', system: '系统视图', interface: '接口视图', vlan: 'VLAN视图', ospf: 'OSPF视图' }
  return map[cliMode.value] || '用户视图'
})

const modeTagType = computed(() => {
  const map = { user: 'info', system: 'warning', interface: '', vlan: 'success', ospf: 'danger' }
  return map[cliMode.value] || 'info'
})

// Vendor-specific command maps
const vendorEnterConfig = computed(() => {
  const v = (props.device?.vendor || 'Huawei').toLowerCase()
  if (['cisco', 'ruijie', 'arista', 'dell', 'hikvision', 'tplink', 'dptecn', 'inspur', 'boda', 'raisecom', 'dcn', 'zte'].includes(v)) return 'configure terminal'
  return 'system-view'
})

// Auto-complete candidates
const tabCandidates = computed(() => {
  const cmds = []
  switch (cliMode.value) {
    case 'user':
      cmds.push(vendorEnterConfig.value, 'display', 'show', 'ping', 'tracert', 'telnet', 'ssh', 'reset', 'reboot', 'dir', 'cd', 'copy', 'delete', 'mkdir')
      break
    case 'system':
      cmds.push('sysname', 'hostname', 'vlan', 'interface', 'stp', 'spanning-tree', 'dhcp', 'ip', 'ospf', 'router', 'acl', 'access-list', 'undo', 'no', 'quit', 'exit', 'return', 'end', 'display', 'show')
      break
    case 'interface':
      cmds.push('ip', 'port', 'switchport', 'stp', 'spanning-tree', 'dhcp', 'description', 'shutdown', 'undo', 'no', 'quit', 'exit', 'display this', 'show')
      break
    case 'vlan':
      cmds.push('name', 'description', 'quit', 'exit', 'undo', 'no')
      break
    case 'ospf':
      cmds.push('area', 'network', 'router-id', 'import-route', 'default-route-advertise', 'quit', 'exit')
      break
  }
  // Add KB commands
  for (const cmd of kbCommands.value) {
    if (!cmds.includes(cmd)) cmds.push(cmd)
  }
  return cmds.sort()
})

// ---- Methods ----
function addLine(text, type = '', prompt = '') {
  outputLines.value.push({ text, type, prompt })
}

function scrollToBottom() {
  nextTick(() => {
    const el = outputRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function executeCommand(cmd) {
  const raw = cmd.trim()
  if (!raw) {
    addLine('', 'output', currentPrompt.value)
    return
  }
  if (!sim.value) return

  // Add command to output with prompt
  addLine(raw, 'command', currentPrompt.value)
  cmdHistory.value.push(raw)
  histIndex.value = cmdHistory.value.length

  // Delegate to simulator
  const result = sim.value.execute(raw, cliMode.value, subContext.value)

  // Handle clear
  if (result.output.length === 1 && result.output[0] === '__CLEAR__') {
    outputLines.value = []
    addLine('终端已清屏', 'info')
    return
  }

  // Update mode/context from result
  cliMode.value = result.newMode
  subContext.value = result.newSubContext
  // Sync hostname (may have changed via sysname/hostname)
  displayHostname.value = sim.value.hostname

  // Add output lines with type detection
  for (const line of result.output) {
    if (!line) {
      addLine('', 'output')
    } else if (line.startsWith('% ')) {
      addLine(line, 'error')
    } else {
      addLine(line, 'output')
    }
  }

  // Emit running config for non-display, non-navigation commands
  const lower = raw.toLowerCase()
  const isDisplay = lower.startsWith('display') || lower.startsWith('show')
  const isNav = ['quit', 'exit', 'return', 'end'].includes(lower)
  const enterCfg = sim.value.style === 'huawei' ? 'system-view' : 'configure terminal'
  const isEnterCfg = lower === enterCfg || lower === 'conf t'
  if (!isDisplay && !isNav && !isEnterCfg && lower !== '?' && lower !== 'help' && lower !== 'clear' && lower !== 'cls' && !lower.startsWith('ping')) {
    emit('command-executed', {
      deviceKey: props.device?.key,
      command: raw,
      runningConfig: sim.value.getRunningConfig()
    })
  }

  scrollToBottom()
}

function showHelp() {
  if (!sim.value) return
  const lines = sim.value._help(cliMode.value)
  for (const line of lines) {
    addLine(line, line.startsWith('---') || !line ? 'info' : 'help')
  }
}

// ---- Keyboard handling ----
function onKeyDown(ev) {
  switch (ev.key) {
    case 'Enter':
      ev.preventDefault()
      executeCommand(inputBuffer.value)
      inputBuffer.value = ''
      scrollToBottom()
      break

    case 'Tab':
      ev.preventDefault()
      doTabComplete()
      break

    case 'ArrowUp':
      ev.preventDefault()
      if (histIndex.value > 0) {
        histIndex.value--
        inputBuffer.value = cmdHistory.value[histIndex.value]
      }
      break

    case 'ArrowDown':
      ev.preventDefault()
      if (histIndex.value < cmdHistory.value.length - 1) {
        histIndex.value++
        inputBuffer.value = cmdHistory.value[histIndex.value]
      } else {
        histIndex.value = cmdHistory.value.length
        inputBuffer.value = ''
      }
      break

    case 'c':
      if (ev.ctrlKey) {
        ev.preventDefault()
        if (cliMode.value !== 'user') {
          cliMode.value = 'user'
          subContext.value = ''
          addLine('^C', 'command', currentPrompt.value)
          addLine('已中断，返回用户视图', 'warning')
          scrollToBottom()
        }
      }
      break

    case 'Backspace':
      inputBuffer.value = inputBuffer.value.slice(0, -1)
      break

    case 'Escape':
      inputBuffer.value = ''
      break

    default:
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        inputBuffer.value += ev.key
      }
      break
  }
}

function onPaste(ev) {
  const text = ev.clipboardData?.getData('text') || ''
  inputBuffer.value += text
  ev.preventDefault()
}

function doTabComplete() {
  const partial = inputBuffer.value.toLowerCase().trim()
  if (!partial) return
  const matches = tabCandidates.value.filter(c => c.toLowerCase().startsWith(partial))
  if (matches.length === 1) {
    inputBuffer.value = matches[0] + ' '
  } else if (matches.length > 1) {
    // Show all matches
    addLine(inputBuffer.value, 'command', currentPrompt.value)
    addLine(matches.join('  '), 'help')
    // Find common prefix
    let common = matches[0]
    for (const m of matches) {
      let i = 0
      while (i < common.length && i < m.length && common[i] === m[i]) i++
      common = common.slice(0, i)
    }
    if (common.length > partial.length) {
      inputBuffer.value = common
    }
    scrollToBottom()
  }
}

function focusInput() {
  hiddenInput.value?.focus()
}

function clearScreen() {
  outputLines.value = []
  addLine('屏幕已清除', 'info')
}

function copySession() {
  const text = outputLines.value
    .map(l => (l.prompt || '') + (l.text || ''))
    .join('\n')
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('会话已复制到剪贴板')
  }).catch(() => {
    ElMessage.warning('复制失败，请手动选择文本')
  })
}

// ---- Resize ----
let resizeStartY = 0
let resizeStartH = 0

function startResize(ev) {
  resizeStartY = ev.clientY
  resizeStartH = panelHeight.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(ev) {
  const delta = resizeStartY - ev.clientY
  panelHeight.value = Math.max(150, Math.min(600, resizeStartH + delta))
}

function stopResize() {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// ---- Load KB commands for this vendor ----
async function loadKbCommands() {
  const vendor = props.device?.vendor || 'Huawei'
  try {
    const res = await axios.get('/api/kb/commands', { params: { vendor, category: 'all' } })
    // Extract distinct command words
    const words = new Set()
    for (const cmd of (res.data || [])) {
      const syntax = cmd.syntax || ''
      const firstWord = syntax.split(/\s+/)[0]
      if (firstWord && firstWord.length > 1 && !firstWord.includes('<') && !firstWord.includes('{')) {
        words.add(firstWord)
      }
      if (cmd.name) words.add(cmd.name.split(/\s+/)[0])
    }
    kbCommands.value = [...words]
  } catch (_) {
    // Silent fail — use defaults
  }
}

// ---- Lifecycle ----
watch(() => props.visible, async (v) => {
  if (v) {
    outputLines.value = []
    cliMode.value = 'user'
    subContext.value = ''
    inputBuffer.value = ''
    cmdHistory.value = []
    histIndex.value = -1

    // Create new simulator for this device
    const vendor = props.device?.vendor || 'Huawei'
    const h = hostname.value
    const category = props.device?.category || 'switch'
    sim.value = new DeviceSimulator(vendor, h, category)
    displayHostname.value = h

    // Welcome banner
    addLine(``, 'output')
    addLine(`  ╔══════════════════════════════════════╗`, 'banner')
    addLine(`  ║  ${vendor} CLI 交互终端              ║`, 'banner')
    addLine(`  ║  设备: ${h.padEnd(28)}║`, 'banner')
    addLine(`  ╚══════════════════════════════════════╝`, 'banner')
    addLine(`  输入 ? 查看可用命令`, 'info')
    addLine(`  输入 ${sim.value.style === 'huawei' ? 'system-view' : 'configure terminal'} 进入系统视图`, 'info')

    await loadKbCommands()
    nextTick(() => focusInput())
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.cli-container {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border-top: 2px solid #30363d;
  color: #c9d1d9;
  font-family: 'Consolas', 'Courier New', 'Microsoft YaHei', monospace;
  font-size: 13px;
  overflow: hidden;
  user-select: text;
}

.cli-resize-handle {
  height: 4px;
  background: #30363d;
  cursor: ns-resize;
  flex-shrink: 0;
}
.cli-resize-handle:hover {
  background: #58a6ff;
}

.cli-titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}
.cli-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8b949e;
  font-size: 12px;
}
.cli-device-name {
  color: #e6edf3;
  font-weight: 600;
  font-size: 13px;
}
.mode-tag {
  margin-left: 4px;
}

.cli-output {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  background: #0d1117;
  cursor: text;
  min-height: 0;
}

.cli-line {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.55;
}
.cli-line.command {
  color: #7ee787;
}
.cli-line.output {
  color: #c9d1d9;
}
.cli-line.info {
  color: #8b949e;
  font-style: italic;
}
.cli-line.warning {
  color: #d29922;
}
.cli-line.error {
  color: #f85149;
}
.cli-line.success {
  color: #3fb950;
}
.cli-line.help {
  color: #a5d6ff;
}
.cli-line.config {
  color: #79c0ff;
}
.cli-line.banner {
  color: #58a6ff;
}

.cli-prompt {
  color: #79c0ff;
  margin-right: 4px;
}

.cli-input-line {
  display: flex;
  align-items: baseline;
  margin-top: 2px;
}
.cli-input-text {
  color: #e6edf3;
}
.cli-cursor {
  color: #e6edf3;
  animation: blink 1s step-end infinite;
  font-weight: 100;
  margin-left: 1px;
}
@keyframes blink {
  50% { opacity: 0; }
}

.cli-hidden-input {
  position: absolute;
  left: -9999px;
  opacity: 0;
  width: 1px;
  height: 1px;
}
</style>
