<template>
  <div
    id="topologyCanvas"
    ref="canvasRef"
    style="width:100%; height:100%; outline:none;"
    @dragenter.prevent
    @dragover.prevent
    @drop.prevent="onDrop"
    @keydown="onKeyDown"
    @contextmenu.prevent="onContextMenu"
    tabindex="0"
  ></div>

  <!-- Right-click context menu -->
  <teleport to="body">
    <div
      v-if="ctxMenu.visible"
      class="canvas-context-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <div
        v-for="(item, i) in ctxMenu.items"
        :key="i"
        class="ctx-menu-item"
        :class="{ 'ctx-menu-divider': item.divider, 'ctx-menu-danger': item.danger }"
        @click="handleContextAction(item.action)"
      >
        <el-icon v-if="item.icon" style="margin-right:6px"><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
        <span v-if="item.shortcut" class="ctx-shortcut">{{ item.shortcut }}</span>
      </div>
    </div>
  </teleport>

  <!-- Link VLAN config dialog -->
  <LinkConfigDialog
    v-model="showLinkDialog"
    :from-label="linkFromLabel"
    :to-label="linkToLabel"
    :mode="linkMode"
    :access-vlan="linkAccessVlan"
    :allowed-vlans="linkAllowedVlans"
    :native-vlan="linkNativeVlan"
    :from-ports="linkFromPorts"
    :to-ports="linkToPorts"
    :from-port="linkFromPort"
    :to-port="linkToPort"
    :is-bonded="isBonded"
    :eth-trunk-id="ethTrunkId"
    :member-ports-from="memberPortsFrom"
    :member-ports-to="memberPortsTo"
    :lacp-mode="lacpMode"
    :load-balance="loadBalance"
    :link-bandwidth="linkBandwidth"
    @confirm="onLinkConfigConfirm"
  />
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import go from 'gojs'
import { ElMessage } from 'element-plus'
import { Monitor, Edit, CopyDocument, Download, Delete, Link, FullScreen, Camera } from '@element-plus/icons-vue'
import { createGridPattern } from '../topology/gridPattern.js'
import { createNodeTemplateMap, PORT_SPECS } from '../topology/nodeTemplateFactory.js'
import { getLinkProperties } from '../topology/connectionRules.js'
import LinkConfigDialog from './LinkConfigDialog.vue'

const $ = go.GraphObject.make
const canvasRef = ref(null)
let diagram = null
const modelCounters = {}
const TOPO_STORAGE_KEY = 'topo-model'
let saveTimer = null

// ---- Context menu state ----
const ctxMenu = ref({ visible: false, x: 0, y: 0, items: [], targetType: null, targetData: null })
let ctxMenuTargetPart = null
let copiedNodeData = null  // For copy/paste device

const emit = defineEmits(['open-cli', 'edit-device', 'export-device-config'])

// ---- Link dialog state ----
const showLinkDialog = ref(false)
const linkFromLabel = ref('')
const linkToLabel = ref('')
const linkMode = ref('access')
const linkAccessVlan = ref(10)
const linkAllowedVlans = ref(['10', '20'])
const linkNativeVlan = ref(1)
const linkFromPort = ref('')
const linkToPort = ref('')
const linkFromPorts = ref([])
const linkToPorts = ref([])
let currentLinkKey = null  // track which link is being edited
// Eth-Trunk link state
const ethTrunkId = ref(null)
const memberPortsFrom = ref([])
const memberPortsTo = ref([])
const lacpMode = ref('static')
const loadBalance = ref('src-dst-ip')
const isBonded = ref(false)
const linkBandwidth = ref('10GE')

// ---- Node selection state ----
const selectedNodeData = ref(null)

function updateNodeData(key, props) {
  if (!diagram) return
  const node = diagram.model.findNodeDataForKey(key)
  if (!node) return
  for (const [k, v] of Object.entries(props)) {
    diagram.model.setDataProperty(node, k, v)
  }
  // If label changed, update node label (which is bound to 'label')
  if (props.label) {
    diagram.model.setDataProperty(node, 'label', props.label)
  }
  // Update selectedNodeData reactively
  const updated = diagram.model.findNodeDataForKey(key)
  if (updated && selectedNodeData.value?.key === key) {
    selectedNodeData.value = { ...updated }
  }
}

