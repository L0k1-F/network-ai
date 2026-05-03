<template>
  <teleport to="body">
    <transition name="overlay-fade">
      <div v-if="visible" class="loading-overlay">
        <div class="loading-card">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
          </div>
          <h3 class="loading-title">AI 拓扑图分析</h3>
          <p class="loading-status">{{ status }}</p>
          <div class="loading-progress">
            <div class="progress-dot" :class="{ active: phase >= 1 }"></div>
            <div class="progress-line" :class="{ active: phase >= 2 }"></div>
            <div class="progress-dot" :class="{ active: phase >= 2 }"></div>
            <div class="progress-line" :class="{ active: phase >= 3 }"></div>
            <div class="progress-dot" :class="{ active: phase >= 3 }"></div>
          </div>
          <div class="loading-phases">
            <span :class="{ active: phase >= 1 }">上传图片</span>
            <span :class="{ active: phase >= 2 }">AI 分析</span>
            <span :class="{ active: phase >= 3 }">生成配置</span>
          </div>
          <p v-if="elapsed > 0" class="loading-time">已耗时 {{ elapsed }} 秒</p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  visible: Boolean,
  status: { type: String, default: '' },
})
defineEmits(['cancel'])

const phase = ref(0)
const elapsed = ref(0)
let timer = null
let elapsedTimer = null

watch(() => props.visible, (v) => {
  if (v) {
    phase.value = 0
    elapsed.value = 0
    elapsedTimer = setInterval(() => { elapsed.value++ }, 1000)
    // Simulate phase progression based on status text
    timer = setInterval(() => {
      const s = props.status
      if (s.includes('生成配置') || s.includes('生成设备')) phase.value = 3
      else if (s.includes('分析') || s.includes('识别')) phase.value = 2
      else if (s.includes('上传')) phase.value = 1
    }, 200)
  } else {
    clearInterval(timer)
    clearInterval(elapsedTimer)
  }
})

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(elapsedTimer)
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.loading-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 50px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 380px;
}
.loading-title {
  margin: 16px 0 8px;
  font-size: 18px;
  color: #303133;
}
.loading-status {
  font-size: 13px;
  color: #909399;
  margin: 0 0 24px;
  min-height: 20px;
}
.loading-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 8px;
}
.progress-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e4e7ed;
  transition: all 0.4s;
  flex-shrink: 0;
}
.progress-dot.active {
  background: #409EFF;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.5);
}
.progress-line {
  width: 60px;
  height: 3px;
  background: #e4e7ed;
  transition: all 0.4s;
  flex-shrink: 0;
}
.progress-line.active {
  background: #409EFF;
}
.loading-phases {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #c0c4cc;
  padding: 0 10px;
}
.loading-phases span {
  transition: color 0.3s;
}
.loading-phases span.active {
  color: #409EFF;
  font-weight: 600;
}
.loading-time {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 16px;
}
/* Spinner */
.loading-spinner {
  display: flex;
  justify-content: center;
}
.spinner-ring {
  width: 48px;
  height: 48px;
  border: 4px solid #e4e7ed;
  border-top-color: #409EFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.overlay-fade-enter-active, .overlay-fade-leave-active {
  transition: opacity 0.3s;
}
.overlay-fade-enter-from, .overlay-fade-leave-to {
  opacity: 0;
}
</style>
