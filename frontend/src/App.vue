<template>
  <div id="app-container">
    <el-header>
      <h1>网络拓扑配置生成器</h1>
      <div class="controls">
        <el-button size="small" :icon="Download" @click="topoEditor?.exportTopologyFile()" title="保存拓扑">保存</el-button>
        <el-button size="small" :icon="Upload" @click="triggerImport" title="加载拓扑">加载</el-button>
        <el-dropdown @command="exportImage" trigger="click">
          <el-button size="small" :icon="Camera" title="导出拓扑图为图片">导出图片</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="png">PNG 高清</el-dropdown-item>
              <el-dropdown-item command="jpeg">JPEG</el-dropdown-item>
              <el-dropdown-item command="svg">SVG 矢量</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileImport" />
        <el-button size="small" :icon="PictureFilled" @click="triggerImageImport" title="从拓扑图导入">导入拓扑图</el-button>
        <input ref="imageFileInput" type="file" accept=".jpg,.jpeg,.png,.bmp,.webp" style="display:none" @change="onImageImport" />
        <el-button size="small" :icon="Delete" type="danger" @click="confirmClear" title="清空画布">清空</el-button>
        <el-button size="small" :icon="Setting" @click="globalSettingsDialog.visible = true" title="全局设置">全局设置</el-button>
        <el-dropdown @command="applyTemplateCmd" trigger="click">
          <el-button size="small" type="warning" title="从模板新建拓扑">新建模板</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="tpl in topologyTemplates"
                :key="tpl.name"
                :command="tpl.name"
              >{{ tpl.icon }} {{ tpl.name }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" :icon="isDark ? Sunny : Moon" @click="toggleDarkMode" :title="isDark ? '切换日间模式' : '切换夜间模式'" />
        <el-button size="small" :loading="layoutLoading" :disabled="layoutLoading" @click="doAutoLayout" title="自动排列设备">自动布局</el-button>
        <el-divider direction="vertical" />
        <el-select v-model="selectedVendor" placeholder="选择厂商">
          <el-option v-for="v in vendors" :key="v" :label="v" :value="v" />
        </el-select>
        <el-button type="primary" :loading="loading" :disabled="loading" @click="generateAllConfigs">
          {{ loading ? '正在生成...' : '一键生成全部配置' }}
        </el-button>
        <el-button type="success" :loading="loading" :disabled="loading" @click="generateAllConfigs(true)">
          {{ loading ? '正在生成...' : '自动规划子网并生成' }}
        </el-button>
      </div>
    </el-header>
    <el-container style="flex:1; overflow:hidden;">
      <!-- eNSP-style categorized sidebar -->
      <el-aside width="240px" class="device-sidebar">
        <div class="sidebar-header">
          <el-input
            v-model="searchText"
            placeholder="搜索设备..."
            size="small"
            clearable
            :prefix-icon="Search"
          />
        </div>
        <el-collapse v-model="expandedCategories">
          <el-collapse-item
            v-for="cat in filteredCategories"
            :key="cat.name"
            :name="cat.name"
          >
            <template #title>
              <span class="category-title">{{ cat.name }}</span>
            </template>
            <div
              v-for="model in cat.models"
              :key="model.model"
              class="device-card"
              draggable="true"
              @dragstart="onDragStart($event, model)"
            >
              <DeviceIcon :type="model.type" />
              <span class="device-model">{{ model.label }}</span>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-aside>

      <!-- Canvas -->
      <el-main style="padding:0;">
        <TopologyEditor
          ref="topoEditor"
          @open-cli="onOpenCli"
          @edit-device="onEditDevice"
          @export-device-config="onExportDeviceConfig"
        />
      </el-main>

      <!-- Right sidebar with tabs -->
      <el-aside width="420px" class="config-panel-aside">
        <el-tabs v-model="activeTab" class="sidebar-tabs" stretch>
          <el-tab-pane label="配置" name="config">
            <div class="tab-content config-tab">
              <ConfigPanel :configs="currentConfigs" :loading="loading" :subnetPlan="subnetPlan" :generatedRef="generatedConfigsRef" :topology="currentTopology" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="知识库" name="kb">
            <div class="tab-content kb-tab">
              <KnowledgePanel />
            </div>
          </el-tab-pane>
          <el-tab-pane label="AI助手" name="chat">
            <div class="tab-content chat-tab">
              <ChatPanel :topology="currentTopology" :vendor="selectedVendor" :configs="currentConfigs" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="分析报告" name="analysis">
            <div class="tab-content analysis-tab">
              <AnalysisPanel
                :report="analysisResult?.analysis_report"
                :topology="analysisResult?.extracted_topology"
                :warnings="topologyWarnings"
                @apply="applyExtractedTopology"
                @focus-device="focusDevice"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-aside>
    </el-container>

    <!-- Loading Overlay -->
    <LoadingOverlay :visible="analyzing" :status="analysisStatus" />

    <!-- CLI Terminal (bottom panel) -->
    <DeviceCli
      :device="cliDevice"
      :visible="cliVisible"
      @close="cliVisible = false"
      @command-executed="onCliCommandExecuted"
    />

    <!-- Device Properties Drawer -->
    <DeviceProperties
      :node-data="selectedDevice"
      @close="selectedDevice = null"
      @closed="selectedDevice = null"
      @apply="onDeviceApply"
      @delete="onDeviceDelete"
    />

    <!-- Global Settings Dialog -->
    <GlobalSettingsDialog ref="globalSettingsDialog" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Download, Upload, Delete, PictureFilled, Setting, Sunny, Moon, Camera } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import axios from 'axios'
