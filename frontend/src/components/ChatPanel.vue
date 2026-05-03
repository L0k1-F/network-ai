<template>
  <div class="chat-panel">
    <div class="chat-header" @click="collapsed = !collapsed">
      <span>AI 助手</span>
      <el-icon :class="{ rotated: !collapsed }"><ArrowDown /></el-icon>
    </div>

    <template v-if="!collapsed">
      <!-- Messages -->
      <div class="messages" ref="msgContainer">
        <div v-if="messages.length === 0" class="welcome">
          我可以帮你分析拓扑结构、解释配置命令、回答 VLAN 设计问题，或者帮你做跨厂商配置迁移。
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          :class="['msg', msg.role]"
        >
          <div class="msg-content" v-html="renderContent(msg.content)" />
        </div>
        <div v-if="streaming" class="msg assistant">
          <div class="msg-content" v-html="renderContent(streamBuffer)" /><span class="cursor">|</span>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          :disabled="streaming"
          @keydown.enter.exact="send"
        />
        <el-button
          :icon="Promotion"
          type="primary"
          size="small"
          :disabled="!input.trim() || streaming"
          @click="send"
          style="margin-top:4px;"
        >
          发送
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { ArrowDown, Promotion } from '@element-plus/icons-vue'

const props = defineProps({
  topology: Object,
  vendor: String,
  configs: Object,
})

const collapsed = ref(true)
const messages = ref([])
const input = ref('')
const streaming = ref(false)
const streamBuffer = ref('')
const msgContainer = ref(null)

// Simple markdown-like rendering: code blocks and line breaks
function renderContent(text) {
  if (!text) return ''
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Code blocks ```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="code-block-chat"><code>$2</code></pre>')
  // Inline code `
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Line breaks
  html = html.replace(/\n/g, '<br>')
  return html
}

function scrollToBottom() {
  nextTick(() => {
    const el = msgContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  scrollToBottom()

  streaming.value = true
  streamBuffer.value = ''

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.value,
        topology: props.topology || {},
        vendor: props.vendor || 'Huawei',
        configs: props.configs || {},
      }),
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.token) {
            streamBuffer.value += data.token
            scrollToBottom()
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    streamBuffer.value += '\n\n[连接中断：' + e.message + ']'
  }

  if (streamBuffer.value) {
    messages.value.push({ role: 'assistant', content: streamBuffer.value })
    streamBuffer.value = ''
  }
  streaming.value = false
  scrollToBottom()
}

watch(() => props.configs, () => {
  // Auto-open chat when configs are generated
  if (props.configs && Object.keys(props.configs).length > 0 && collapsed.value) {
    collapsed.value = false
  }
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  border-top: 2px solid #dcdfe6;
  background: #fff;
  min-height: 0;
}
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  user-select: none;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}
.chat-header .el-icon {
  transition: transform 0.2s;
}
.chat-header .rotated {
  transform: rotate(-90deg);
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 120px;
  max-height: 300px;
}
.welcome {
  font-size: 12px;
  color: #999;
  text-align: center;
  padding: 20px 10px;
  line-height: 1.6;
}
.msg {
  margin-bottom: 8px;
  display: flex;
}
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }
.msg-content {
  max-width: 90%;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}
.msg.user .msg-content {
  background: #409EFF;
  color: #fff;
}
.msg.assistant .msg-content {
  background: #f0f2f5;
  color: #303133;
}
.cursor {
  animation: blink 1s infinite;
  color: #409EFF;
  font-weight: bold;
}
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.chat-input {
  padding: 8px;
  border-top: 1px solid #e4e7ed;
}
.code-block-chat {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  margin: 4px 0;
}
.inline-code {
  background: #e8e8e8;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
}
</style>
