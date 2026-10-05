<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { PackingItem } from '../../core/models';

const props = defineProps<{ editingItem: PackingItem | null }>();
const emit = defineEmits<{ confirm: [item: PackingItem]; cancel: [] }>();

const CATEGORIES = ['衣物', '鞋履', '数码', '洗护', '随身', '其他'];

interface ItemDraft {
  name: string;
  category: string;
  length: string | number;
  width: string | number;
  height: string | number;
  weight: string | number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile: boolean;
}

const defaultDraft = (): ItemDraft => ({ name: '', category: '衣物', length: '20', width: '15', height: '5', weight: '0.3', priority: 2, mustHave: false, fragile: false });

const draft = reactive<ItemDraft>(defaultDraft());
const error = ref('');

const categoryOptions = computed(() => (CATEGORIES.includes(draft.category) ? CATEGORIES : [...CATEGORIES, draft.category]));

watch(() => props.editingItem, (item) => {
  error.value = '';
  if (item) {
    draft.name = item.name;
    draft.category = item.category;
    draft.length = String(item.length);
    draft.width = String(item.width);
    draft.height = String(item.height);
    draft.weight = String(item.weight);
    draft.priority = item.priority;
    draft.mustHave = item.mustHave;
    draft.fragile = item.fragile ?? false;
  } else {
    Object.assign(draft, defaultDraft());
  }
});

function parsePositive(raw: string | number): number | null {
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function submit() {
  const length = parsePositive(draft.length);
  const width = parsePositive(draft.width);
  const height = parsePositive(draft.height);
  const weight = parsePositive(draft.weight);
  if (length === null || width === null || height === null || weight === null) {
    error.value = '尺寸和重量必须是大于 0 的有效数字，不能为空。';
    return;
  }
  error.value = '';
  emit('confirm', {
    id: props.editingItem?.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: draft.name.trim() || '未命名物品',
    category: draft.category,
    length, width, height, weight,
    priority: draft.priority,
    mustHave: draft.mustHave,
    fragile: draft.fragile,
  });
  if (!props.editingItem) Object.assign(draft, defaultDraft());
}

function cancel() {
  error.value = '';
  Object.assign(draft, defaultDraft());
  emit('cancel');
}
</script>

<template>
  <form class="item-editor" :class="{ editing: editingItem }" data-testid="item-editor" @submit.prevent="submit">
    <p v-if="editingItem" class="editing-hint" data-testid="editing-hint">正在编辑「{{ editingItem.name }}」，保存后将重新计算三套方案</p>
    <div class="editor-row">
      <input v-model="draft.name" aria-label="物品名称" placeholder="物品名称" />
      <select v-model="draft.category" aria-label="物品类别"><option v-for="option in categoryOptions" :key="option" :value="option">{{ option }}</option></select>
      <select v-model.number="draft.priority" aria-label="优先级">
        <option :value="1">P1 · 低</option>
        <option :value="2">P2 · 中</option>
        <option :value="3">P3 · 高</option>
      </select>
    </div>
    <div class="editor-row editor-dims">
      <label>长<input v-model="draft.length" aria-label="物品长度" type="number" min="0" step="any" placeholder="cm" /></label>
      <i>×</i>
      <label>宽<input v-model="draft.width" aria-label="物品宽度" type="number" min="0" step="any" placeholder="cm" /></label>
      <i>×</i>
      <label>高<input v-model="draft.height" aria-label="物品高度" type="number" min="0" step="any" placeholder="cm" /></label>
      <label>重量<input v-model="draft.weight" aria-label="物品重量" type="number" min="0" step="any" placeholder="kg" /></label>
    </div>
    <div class="editor-row editor-flags">
      <label><input v-model="draft.mustHave" type="checkbox" aria-label="必带" /> 必带</label>
      <label><input v-model="draft.fragile" type="checkbox" aria-label="易碎" /> 易碎</label>
      <span class="editor-actions">
        <button v-if="editingItem" type="button" class="ghost" data-testid="cancel-edit" @click="cancel">取消</button>
        <button type="submit">{{ editingItem ? '保存修改' : '＋ 添加' }}</button>
      </span>
    </div>
    <p v-if="error" class="field-error" data-testid="editor-error">{{ error }}</p>
  </form>
</template>
