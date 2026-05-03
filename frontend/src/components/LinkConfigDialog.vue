<template>
  <el-dialog
    v-model="visible"
    title="配置链路参数"
    width="520px"
    :close-on-click-modal="false"
    @closed="emitClosed"
  >
    <div class="link-info">
      <span class="endpoint">{{ linkInfo.fromLabel }}</span>
      <el-icon><Right /></el-icon>
      <span class="endpoint">{{ linkInfo.toLabel }}</span>
      <el-tag v-if="linkInfo.isBonded" size="small" type="danger">Eth-Trunk</el-tag>
      <el-tag v-else size="small" :type="linkInfo.mode === 'trunk' ? 'warning' : 'success'">
        {{ linkInfo.mode === 'trunk' ? 'Trunk' : 'Access' }}
      </el-tag>
    </div>

    <el-divider />

    <!-- Eth-Trunk Configuration -->
    <template v-if="linkInfo.isBonded">
      <el-form label-width="120px" @submit.prevent>
        <el-form-item label="Eth-Trunk ID">
          <el-input-number v-model="formData.ethTrunkId" :min="1" :max="64" style="width: 140px" />
          <span class="hint-inline">逻辑聚合接口编号</span>
        </el-form-item>
        <el-form-item label="聚合带宽">
          <el-select v-model="formData.bandwidth" style="width: 140px">
            <el-option label="10GE" value="10GE" />
            <el-option label="20GE" value="20GE" />
            <el-option label="40GE" value="40GE" />
            <el-option label="100GE" value="100GE" />
          </el-select>
        </el-form-item>
        <el-form-item label="源设备成员端口">
          <el-select
            v-model="formData.memberPortsFrom"
            multiple
            filterable
            placeholder="选择物理端口"
            style="width: 240px"
          >
            <el-option v-for="p in fromPorts" :key="p" :label="p" :value="p" />
          </el-select>
          <div class="hint">{{ linkInfo.fromLabel }} 加入 Eth-Trunk 的物理接口</div>
        </el-form-item>
        <el-form-item label="目标设备成员端口">
          <el-select
            v-model="formData.memberPortsTo"
            multiple
            filterable
            placeholder="选择物理端口"
            style="width: 240px"
          >
            <el-option v-for="p in toPorts" :key="p" :label="p" :value="p" />
          </el-select>
          <div class="hint">{{ linkInfo.toLabel }} 加入 Eth-Trunk 的物理接口</div>
        </el-form-item>
        <el-form-item label="LACP 模式">
          <el-radio-group v-model="formData.lacpMode">
            <el-radio value="static">静态 LACP</el-radio>
            <el-radio value="dynamic">动态 LACP</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="负载均衡模式">
          <el-select v-model="formData.loadBalance" style="width: 200px">
            <el-option label="源目IP (src-dst-ip)" value="src-dst-ip" />
            <el-option label="源目MAC (src-dst-mac)" value="src-dst-mac" />
            <el-option label="增强模式 (enhanced)" value="enhanced" />
          </el-select>
        </el-form-item>
        <el-divider />
      </el-form>
    </template>

    <!-- Port selection for both ends (non-bonded or pair selection) -->
    <el-form v-if="!linkInfo.isBonded" label-width="80px" @submit.prevent>
      <el-form-item label="源端口">
        <el-select v-model="formData.fromPort" placeholder="选择源设备端口" style="width: 160px">
          <el-option v-for="p in fromPorts" :key="p" :label="p" :value="p" />
        </el-select>
        <span class="hint-inline">{{ linkInfo.fromLabel }} 的接口</span>
      </el-form-item>
      <el-form-item label="目标端口">
        <el-select v-model="formData.toPort" placeholder="选择目标设备端口" style="width: 160px">
          <el-option v-for="p in toPorts" :key="p" :label="p" :value="p" />
        </el-select>
        <span class="hint-inline">{{ linkInfo.toLabel }} 的接口</span>
      </el-form-item>
    </el-form>

    <el-divider />

    <!-- Access mode config -->
    <template v-if="!linkInfo.isBonded && linkInfo.mode === 'access'">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="接入 VLAN ID">
          <el-input-number v-model="formData.accessVlan" :min="1" :max="4094" placeholder="如 10" />
          <span class="hint">PC → 交换机端口划入此 VLAN</span>
        </el-form-item>
      </el-form>
    </template>

    <!-- Trunk mode config (includes Eth-Trunk VLAN config) -->
    <template v-else>
      <el-form label-width="120px" @submit.prevent>
        <el-form-item label="允许通过 VLAN">
          <el-select
            v-model="formData.allowedVlans"
            multiple
            filterable
            allow-create
            placeholder="输入 VLAN ID，回车添加"
            style="width: 240px"
          >
            <el-option
              v-for="v in presetVlans"
              :key="v"
              :label="'VLAN ' + v"
              :value="v"
            />
          </el-select>
          <div class="hint">Trunk / Eth-Trunk 链路允许的 VLAN 列表</div>
        </el-form-item>
        <el-form-item label="Native VLAN">
          <el-input-number v-model="formData.nativeVlan" :min="1" :max="4094" placeholder="默认 1" />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onConfirm">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Right } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  fromLabel: String,
  toLabel: String,
  mode: String,
  accessVlan: Number,
  allowedVlans: Array,
  nativeVlan: Number,
  fromPorts: { type: Array, default: () => [] },
  toPorts: { type: Array, default: () => [] },
  fromPort: String,
  toPort: String,
  // Eth-Trunk props
  isBonded: { type: Boolean, default: false },
  ethTrunkId: Number,
  memberPortsFrom: { type: Array, default: () => [] },
  memberPortsTo: { type: Array, default: () => [] },
  lacpMode: { type: String, default: 'static' },
  loadBalance: { type: String, default: 'src-dst-ip' },
  linkBandwidth: { type: String, default: '10GE' },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'closed'])

const visible = ref(false)
const presetVlans = [10, 20, 30, 40, 50, 99, 100, 200]

const formData = ref({
  fromPort: '',
  toPort: '',
  accessVlan: 10,
  allowedVlans: ['10', '20'],
  nativeVlan: 1,
  ethTrunkId: null,
  memberPortsFrom: [],
  memberPortsTo: [],
  lacpMode: 'static',
  loadBalance: 'src-dst-ip',
  bandwidth: '10GE',
})

const linkInfo = computed(() => ({
  fromLabel: props.fromLabel || '?',
  toLabel: props.toLabel || '?',
  mode: props.mode || 'access',
  isBonded: props.isBonded || false,
}))

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    formData.value = {
      fromPort: props.fromPort || (props.fromPorts[0] || ''),
      toPort: props.toPort || (props.toPorts[0] || ''),
      accessVlan: props.accessVlan || 10,
      allowedVlans: props.allowedVlans || ['10', '20'],
      nativeVlan: props.nativeVlan || 1,
      ethTrunkId: props.ethTrunkId || 1,
      memberPortsFrom: [...(props.memberPortsFrom || [])],
      memberPortsTo: [...(props.memberPortsTo || [])],
      lacpMode: props.lacpMode || 'static',
      loadBalance: props.loadBalance || 'src-dst-ip',
      bandwidth: props.linkBandwidth || '10GE',
    }
  }
})

function emitClosed() {
  emit('update:modelValue', false)
}

function onConfirm() {
  emit('confirm', { ...formData.value })
  visible.value = false
}
</script>

<style scoped>
.link-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  padding: 8px 0;
}
.endpoint {
  color: #303133;
  background: #f0f2f5;
  padding: 4px 10px;
  border-radius: 4px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  display: block;
}
.hint-inline {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}
</style>