import TopologyEditor from './components/TopologyEditor.vue'
import ConfigPanel from './components/ConfigPanel.vue'
import ChatPanel from './components/ChatPanel.vue'
import KnowledgePanel from './components/KnowledgePanel.vue'
import AnalysisPanel from './components/AnalysisPanel.vue'
import DeviceProperties from './components/DeviceProperties.vue'
import DeviceIcon from './components/DeviceIcon.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import DeviceCli from './components/DeviceCli.vue'
import GlobalSettingsDialog from './components/GlobalSettingsDialog.vue'
import { deviceCategories } from './topology/deviceDefinitions.js'
import { autoAssignSubnets } from './topology/subnetPlanner.js'
import { validateTopology } from './topology/topologyValidator.js'
import { getTemplates } from './topology/topologyTemplates.js'

const vendors = ['Huawei', 'Cisco', 'H3C', 'Ruijie', 'NSFocus', 'Sangfor', 'QiAnXin', 'Juniper', 'Arista', 'HPE', 'ZTE', 'Extreme', 'Dell', 'Sonic', 'Maipu', 'Hikvision', 'Tplink', 'Fiberhome', 'Dptecn', 'Inspur', 'Boda', 'Raisecom', 'Dcn']
const selectedVendor = ref('Huawei')
const topoEditor = ref(null)
const currentConfigs = ref({})
const currentTopology = ref({})
const loading = ref(false)
const activeTab = ref('config')
const selectedDevice = ref(null)
const searchText = ref('')
const fileInput = ref(null)
const imageFileInput = ref(null)
const expandedCategories = ref(deviceCategories.filter(c => c.expanded).map(c => c.name))

const subnetPlan = ref(null)  // { vlanId: { subnet, gateway, dhcpStart, dhcpEnd } }
const topologyWarnings = ref([])
const generatedConfigsRef = ref({})  // snapshot of last generated configs for diff

// Image analysis state
const analyzing = ref(false)
const analysisStatus = ref('')
const analysisResult = ref(null)  // {extracted_topology, analysis_report, configs}

// CLI terminal state
const cliVisible = ref(false)
const cliDevice = ref(null)

// Global settings dialog
const globalSettingsDialog = ref(null)

// Auto-layout
const layoutLoading = ref(false)

async function doAutoLayout() {
  if (!topoEditor.value) {
    ElMessage.warning('拓扑编辑器未就绪')
    return
  }
  layoutLoading.value = true
  try {
    await topoEditor.value.autoLayout()
  } catch (e) {
    console.error('autoLayout error:', e)
    ElMessage.error('自动布局失败：' + (e?.message || e))
  } finally {
    layoutLoading.value = false
  }
}

// Topology templates
const topologyTemplates = getTemplates()

function applyTemplateCmd(name) {
  const tpl = topologyTemplates.find(t => t.name === name)
  if (!tpl) return
  ElMessageBox.confirm(
    `确定使用模板"${tpl.name}"？当前画布上的设备将被清空。`,
    '确认应用模板',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    const data = tpl.generate()
    topoEditor.value?.applyTemplate(data)
    currentConfigs.value = {}
    ElMessage.success(`已应用模板：${tpl.name}`)
  }).catch(() => {})
}

// Config version history
const HISTORY_KEY = 'topo-config-history'
const MAX_HISTORY = 20

function saveConfigHistory(configs) {
  try {
    let history = []
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) history = JSON.parse(raw)
    history.push({
      timestamp: Date.now(),
      label: new Date().toLocaleString('zh-CN'),
      deviceCount: Object.keys(configs || {}).length,
      configs: configs,
    })
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch (_) {}
}

function getConfigHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) { return [] }
}

// Dark mode
const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleDarkMode() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('topo-dark-mode', isDark.value.toString())
}

// Sync selected device from TopologyEditor
watch(() => topoEditor.value?.selectedNodeData, (data) => {
  selectedDevice.value = data || null
})

// Handlers for DeviceProperties
function onDeviceApply({ key, ...props }) {
  topoEditor.value?.updateNodeData(key, props)
  selectedDevice.value = null
}

function onDeviceDelete(key) {
  topoEditor.value?.deleteNode(key)
  selectedDevice.value = null
}

// ---- CLI handlers ----
function onOpenCli(device) {
  cliDevice.value = {
    key: device.key,
    label: device.label || device.key,
    hostname: device.hostname || device.label || device.key,
    vendor: device.vendor || selectedVendor.value,
    category: device.category || 'switch',
  }
  cliVisible.value = true
}

function onEditDevice(device) {
  selectedDevice.value = device
}

function onExportDeviceConfig(device) {
  if (!device?.key) return
  const config = currentConfigs.value[device.key]
  if (!config || config.length === 0) {
    ElMessage.warning('该设备暂无配置，请先生成配置')
    return
  }
  const text = Array.isArray(config) ? config.join('\n') : String(config)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${device.label || device.key}_config.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('配置已导出')
}

function onCliCommandExecuted({ deviceKey, runningConfig }) {
  if (!deviceKey || !runningConfig) return
  currentConfigs.value[deviceKey] = runningConfig
  try { localStorage.setItem('topo-configs', JSON.stringify(currentConfigs.value)) } catch (_) {}
}

// Restore saved configs from last session
onMounted(() => {
  try {
    const saved = localStorage.getItem('topo-configs')
    if (saved) {
      currentConfigs.value = JSON.parse(saved)
    }
  } catch (_) {}
})

// ---- Topology import/export/clear ----
function triggerImport() {
  fileInput.value?.click()
}

function exportImage(format) {
  topoEditor.value?.exportToImage(format)
}

function onFileImport(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    topoEditor.value?.importTopologyFile(reader.result)
  }
  reader.readAsText(file)
  // Reset so the same file can be re-imported
  ev.target.value = ''
}

// ---- Image topology import ----
function triggerImageImport() {
  imageFileInput.value?.click()
}

async function onImageImport(ev) {
  const file = ev.target.files?.[0]
  if (!file) return

  // Validate type
  const allowed = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp']
  if (!allowed.includes(file.type)) {
    ElMessage.error('仅支持 JPG、PNG、BMP、WebP 格式的图片')
    return
  }
  // Validate size
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 20MB')
    return
  }

  analyzing.value = true
  analysisStatus.value = '正在上传图片...'

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vendor', selectedVendor.value)
    formData.append('generate_configs', 'true')

    analysisStatus.value = 'AI 正在分析拓扑结构（约需 10-30 秒）...'
    const res = await axios.post('/api/analyze/topology-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })

    if (res.data.status === 'success') {
      analysisResult.value = {
        extracted_topology: res.data.extracted_topology,
        analysis_report: res.data.analysis_report,
        configs: res.data.configs || {},
      }
      // Populate canvas
      analysisStatus.value = '正在绘制拓扑图...'
      topoEditor.value?.importTopologyFromAnalysis(res.data.extracted_topology)

      // Store topology and configs
      currentTopology.value = res.data.extracted_topology
      currentConfigs.value = res.data.configs || {}
      try { localStorage.setItem('topo-configs', JSON.stringify(res.data.configs || {})) } catch (_) {}

      // Switch to analysis tab
      activeTab.value = 'analysis'

      if (res.data.warnings?.length) {
        ElMessage.warning('分析完成，但有 ' + res.data.warnings.length + ' 条警告')
      } else {
        ElMessage.success('拓扑图分析完成！已自动生成配置')
      }
    }
  } catch (err) {
    const detail = err.response?.data?.detail || err.message
    ElMessage.error('分析失败：' + detail)
    console.error('Image analysis error:', err)
  } finally {
    analyzing.value = false
    analysisStatus.value = ''
    ev.target.value = ''
  }
}

function applyExtractedTopology() {
  if (analysisResult.value?.extracted_topology) {
    topoEditor.value?.importTopologyFromAnalysis(analysisResult.value.extracted_topology)
    currentTopology.value = analysisResult.value.extracted_topology
    activeTab.value = 'config'
    ElMessage.success('拓扑已应用到画布，可在画布上编辑调整')
  }
}