function deleteNode(key) {
  if (!diagram) return
  diagram.select(diagram.findNodeForKey(key))
  diagram.commandHandler.deleteSelection()
  selectedNodeData.value = null
}

// ---- Drop handler ----
function onDrop(ev) {
  if (!diagram) return
  try {
    const data = JSON.parse(ev.dataTransfer.getData('application/json'))
    const rect = canvasRef.value.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    const canvasPoint = diagram.transformViewToDoc(new go.Point(x, y))
    if (!modelCounters[data.model]) modelCounters[data.model] = 0
    modelCounters[data.model]++
    const key = `${data.model}_${modelCounters[data.model]}`
    diagram.model.addNodeData({
      key: key,
      category: data.type,
      label: data.label || data.model,
      role: data.role,
      model: data.model,
      vendor: data.vendor || 'Huawei',
      hostname: data.hostname || data.model,
      vlan: data.vlan || null,
      description: data.description || '',
      loc: go.Point.stringify(canvasPoint),
    })
  } catch (_) { /* ignore invalid drops */ }
}

function onKeyDown(ev) {
  if (!diagram) return
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    ev.preventDefault()
    diagram.commandHandler.deleteSelection()
  }
}

// ---- Link config dialog ----
function openLinkConfig(linkData) {
  const model = diagram.model
  const fromNode = model.findNodeDataForKey(linkData.from)
  const toNode = model.findNodeDataForKey(linkData.to)
  const props = fromNode && toNode ? getLinkProperties(fromNode, toNode) : { label: 'Link' }
  linkFromLabel.value = fromNode?.label || linkData.from
  linkToLabel.value = toNode?.label || linkData.to
  linkMode.value = props.label === 'Eth-Trunk' ? 'trunk' : linkData.linkMode || (props.label === 'Trunk' ? 'trunk' : 'access')
  linkAccessVlan.value = linkData.accessVlan || 10
  linkAllowedVlans.value = linkData.allowedVlans || ['10', '20']
  linkNativeVlan.value = linkData.nativeVlan || 1

  // Look up available ports for both devices
  const fromCat = fromNode?.category || 'pc'
  const toCat = toNode?.category || 'pc'
  const fromSpec = PORT_SPECS[fromCat] || PORT_SPECS.pc
  const toSpec = PORT_SPECS[toCat] || PORT_SPECS.pc
  linkFromPorts.value = [...fromSpec.names]
  linkToPorts.value = [...toSpec.names]
  linkFromPort.value = linkData.fromPort || fromSpec.names[0] || ''
  linkToPort.value = linkData.toPort || toSpec.names[0] || ''

  // Eth-Trunk fields
  ethTrunkId.value = linkData.ethTrunkId || null
  memberPortsFrom.value = linkData.memberPortsFrom || []
  memberPortsTo.value = linkData.memberPortsTo || []
  lacpMode.value = linkData.lacpMode || 'static'
  loadBalance.value = linkData.loadBalance || 'src-dst-ip'
  isBonded.value = linkData.bonded || props.bonded || false
  linkBandwidth.value = linkData.bandwidth || props.bandwidth || '10GE'

  currentLinkKey = linkData.__gohashid || linkData.key
  showLinkDialog.value = true
}

function onLinkConfigConfirm(config) {
  if (currentLinkKey === null || !diagram) return
  const model = diagram.model
  // Find the link by matching data in the linkDataArray
  const link = model.linkDataArray.find(l =>
    (l.__gohashid === currentLinkKey) || (l.key === currentLinkKey)
  )
  if (!link) {
    // Try to find the most recently added link
    const lastLink = model.linkDataArray[model.linkDataArray.length - 1]
    if (lastLink) {
      applyVlanConfig(lastLink, config)
    }
    return
  }
  applyVlanConfig(link, config)
  currentLinkKey = null
}

