<template>
  <div class="analysis-panel">
    <!-- Validation-only view (no AI report) -->
    <div v-if="(!report || Object.keys(report).length === 0) && warnings.length === 0" class="analysis-empty">
      <el-empty description="暂无分析报告">
        <p class="empty-hint">导入拓扑图后，AI 将自动生成详细分析报告</p>
      </el-empty>
    </div>

    <!-- Validation-only view (no AI report but has warnings) -->
    <div v-else-if="(!report || Object.keys(report).length === 0) && warnings.length > 0" class="analysis-content">
      <div class="analysis-actions">
        <el-button size="small" :icon="Upload" type="primary" @click="$emit('apply')">应用拓扑到画布</el-button>
      </div>
      <el-collapse v-model="validationExpanded">
        <el-collapse-item name="validation">
          <template #title>
            <div class="section-title">
              <el-icon color="#E6A23C"><CircleCheck /></el-icon>
              <span>拓扑校验 ({{ warnings.length }} 项)</span>
            </div>
          </template>
          <div class="warning-list">
            <div
              v-for="(w, i) in warnings"
              :key="i"
              class="warning-item"
              :class="'severity-' + w.severity"
              @click="$emit('focusDevice', w.device)"
            >
              <div class="warning-header">
                <el-tag :type="sevTagType(w.severity)" size="small">{{ sevLabel(w.severity) }}</el-tag>
                <span class="warning-device">{{ w.deviceLabel }}</span>
              </div>
              <div class="warning-msg">{{ w.message }}</div>
              <div class="warning-fix" v-if="w.fix">
                <el-icon><Right /></el-icon>
                <span>{{ w.fix }}</span>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <div v-else class="analysis-content">
      <!-- Topology summary -->
      <div class="analysis-summary" v-if="topology">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-num">{{ deviceCount }}</span>
            <span class="stat-label">设备总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ linkCount }}</span>
            <span class="stat-label">链路总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ zoneCount }}</span>
            <span class="stat-label">安全区域</span>
          </div>
        </div>
      </div>

      <!-- Export button -->
      <div class="analysis-actions">
        <el-button size="small" :icon="Download" @click="exportReport">导出分析报告</el-button>
        <el-button size="small" :icon="Upload" type="primary" @click="$emit('apply')">应用拓扑到画布</el-button>
      </div>

      <!-- Analysis sections -->
      <el-collapse v-model="expandedSections">
        <el-collapse-item name="overview">
          <template #title>
            <div class="section-title">
              <el-icon color="#409EFF"><Odometer /></el-icon>
              <span>拓扑总览</span>
            </div>
          </template>
          <div class="section-body">{{ report.topology_overview || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="security">
          <template #title>
            <div class="section-title">
              <el-icon color="#E6A23C"><Lock /></el-icon>
              <span>安全架构分析</span>
            </div>
          </template>
          <div class="section-body">{{ report.security_architecture || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="redundancy">
          <template #title>
            <div class="section-title">
              <el-icon color="#67C23A"><Link /></el-icon>
              <span>冗余与高可用</span>
            </div>
          </template>
          <div class="section-body">{{ report.redundancy_ha || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="traffic">
          <template #title>
            <div class="section-title">
              <el-icon color="#909399"><Guide /></el-icon>
              <span>流量路径分析</span>
            </div>
          </template>
          <div class="section-body">{{ report.traffic_flow || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="config">
          <template #title>
            <div class="section-title">
              <el-icon color="#409EFF"><Setting /></el-icon>
              <span>配置建议</span>
            </div>
          </template>
          <div class="section-body">{{ report.config_recommendations || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="risks">
          <template #title>
            <div class="section-title">
              <el-icon color="#F56C6C"><WarningFilled /></el-icon>
              <span>风险提示</span>
            </div>
          </template>
          <div class="section-body risk-section">{{ report.risk_notes || '暂无' }}</div>
        </el-collapse-item>

        <el-collapse-item name="validation" v-if="warnings.length > 0">
          <template #title>
            <div class="section-title">
              <el-icon color="#E6A23C"><CircleCheck /></el-icon>
              <span>拓扑校验 ({{ warnings.length }} 项)</span>
            </div>
          </template>
          <div class="warning-list">
            <div
              v-for="(w, i) in warnings"
              :key="i"
              class="warning-item"
              :class="'severity-' + w.severity"
              @click="$emit('focusDevice', w.device)"
            >
              <div class="warning-header">
                <el-tag :type="sevTagType(w.severity)" size="small">{{ sevLabel(w.severity) }}</el-tag>
                <span class="warning-device">{{ w.deviceLabel }}</span>
              </div>
              <div class="warning-msg">{{ w.message }}</div>
              <div class="warning-fix" v-if="w.fix">
                <el-icon><Right /></el-icon>
                <span>{{ w.fix }}</span>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- Device table -->
      <div class="device-table-section" v-if="deviceTable.length > 0">
        <h4 class="table-title">识别设备清单</h4>
        <el-table :data="deviceTable" size="small" stripe style="width:100%">
          <el-table-column prop="key" label="标识" width="100" />
          <el-table-column prop="label" label="名称" width="120" />
          <el-table-column prop="category" label="类型" width="70">
            <template #default="{ row }">
              <el-tag :type="catTagType(row.category)" size="small">{{ catLabel(row.category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="zone" label="安全区域" width="80" />
          <el-table-column prop="vendor" label="厂商" width="60" />
          <el-table-column prop="model" label="型号" min-width="100" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Download, Upload, Odometer, Lock, Link, Guide, Setting, WarningFilled, CircleCheck, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  report: { type: Object, default: () => ({}) },
  topology: { type: Object, default: () => ({}) },
  warnings: { type: Array, default: () => [] },
})
defineEmits(['apply', 'focusDevice'])

const expandedSections = ref(['overview', 'security', 'redundancy', 'traffic', 'config', 'risks'])
const validationExpanded = ref(['validation'])

const deviceCount = computed(() => Object.keys(props.topology?.nodes || {}).length)
const linkCount = computed(() => (props.topology?.links || []).length)
const zoneCount = computed(() => {
  const zones = new Set()
  for (const n of Object.values(props.topology?.nodes || {})) {
    if (n.zone) zones.add(n.zone)
  }
  return zones.size
})

const deviceTable = computed(() => {
  return Object.entries(props.topology?.nodes || {}).map(([key, node]) => ({
    key, ...node,
  }))
})

function catLabel(cat) {
  const map = { router: '路由器', switch: '交换机', firewall: '防火墙', terminal: '终端', wireless: '无线', other: '其他' }
  return map[cat] || cat
}
function catTagType(cat) {
  const map = { router: 'warning', switch: '', firewall: 'danger', terminal: 'info', wireless: 'success', other: 'info' }
  return map[cat] || 'info'
}
function sevLabel(s) {
  const map = { error: '错误', warning: '警告', info: '提示' }
  return map[s] || s
}
function sevTagType(s) {
  const map = { error: 'danger', warning: 'warning', info: 'info' }
  return map[s] || 'info'
}

function exportReport() {
  if (!props.report) return
  const sections = [
    '# 网络拓扑分析报告\n',
    '## 拓扑总览', props.report.topology_overview || '', '\n',
    '## 安全架构分析', props.report.security_architecture || '', '\n',
    '## 冗余与高可用', props.report.redundancy_ha || '', '\n',
    '## 流量路径分析', props.report.traffic_flow || '', '\n',
    '## 配置建议', props.report.config_recommendations || '', '\n',
    '## 风险提示', props.report.risk_notes || '', '\n',
    '---\n*本报告由 AI 自动生成，仅供参考*',
  ]
  const md = sections.join('\n')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `topology-analysis-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('分析报告已导出')
}
</script>

<style scoped>
.analysis-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.analysis-empty {
  padding: 40px 0;
}
.empty-hint {
  font-size: 12px;
  color: #c0c4cc;
  text-align: center;
}
.analysis-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 2px;
}
.analysis-summary {
  margin-bottom: 10px;
}
.summary-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 16px;
  min-width: 70px;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #409EFF;
}
.stat-label {
  font-size: 10px;
  color: #909399;
  margin-top: 2px;
}
.analysis-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 10px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.section-body {
  font-size: 12px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-line;
  padding: 4px 0;
}
.risk-section {
  color: #E6A23C;
}
.table-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin: 12px 0 6px;
}
.device-table-section {
  margin-top: 12px;
}
/* Validation warnings */
.warning-list { display: flex; flex-direction: column; gap: 6px; }
.warning-item {
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 4px solid;
  background: #fff;
  cursor: pointer;
  transition: background 0.15s;
}
.warning-item:hover { background: #f0f2f5; }
.warning-item.severity-error { border-left-color: #F56C6C; background: #fef0f0; }
.warning-item.severity-warning { border-left-color: #E6A23C; background: #fdf6ec; }
.warning-item.severity-info { border-left-color: #909399; background: #f4f4f5; }
.warning-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.warning-device { font-size: 13px; font-weight: 600; color: #303133; }
.warning-msg { font-size: 12px; color: #606266; line-height: 1.6; }
.warning-fix { font-size: 11px; color: #67C23A; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
</style>
