<template>
  <el-dialog
    v-model="visible"
    title="全局参数设置"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form :model="form" label-width="120px" label-position="left">
      <el-form-item label="管理 VLAN">
        <el-input-number v-model="form.managementVlan" :min="2" :max="4094" controls-position="right" style="width:100%" />
        <div class="form-tip">用于设备管理的 VLAN ID，建议 99</div>
      </el-form-item>

      <el-form-item label="NTP 服务器">
        <el-input v-model="form.ntpServers" placeholder="ntp1.example.com, ntp2.example.com 或 IP 地址" />
        <div class="form-tip">多个服务器用逗号分隔</div>
      </el-form-item>

      <el-form-item label="SNMP 团体字">
        <el-input v-model="form.snmpCommunity" placeholder="public 或自定义团体名" />
        <div class="form-tip">SNMP v2c 只读团体字</div>
      </el-form-item>

      <el-divider content-position="left">管理员账号</el-divider>

      <el-form-item label="用户名">
        <el-input v-model="form.adminUser" placeholder="admin" />
      </el-form-item>

      <el-form-item label="密码">
        <el-input v-model="form.adminPassword" type="password" show-password placeholder="管理员密码" />
      </el-form-item>

      <el-divider content-position="left">DNS 设置</el-divider>

      <el-form-item label="域名">
        <el-input v-model="form.domainName" placeholder="example.com" />
      </el-form-item>

      <el-form-item label="DNS 服务器">
        <el-input v-model="form.dnsServers" placeholder="8.8.8.8, 114.114.114.114" />
        <div class="form-tip">多个服务器用逗号分隔</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="resetDefaults">恢复默认</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const STORAGE_KEY = 'topo-global-settings'

const defaults = {
  managementVlan: 99,
  ntpServers: '',
  snmpCommunity: 'public',
  adminUser: 'admin',
  adminPassword: '',
  domainName: '',
  dnsServers: '',
}

const visible = ref(false)
const form = reactive({ ...defaults })

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      Object.assign(form, data)
    }
  } catch (_) {}
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form }))
  } catch (_) {}
  visible.value = false
  ElMessage.success('全局设置已保存')
}

function resetDefaults() {
  Object.assign(form, defaults)
}

function getSettings() {
  const s = {}
  if (form.managementVlan && form.managementVlan > 1) s.managementVlan = form.managementVlan
  if (form.ntpServers) s.ntpServers = form.ntpServers
  if (form.snmpCommunity) s.snmpCommunity = form.snmpCommunity
  if (form.adminUser) s.adminUser = form.adminUser
  if (form.adminPassword) s.adminPassword = form.adminPassword
  if (form.domainName) s.domainName = form.domainName
  if (form.dnsServers) s.dnsServers = form.dnsServers
  return Object.keys(s).length > 0 ? s : null
}

watch(visible, (v) => { if (v) load() })

defineExpose({ visible, getSettings })
</script>

<style scoped>
.form-tip {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
</style>