function applyVlanConfig(link, config) {
  const model = diagram.model
  model.setDataProperty(link, 'fromPort', config.fromPort)
  model.setDataProperty(link, 'toPort', config.toPort)
  model.setDataProperty(link, 'accessVlan', config.accessVlan)
  model.setDataProperty(link, 'allowedVlans', config.allowedVlans)
  model.setDataProperty(link, 'nativeVlan', config.nativeVlan)

  // Eth-Trunk fields
  if (config.ethTrunkId != null) {
    model.setDataProperty(link, 'ethTrunkId', config.ethTrunkId)
    model.setDataProperty(link, 'memberPortsFrom', config.memberPortsFrom || [])
    model.setDataProperty(link, 'memberPortsTo', config.memberPortsTo || [])
    model.setDataProperty(link, 'lacpMode', config.lacpMode || 'static')
    model.setDataProperty(link, 'loadBalance', config.loadBalance || 'src-dst-ip')
    model.setDataProperty(link, 'bonded', true)
    model.setDataProperty(link, 'linkStrokeWidth', 4)
  }

  // Build label
  const bonded = config.ethTrunkId != null
  const bw = config.bandwidth || link.bandwidth || '10GE'
  let portPart
  if (bonded && config.memberPortsFrom?.length > 0 && config.memberPortsTo?.length > 0) {
    const fromPorts = config.memberPortsFrom.map(p => p.replace('GigabitEthernet', 'GE').replace('Ethernet', 'Eth')).join(',')
    const toPorts = config.memberPortsTo.map(p => p.replace('GigabitEthernet', 'GE').replace('Ethernet', 'Eth')).join(',')
    portPart = `Eth-Trunk${config.ethTrunkId} (${bw}): [${fromPorts}] ↔ [${toPorts}]`
  } else {
    portPart = `${config.fromPort || '?'} → ${config.toPort || '?'}`
  }
  const vlanPart = linkMode.value === 'trunk'
    ? `Trunk VLAN [${(config.allowedVlans || []).join(',')}]`
    : `Access VLAN ${config.accessVlan}`
  model.setDataProperty(link, 'linkLabel', `${portPart}  |  ${vlanPart}`)
  model.setDataProperty(link, 'vlanConfigured', true)
  model.setDataProperty(link, 'bandwidth', bw)
}

// ---- Export topology data ----
function getTopologyData() {
  if (!diagram) return { nodes: {}, links: [] }
  const model = diagram.model
  const nodes = {}
  model.nodeDataArray.forEach(n => {
    const roleDesc = n.role === 'core' ? '核心交换机'
      : n.role === 'access' ? '接入交换机'
      : n.role === 'router' ? '路由器'
      : n.role === 'security' ? '防火墙'
      : n.role === 'endpoint' ? '终端'
      : n.role
    nodes[n.key] = {
      key: n.key,
      label: n.label,
      model: n.model,
      role: n.role,
      category: n.category,
      description: `${n.model || n.label} (${roleDesc})`,
      vendor: n.vendor || 'Huawei',
    }
  })
  const links = model.linkDataArray.map(l => ({
    from: l.from,
    to: l.to,
    fromPort: l.fromPort || '',
    toPort: l.toPort || '',
    linkLabel: l.linkLabel || '',
    mode: l.linkLabel && l.linkLabel.startsWith('Trunk') ? 'trunk' : 'access',
    accessVlan: l.accessVlan || null,
    allowedVlans: l.allowedVlans || [],
    nativeVlan: l.nativeVlan || 1,
    bonded: l.bonded || false,
    ethTrunkId: l.ethTrunkId || null,
    memberPortsFrom: l.memberPortsFrom || [],
    memberPortsTo: l.memberPortsTo || [],
    lacpMode: l.lacpMode || 'static',
    loadBalance: l.loadBalance || 'src-dst-ip',
    bandwidth: l.bandwidth || '10GE',
  }))
  return { nodes, links }
}