function focusDevice(deviceKey) {
  topoEditor.value?.focusDevice(deviceKey)
  activeTab.value = 'editor'
}

function confirmClear() {
  ElMessageBox.confirm(
    '确定清空画布上所有设备和连线？此操作不可恢复。',
    '确认清空',
    { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    topoEditor.value?.clearTopology()
    currentConfigs.value = {}
    currentTopology.value = {}
  }).catch(() => {})
}

const filteredCategories = computed(() => {
  const models = deviceCategories.map(cat => {
    let filtered = cat.models
    // Filter by search text
    if (searchText.value) {
      const q = searchText.value.toLowerCase()
      filtered = filtered.filter(m =>
        m.model.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
      )
    }
    // Filter by selected vendor (通用 always shows)
    if (selectedVendor.value) {
      filtered = filtered.filter(m =>
        !m.vendor || m.vendor === 'Generic' || m.vendor === selectedVendor.value
      )
    }
    return { ...cat, models: filtered }
  }).filter(cat => cat.models.length > 0)
  return models
})

function onDragStart(ev, dev) {
  ev.dataTransfer.setData('application/json', JSON.stringify(dev))
}

async function generateAllConfigs(autoPlanSubnets = false) {
  if (!topoEditor.value) {
    ElMessage.warning('拓扑编辑器未就绪')
    return
  }
  const topoData = topoEditor.value.getTopologyData()
  if (!topoData || !topoData.nodes || Object.keys(topoData.nodes).length === 0) {
    ElMessage.warning('请先绘制拓扑图（拖入设备并连线）')
    return
  }

  loading.value = true
  try {
    currentTopology.value = topoData

    // Run topology validation
    topologyWarnings.value = validateTopology(topoData)

    // Auto-plan subnets if requested
    if (autoPlanSubnets) {
      const allVlans = new Set()
      for (const link of (topoData.links || [])) {
        if (link.accessVlan) allVlans.add(link.accessVlan)
        for (const v of (link.allowedVlans || [])) {
          const vi = typeof v === 'string' ? parseInt(v, 10) : v
          if (!isNaN(vi)) allVlans.add(vi)
        }
      }
      subnetPlan.value = autoAssignSubnets([...allVlans])
      topoData.subnetPlan = subnetPlan.value
    }

    if (topologyWarnings.value.length > 0) {
      activeTab.value = 'analysis'
    }

    const gs = globalSettingsDialog.value?.getSettings()
    const res = await axios.post('/api/generate', {
      topology: topoData,
      vendor: selectedVendor.value,
      globalSettings: gs
    })
    currentConfigs.value = res.data.config
    generatedConfigsRef.value = JSON.parse(JSON.stringify(res.data.config))
    const count = Object.keys(res.data.config || {}).length
    saveConfigHistory(res.data.config)
    ElMessage.success(`配置生成完成，共 ${count} 台设备`)
    activeTab.value = 'config'
  } catch (err) {
    ElMessage.error('生成失败：' + (err.response?.data?.detail || err.message))
  } finally {
    loading.value = false
  }
}
</script>

<style>
html, body { margin: 0; padding: 0; height: 100%; }
#app { height: 100%; }
#app-container { height: 100vh; display: flex; flex-direction: column; }
.el-header {
  background: #fff; padding: 10px 20px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #dcdfe6; flex-shrink: 0;
}
.controls { display: flex; gap: 10px; align-items: center; }
</style>

<style scoped>
.device-sidebar {
  background: #f5f7fa;
  overflow-y: auto;
  border-right: 1px solid #e4e7ed;
}
.sidebar-header {
  padding: 8px;
  border-bottom: 1px solid #e4e7ed;
}
.category-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
}
.device-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin: 2px 4px;
  cursor: grab;
  user-select: none;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background 0.15s, border-color 0.15s;
}
.device-card:hover {
  background: #e8f0fe;
  border-color: #90CAF9;
}
.device-card:active {
  cursor: grabbing;
  background: #BBDEFB;
}
.device-model {
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
.config-panel-aside {
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e4e7ed;
  overflow: hidden;
}
.sidebar-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-tabs :deep(.el-tabs__header) {
  margin: 0;
  flex-shrink: 0;
}
.sidebar-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}
.sidebar-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}
.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 8px 10px;
}
.config-tab {
  padding: 0;
}
.kb-tab {
  padding: 0;
}
.chat-tab {
  padding: 0;
}
.analysis-tab {
  padding: 0;
}
</style>
