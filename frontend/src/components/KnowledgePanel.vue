<template>
  <div class="kb-panel">
    <!-- Search bar -->
    <div class="kb-search-bar">
      <el-input
        v-model="query"
        placeholder="搜索网络知识、命令..."
        size="small"
        clearable
        @input="onSearchInput"
        @clear="doSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- Filters -->
    <div class="kb-filters">
      <el-select v-model="vendor" size="small" placeholder="厂商" @change="doSearch" style="width:100px">
        <el-option label="全部厂商" value="all" />
        <el-option v-for="v in vendors" :key="v" :label="v" :value="v" />
      </el-select>
      <el-select v-model="category" size="small" placeholder="分类" @change="doSearch" style="width:90px">
        <el-option label="全部分类" value="all" />
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
    </div>

    <!-- Results -->
    <div class="kb-results" v-loading="loading">
      <div v-if="!query && results.total === 0" class="kb-empty">
        <p>输入关键词搜索网络知识和命令参考</p>
        <p class="kb-hint">支持中文、英文、拼音模糊搜索</p>
        <p class="kb-hint">例："vlan"、"访问控制"、"stp"、"链路聚合"</p>
      </div>

      <div v-if="results.total > 0" class="kb-stats">
        找到 {{ results.total }} 条结果（基础知识 {{ results.articles.length }} · 命令 {{ results.commands.length }}）
      </div>

      <!-- Articles -->
      <div v-if="results.articles.length > 0" class="kb-section">
        <h4 class="kb-section-title">📖 基础知识</h4>
        <div
          v-for="art in results.articles"
          :key="art.id"
          class="kb-article-card"
          @click="toggleArticle(art.id)"
        >
          <div class="kb-art-header">
            <span class="kb-art-title">{{ art.title }}</span>
            <el-icon :class="{ 'kb-rotate': expandedArticles[art.id] }"><ArrowDown /></el-icon>
          </div>
          <div v-show="expandedArticles[art.id]" class="kb-art-content">{{ art.content }}</div>
        </div>
      </div>

      <!-- Commands -->
      <div v-if="results.commands.length > 0" class="kb-section">
        <h4 class="kb-section-title">💻 命令参考</h4>
        <div
          v-for="(cmd, idx) in results.commands"
          :key="idx"
          class="kb-cmd-card"
          @click="toggleCmd(idx)"
        >
          <div class="kb-cmd-header">
            <div class="kb-cmd-top">
              <span class="kb-cmd-name">{{ cmd.name }}</span>
              <span class="kb-cmd-vendor">{{ cmd.vendor }}</span>
            </div>
            <div class="kb-cmd-sub">
              <el-tag size="small" type="info">{{ cmd.categoryName }}</el-tag>
              <span class="kb-cmd-mode">{{ cmd.mode }}</span>
            </div>
          </div>
          <div v-show="expandedCmds[idx]" class="kb-cmd-detail">
            <div class="kb-code-label">语法</div>
            <pre class="kb-code">{{ cmd.syntax }}</pre>
            <div class="kb-code-label">示例</div>
            <pre class="kb-code">{{ cmd.example }}</pre>
            <div class="kb-desc">{{ cmd.description }}</div>
          </div>
        </div>
      </div>

      <div v-if="query && results.total === 0 && !loading" class="kb-empty">
        <p>未找到 "{{ query }}" 相关结果</p>
        <p class="kb-hint">尝试缩短关键词或切换厂商/分类</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import axios from 'axios'

const query = ref('')
const vendor = ref('all')
const category = ref('all')
const loading = ref(false)
const vendors = ref([])
const categories = ref([])
const results = reactive({ articles: [], commands: [], total: 0 })
const expandedArticles = reactive({})
const expandedCmds = reactive({})

let debounceTimer = null

onMounted(async () => {
  try {
    const res = await axios.get('/api/kb/vendors')
    vendors.value = res.data.vendors || []
  } catch (_) {}
  try {
    const catRes = await axios.get('/api/kb/categories', { params: { vendor: 'Huawei' } })
    const catData = catRes.data.categories || {}
    categories.value = Object.entries(catData).map(([id, info]) => ({ id, name: info.name }))
  } catch (_) {}
})

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  loading.value = true
  try {
    const res = await axios.get('/api/kb/search', {
      params: { q: query.value, vendor: vendor.value, category: category.value }
    })
    results.articles = res.data.articles || []
    results.commands = res.data.commands || []
    results.total = res.data.total || 0
  } catch (_) {
    results.articles = []
    results.commands = []
    results.total = 0
  } finally {
    loading.value = false
  }
}

function toggleArticle(id) {
  expandedArticles[id] = !expandedArticles[id]
}

function toggleCmd(idx) {
  expandedCmds[idx] = !expandedCmds[idx]
}
</script>

<style scoped>
.kb-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.kb-search-bar {
  padding: 8px 10px 0;
  flex-shrink: 0;
}
.kb-filters {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  flex-shrink: 0;
}
.kb-results {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 10px;
}
.kb-empty {
  text-align: center;
  color: #909399;
  font-size: 13px;
  padding: 30px 10px;
}
.kb-hint {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}
.kb-stats {
  font-size: 11px;
  color: #909399;
  padding: 4px 0 8px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 6px;
}
.kb-section {
  margin-bottom: 10px;
}
.kb-section-title {
  font-size: 12px;
  color: #606266;
  margin: 8px 0 4px;
  font-weight: 600;
}
.kb-article-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
  cursor: pointer;
}
.kb-art-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kb-art-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
.kb-art-content {
  font-size: 11px;
  color: #606266;
  margin-top: 6px;
  line-height: 1.6;
  white-space: pre-line;
}
.kb-rotate {
  transform: rotate(180deg);
}
.kb-cmd-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
  cursor: pointer;
}
.kb-cmd-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kb-cmd-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kb-cmd-name {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
.kb-cmd-vendor {
  font-size: 10px;
  color: #409EFF;
  background: #ecf5ff;
  padding: 1px 5px;
  border-radius: 3px;
}
.kb-cmd-sub {
  display: flex;
  gap: 6px;
  align-items: center;
}
.kb-cmd-mode {
  font-size: 10px;
  color: #909399;
}
.kb-cmd-detail {
  margin-top: 8px;
  border-top: 1px solid #ebeef5;
  padding-top: 6px;
}
.kb-code-label {
  font-size: 10px;
  color: #909399;
  margin: 4px 0 2px;
}
.kb-code {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #303133;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.kb-desc {
  font-size: 11px;
  color: #606266;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