function exportTopologyFile() {
  if (!diagram) return
  const json = diagram.model.toJson()
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `topology-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importTopologyFile(jsonString) {
  if (!diagram) return
  try {
    const json = JSON.parse(jsonString)
    // Validate: must have nodeDataArray or be a valid GoJS model
    if (!json.nodeDataArray && !json.linkDataArray && !json.class) {
      throw new Error('Invalid topology file')
    }
    diagram.model = go.Model.fromJson(JSON.stringify(json))
    // Rebuild modelCounters from loaded nodes
    for (const k of Object.keys(modelCounters)) delete modelCounters[k]
    diagram.model.nodeDataArray.forEach(n => {
      const match = n.key?.match(/^(.+)_(\d+)$/)
      if (match) {
        const base = match[1]
        const num = parseInt(match[2], 10)
        if (!modelCounters[base] || modelCounters[base] < num) {
          modelCounters[base] = num
        }
      }
    })
    saveModel()
  } catch (e) {
    alert('拓扑文件格式无效：' + e.message)
  }
}

function clearTopology() {
  if (!diagram) return
  diagram.model = new go.GraphLinksModel({
    nodeDataArray: [],
    linkDataArray: [],
    nodeCategoryProperty: 'category',
  })
  for (const k of Object.keys(modelCounters)) delete modelCounters[k]
  localStorage.removeItem(TOPO_STORAGE_KEY)
  localStorage.removeItem('topo-counters')
  selectedNodeData.value = null
}

function importTopologyFromAnalysis(topoData) {
  if (!diagram) return
  try {
    const nodes = topoData.nodes || {}
    const links = topoData.links || []

    // Compute layout positions based on zone and role
    const positions = _computeLayout(topoData)

    // Build nodeDataArray
    const nodeDataArray = []
    for (const [key, node] of Object.entries(nodes)) {
      const pos = positions.get(key) || { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }
      // Map category to GoJS template name (device type)
      const cat = node.category || 'terminal'
      const typeMap = {
        router: 'router', switch: 'switch', firewall: 'firewall',
        terminal: 'pc', wireless: 'ap', other: 'pc',
      }
      nodeDataArray.push({
        key: key,
        category: typeMap[cat] || 'pc',
        label: node.label || node.hostname || key,
        role: node.role || 'endpoint',
        model: node.model || 'unknown',
        hostname: node.hostname || node.label || key,
        mgmtIp: node.mgmtIp || '',
        mgmtVlan: node.mgmtVlan || '',
        description: node.description || node.zone || '',
        loc: go.Point.stringify(new go.Point(pos.x, pos.y)),
      })
    }

    // Build linkDataArray
    const linkDataArray = links.map((link, i) => ({
      from: link.from,
      to: link.to,
      fromPort: link.fromPort || '',
      toPort: link.toPort || '',
      linkLabel: link.linkLabel || `${nodes[link.from]?.label || link.from} → ${nodes[link.to]?.label || link.to}`,
      mode: link.mode || 'access',
      accessVlan: link.accessVlan || null,
      allowedVlans: link.allowedVlans || [],
      nativeVlan: link.nativeVlan || 1,
    }))

    // Load onto canvas
    diagram.model = new go.GraphLinksModel({
      nodeDataArray: nodeDataArray,
      linkDataArray: linkDataArray,
      nodeCategoryProperty: 'category',
    })

    // Rebuild modelCounters from node keys
    for (const k of Object.keys(modelCounters)) delete modelCounters[k]
    for (const n of nodeDataArray) {
      const match = n.key?.match(/^(.+)_(\d+)$/)
      if (match) {
        const base = match[1]
        const num = parseInt(match[2], 10)
        if (!modelCounters[base] || modelCounters[base] < num) {
          modelCounters[base] = num
        }
      }
    }

    saveModel()
  } catch (e) {
    console.error('Import topology from analysis failed:', e)
    alert('拓扑导入失败：' + e.message)
  }
}

function _computeLayout(topoData) {
  // Layout strategy: group by zone vertically, spread horizontally within zone
  // Zone order: 外部网络(top) → DMZ → 内部网络(middle) → 管理区(side) → 终端区(bottom)
  const zoneOrder = ['外部网络', '互联网', 'internet', 'wan',
                     'DMZ区', 'dmz', 'DMZ',
                     '内部网络', '内网', 'internal', 'lan',
                     '管理区', 'mgmt', 'management',
                     '终端区', '办公区', 'endpoint',
                     '无线区', 'wireless']

  const positions = new Map()
  const nodes = topoData.nodes || {}

  // Group nodes by zone
  const zoneGroups = {}
  const noZoneNodes = []
  for (const [key, node] of Object.entries(nodes)) {
    const zone = (node.zone || '').toLowerCase()
    let matched = false
    for (const z of zoneOrder) {
      if (zone.includes(z.toLowerCase())) {
        if (!zoneGroups[z]) zoneGroups[z] = []
        zoneGroups[z].push(key)
        matched = true
        break
      }
    }
    if (!matched) noZoneNodes.push(key)
  }

  // Assign no-zone nodes to a zone based on role
  for (const key of noZoneNodes) {
    const node = nodes[key]
    const role = (node.role || '').toLowerCase()
    let zone = '终端区'
    if (role.includes('router')) zone = '外部网络'
    else if (role.includes('security') || role.includes('firewall')) zone = 'DMZ区'
    else if (role.includes('core')) zone = '内部网络'
    else if (role.includes('access')) zone = '内部网络'
    if (!zoneGroups[zone]) zoneGroups[zone] = []
    zoneGroups[zone].push(key)
  }

  // Compute positions
  let yBase = 60
  const xSpacing = 180
  const yZoneSpacing = 180

  for (const zone of zoneOrder) {
    const group = zoneGroups[zone]
    if (!group || group.length === 0) continue

    const totalWidth = (group.length - 1) * xSpacing
    const xStart = 400 - totalWidth / 2

    group.forEach((key, i) => {
      positions.set(key, {
        x: xStart + i * xSpacing,
        y: yBase,
      })
    })

    yBase += yZoneSpacing
  }

  return positions
}

// ---- Context menu ----
function onContextMenu(ev) {
  if (!diagram) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = ev.clientX
  const y = ev.clientY
  const canvasPoint = diagram.transformViewToDoc(new go.Point(ev.clientX - rect.left, ev.clientY - rect.top))
  const part = diagram.findPartAt(canvasPoint, false)

  let items = []
  let targetType = 'canvas'
  let targetData = null

  if (part instanceof go.Node) {
    targetType = 'node'
    targetData = { ...part.data }
    items = [
      { label: '打开命令行', icon: Monitor, action: 'open-cli' },
      { label: '编辑属性', icon: Edit, action: 'edit-props' },
      { divider: true },
      { label: '复制设备', icon: CopyDocument, action: 'copy-device', shortcut: 'Ctrl+C' },
      { label: '导出该设备配置', icon: Download, action: 'export-device' },
      { divider: true },
      { label: '删除设备', icon: Delete, action: 'delete-device', danger: true, shortcut: 'Del' },
    ]
  } else if (part instanceof go.Link) {
    targetType = 'link'
    targetData = { ...part.data }
    const isBondedLink = part.data.bonded || part.data.ethTrunkId != null
    items = [
      { label: isBondedLink ? '编辑 Eth-Trunk / VLAN' : '编辑 VLAN / 端口', icon: Link, action: 'edit-link' },
      { divider: true },
      { label: '删除链路', icon: Delete, action: 'delete-link', danger: true },
    ]
  } else {
    targetType = 'canvas'
    items = [
      { label: '粘贴设备', icon: CopyDocument, action: 'paste-device', shortcut: copiedNodeData ? 'Ctrl+V' : '' },
      { divider: true },
      { label: '导出为图片', icon: Camera, action: 'export-image' },
      { divider: true },
      { label: '清空画布', icon: Delete, action: 'clear-canvas', danger: true },
    ]
  }

  ctxMenuTargetPart = part
  ctxMenu.value = { visible: true, x, y, items, targetType, targetData }
}

function closeContextMenu() {
  ctxMenu.value = { visible: false, x: 0, y: 0, items: [], targetType: null, targetData: null }
}

function handleContextAction(action) {
  const td = ctxMenu.value.targetData
  closeContextMenu()

  switch (action) {
    case 'open-cli':
      emit('open-cli', td)
      break
    case 'edit-props':
      emit('edit-device', td)
      break
    case 'copy-device':
      if (td) {
        copiedNodeData = { ...td }
        // Don't copy the loc — will be placed at drop/paste position
        delete copiedNodeData.loc
        delete copiedNodeData.key
      }
      break
    case 'paste-device': {
      if (!copiedNodeData || !diagram) return
      const key = `${copiedNodeData.model || 'device'}_${Date.now()}`
      const pos = diagram.transformViewToDoc(new go.Point(ctxMenu.value.x, ctxMenu.value.y))
      diagram.model.addNodeData({
        ...copiedNodeData,
        key,
        loc: go.Point.stringify(pos),
      })
      break
    }
    case 'export-device':
      emit('export-device-config', td)
      break
    case 'delete-device':
      if (td?.key) deleteNode(td.key)
      break
    case 'edit-link':
      if (ctxMenuTargetPart instanceof go.Link) {
        openLinkConfig(ctxMenuTargetPart.data)
      }
      break
    case 'delete-link':
      if (ctxMenuTargetPart instanceof go.Link) {
        diagram.select(ctxMenuTargetPart)
        diagram.commandHandler.deleteSelection()
      }
      break
    case 'export-image':
      exportToImage('png')
      break
    case 'clear-canvas':
      clearTopology()
      break
  }
}

// Click anywhere to close context menu
function onDocClick() { closeContextMenu() }

function focusDevice(deviceKey) {
  if (!diagram) return
  const node = diagram.findNodeForKey(deviceKey)
  if (node) {
    diagram.select(node)
    diagram.centerRect(node.actualBounds)
  }
}

function applyTemplate(templateData) {
  if (!diagram) return
  // templateData is { nodes: {...}, links: [...] }
  importTopologyFromAnalysis(templateData)
}

async function autoLayout() {
  if (!diagram) {
    ElMessage.warning('拓扑图未初始化，请刷新页面')
    return
  }
  if (!diagram.nodes) {
    ElMessage.warning('拓扑图节点集合不可用')
    return
  }
  const nodeArr = []
  diagram.nodes.each(n => nodeArr.push(n))
  if (nodeArr.length < 2) {
    ElMessage.info('设备数量少于 2 台，无需自动布局')
    return
  }

  const msg = ElMessage({ message: `正在自动布局 ${nodeArr.length} 台设备...`, type: 'info', duration: 0 })
  await new Promise(r => requestAnimationFrame(r))

  try {
    diagram.startTransaction('auto-layout')
    const layout = new go.LayeredDigraphLayout()
    layout.direction = 90
    layout.layerSpacing = 80
    layout.columnSpacing = 60
    layout.doLayout(diagram)
    diagram.commitTransaction('auto-layout')
    msg.close()
    ElMessage.success(`自动布局完成，已排列 ${nodeArr.length} 台设备`)
  } catch (e) {
    try { diagram.commitTransaction('auto-layout') } catch (_) {}
    msg.close()
    console.error('autoLayout error:', e)
    ElMessage.error('自动布局失败：' + (e.message || e))
  }
}

function exportToImage(format = 'png') {
  if (!diagram) {
    ElMessage.warning('拓扑图未初始化')
    return
  }
  if (!diagram.model.nodeDataArray || diagram.model.nodeDataArray.length === 0) {
    ElMessage.error('拓扑图为空，无法导出')
    return
  }

  try {
    if (format === 'svg') {
      const svgEl = diagram.makeSvg({ scale: 1, background: 'white', showDocumentBounds: true })
      const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      downloadBlob(url, `topology-${Date.now()}.svg`)
      URL.revokeObjectURL(url)
      ElMessage.success('拓扑图已导出为 SVG')
    } else {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const ext = format === 'jpeg' ? 'jpg' : 'png'
      const dataUri = diagram.makeImageData({
        scale: 2,
        background: 'white',
        type: mimeType,
        padding: 100,
      })
      const blob = dataUriToBlob(dataUri)
      const url = URL.createObjectURL(blob)
      downloadBlob(url, `topology-${Date.now()}.${ext}`)
      URL.revokeObjectURL(url)
      ElMessage.success(`拓扑图已导出为 ${ext.toUpperCase()}`)
    }
  } catch (e) {
    console.error('exportToImage error:', e)
    ElMessage.error('导出图片失败：' + (e.message || e))
  }
}

function dataUriToBlob(dataUri) {
  const parts = dataUri.split(',')
  const mime = parts[0].match(/:(.*?);/)[1]
  const bytes = atob(parts[1])
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function downloadBlob(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

defineExpose({ getTopologyData, selectedNodeData, updateNodeData, deleteNode, exportTopologyFile, importTopologyFile, clearTopology, importTopologyFromAnalysis, focusDevice, applyTemplate, autoLayout, exportToImage })

// ---- Topology persistence ----
function saveModel() {
  if (!diagram) return
  try {
    const json = diagram.model.toJson()
    localStorage.setItem(TOPO_STORAGE_KEY, json)
    // Also persist modelCounters so keys don't collide on reload
    localStorage.setItem('topo-counters', JSON.stringify(modelCounters))
  } catch (_) {}
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveModel, 300)
}

// ---- Diagram setup ----
onMounted(() => {
  document.addEventListener('click', onDocClick)

  diagram = $(go.Diagram, canvasRef.value, {
    'undoManager.isEnabled': true,
    initialContentAlignment: go.Spot.Center,
    allowDrop: true,
    allowDelete: true,
    'draggingTool.isEnabled': true,
    'toolManager.mouseWheelBehavior': go.ToolManager.WheelZoom,

    grid: createGridPattern(),
    'grid.visible': true,

    'nodeSelectionAdornmentTemplate': $(
      go.Adornment, 'Auto',
      $(go.Shape, 'Rectangle', {
        fill: null,
        stroke: '#1976D2',
        strokeWidth: 2,
        strokeDashArray: [4, 2],
      })
    ),

    'linkingTool.isEnabled': true,
    'linkingTool.portGravity': 25,
    'linkingTool.archetypeLinkData': { linkLabel: '', linkColor: '#78909C', ethTrunkId: null, memberPortsFrom: [], memberPortsTo: [], lacpMode: 'static', loadBalance: 'src-dst-ip', bandwidth: '10GE', bonded: false },
    'linkingTool.temporaryLink': $(
      go.Link,
      { curve: go.Link.None },
      $(go.Shape, { stroke: '#EF5350', strokeWidth: 2, strokeDashArray: [4, 3] })
    ),
    'relinkingTool.isEnabled': false,
  })

  diagram.nodeTemplateMap = createNodeTemplateMap()

  diagram.linkTemplate =
    $(go.Link,
      { routing: go.Link.Normal, curve: go.Link.None, corner: 8 },
      $(go.Shape, {
        stroke: '#78909C',
        strokeWidth: 2,
      }, new go.Binding('stroke', 'linkColor'), new go.Binding('strokeWidth', 'linkStrokeWidth')),
      $(go.Shape, {
        toArrow: 'Standard',
        stroke: '#78909C',
        fill: '#78909C',
        scale: 1.3,
      }, new go.Binding('stroke', 'linkColor'), new go.Binding('fill', 'linkColor')),
      $(go.TextBlock, {
        segmentOffset: new go.Point(0, -12),
        font: 'bold 9px "Microsoft YaHei", sans-serif',
        stroke: '#333',
        background: 'white',
        segmentOrientation: go.Link.OrientUpright,
        cursor: 'pointer',
      }, new go.Binding('text', 'linkLabel'))
    )

  // Auto-set link label when link is created, then open config dialog
  diagram.addModelChangedListener(evt => {
    if (evt.change === go.ChangedEvent.LinkConnected && evt.propertyName === 'fromNode') {
      const linkData = evt.subject?.data
      if (!linkData) return
      const model = diagram.model
      const fromNode = model.findNodeDataForKey(linkData.from)
      const toNode = model.findNodeDataForKey(linkData.to)
      if (!fromNode || !toNode) return
      const props = getLinkProperties(fromNode, toNode)
      const baseLabel = `${props.label} (${props.bandwidth}): ${fromNode.label || fromNode.model} → ${toNode.label || toNode.model}`
      model.setDataProperty(linkData, 'linkLabel', baseLabel)
      model.setDataProperty(linkData, 'linkColor', props.color)
      model.setDataProperty(linkData, 'linkStrokeWidth', props.strokeWidth || 2)
      model.setDataProperty(linkData, 'linkMode', props.label === 'Eth-Trunk' ? 'trunk' : props.label === 'Trunk' ? 'trunk' : 'access')
      model.setDataProperty(linkData, 'bonded', props.bonded || false)
      model.setDataProperty(linkData, 'bandwidth', props.bandwidth || '10GE')
      if (props.bonded) {
        model.setDataProperty(linkData, 'ethTrunkId', null) // user will set in dialog
        model.setDataProperty(linkData, 'memberPortsFrom', [])
        model.setDataProperty(linkData, 'memberPortsTo', [])
        model.setDataProperty(linkData, 'lacpMode', 'static')
        model.setDataProperty(linkData, 'loadBalance', 'src-dst-ip')
      }
      // Auto-open VLAN config dialog for new links
      currentLinkKey = linkData.__gohashid
      nextTick(() => openLinkConfig(linkData))
    }
  })

  // Double-click link to edit VLAN config
  diagram.addDiagramListener('ObjectDoubleClicked', e => {
    const part = e.subject.part
    if (part instanceof go.Link) {
      openLinkConfig(part.data)
    }
  })

  // Single-click node → update selection state
  diagram.addDiagramListener('ObjectSingleClicked', e => {
    const part = e.subject.part
    if (part instanceof go.Node) {
      selectedNodeData.value = { ...part.data }
    } else {
      selectedNodeData.value = null
    }
  })

  // Click background → deselect
  diagram.addDiagramListener('BackgroundSingleClicked', () => {
    selectedNodeData.value = null
  })

  // Restore saved topology or start fresh
  let loaded = false
  try {
    const savedJson = localStorage.getItem(TOPO_STORAGE_KEY)
    if (savedJson) {
      diagram.model = go.Model.fromJson(savedJson)
      const sc = localStorage.getItem('topo-counters')
      if (sc) Object.assign(modelCounters, JSON.parse(sc))
      loaded = true
    }
  } catch (_) {}

  if (!loaded) {
    diagram.model = new go.GraphLinksModel({
      nodeDataArray: [],
      linkDataArray: [],
      nodeCategoryProperty: 'category',
    })
  }

  // Persist topology on any model change (debounced)
  diagram.addModelChangedListener(() => scheduleSave())
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (diagram) {
    diagram.div = null
    diagram = null
  }
})
</script>

<style scoped>
#topologyCanvas {
  background: #f8f9fa;
  min-height: 500px;
}
</style>

<style>
/* Context menu — not scoped so teleport works */
.canvas-context-menu {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  padding: 4px 0;
  min-width: 200px;
  user-select: none;
}
.ctx-menu-item {
  display: flex;
  align-items: center;
  padding: 7px 16px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  transition: background 0.12s;
}
.ctx-menu-item:hover {
  background: #ecf5ff;
  color: #409EFF;
}
.ctx-menu-divider {
  height: 1px;
  background: #ebeef5;
  margin: 4px 8px;
  padding: 0;
  cursor: default;
  pointer-events: none;
}
.ctx-menu-danger {
  color: #F56C6C;
}
.ctx-menu-danger:hover {
  background: #fef0f0;
  color: #F56C6C;
}
.ctx-shortcut {
  margin-left: auto;
  font-size: 11px;
  color: #c0c4cc;
}
</style>
