<template>
  <el-drawer
    :model-value="!!nodeData"
    @update:model-value="$emit('close')"
    title="设备属性"
    direction="rtl"
    size="320px"
    :close-on-click-modal="true"
    @closed="$emit('closed')"
  >
    <template v-if="nodeData">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="设备标签">
          <el-input v-model="form.label" placeholder="如 S5700-1" />
        </el-form-item>
        <el-form-item label="主机名">
          <el-input v-model="form.hostname" :placeholder="nodeData.label || '设备主机名'" />
        </el-form-item>
        <el-form-item label="管理 IP">
          <el-input v-model="form.mgmtIp" placeholder="如 192.168.1.1/24" />
        </el-form-item>
        <el-form-item label="管理 VLAN">
          <el-input-number v-model="form.mgmtVlan" :min="1" :max="4094" placeholder="如 99" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="设备描述信息" />
        </el-form-item>

        <el-divider />
        <div class="device-info">
          <span>型号：{{ nodeData.model || '—' }}</span>
          <span>类型：{{ nodeData.category || '—' }}</span>
        </div>

        <el-divider />
        <div class="form-actions">
          <el-button type="primary" @click="apply">应用</el-button>
          <el-button type="danger" plain @click="confirmDelete">删除设备</el-button>
        </div>
      </el-form>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const props = defineProps({
  nodeData: Object,
})

const emit = defineEmits(['close', 'closed', 'apply', 'delete'])

const form = ref({
  label: '',
  hostname: '',
  mgmtIp: '',
  mgmtVlan: null,
  description: '',
})

watch(() => props.nodeData, (data) => {
  if (data) {
    form.value = {
      label: data.label || '',
      hostname: data.hostname || '',
      mgmtIp: data.mgmtIp || '',
      mgmtVlan: data.mgmtVlan || null,
      description: data.description || '',
    }
  }
}, { immediate: true })

function apply() {
  emit('apply', { key: props.nodeData.key, ...form.value })
  ElMessage.success('设备属性已更新')
}

function confirmDelete() {
  ElMessageBox.confirm(
    `确定删除设备 "${props.nodeData?.label || props.nodeData?.key}" 及其所有连线？`,
    '确认删除',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    emit('delete', props.nodeData.key)
    ElMessage.success('设备已删除')
  }).catch(() => {})
}
</script>

<style scoped>
.device-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}
.form-actions {
  display: flex;
  justify-content: space-between;
}
</style>
