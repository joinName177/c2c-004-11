<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { PackingItem } from '../../core/models';

type ItemPayload = Omit<PackingItem, 'id'>;

const props = defineProps<{ editing: PackingItem | null }>();
const emit = defineEmits<{
  add: [item: PackingItem];
  update: [id: string, patch: ItemPayload];
  cancel: [];
}>();

interface Draft {
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

const blankDraft = (): Draft => ({ name: '', category: '衣物', length: '20', width: '15', height: '5', weight: '0.3', priority: 2, mustHave: false, fragile: false });
const draft = reactive<Draft>(blankDraft());
const error = ref('');

watch(() => props.editing, (item) => {
  error.value = '';
  if (item) {
    Object.assign(draft, {
      name: item.name,
      category: item.category,
      length: String(item.length),
      width: String(item.width),
      height: String(item.height),
      weight: String(item.weight),
      priority: item.priority,
      mustHave: item.mustHave,
      fragile: item.fragile === true,
    });
  } else {
    Object.assign(draft, blankDraft());
  }
}, { immediate: true });

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
    error.value = '尺寸和重量必须是大于 0 的有效数字，不能为空';
    return;
  }
  const payload: ItemPayload = {
    name: draft.name.trim() || '未命名物品',
    category: draft.category,
    length,
    width,
    height,
    weight,
    priority: draft.priority,
    mustHave: draft.mustHave,
    fragile: draft.fragile,
  };
  error.value = '';
  if (props.editing) {
    emit('update', props.editing.id, payload);
  } else {
    emit('add', { ...payload, id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    draft.name = '';
  }
}

function cancel() {
  error.value = '';
  emit('cancel');
}
</script>

<template>
  <form class="item-editor" :class="{ editing }" data-testid="item-editor" @submit.prevent="submit">
    <input v-model="draft.name" class="name-field" aria-label="物品名称" :placeholder="editing ? `编辑：${editing.name}` : '添加物品名称'" />
    <select v-model="draft.category" aria-label="物品类别"><option>衣物</option><option>鞋履</option><option>数码</option><option>洗护</option><option>随身</option><option>其他</option></select>
    <select v-model="draft.priority" aria-label="物品优先级"><option :value="3">P3 高</option><option :value="2">P2 中</option><option :value="1">P1 低</option></select>
    <input v-model="draft.length" aria-label="物品长度(厘米)" type="number" min="0.1" step="0.5" placeholder="长 cm" />
    <input v-model="draft.width" aria-label="物品宽度(厘米)" type="number" min="0.1" step="0.5" placeholder="宽 cm" />
    <input v-model="draft.height" aria-label="物品高度(厘米)" type="number" min="0.1" step="0.5" placeholder="高 cm" />
    <input v-model="draft.weight" aria-label="物品重量(千克)" type="number" min="0.01" step="0.1" placeholder="重 kg" />
    <label class="check-field"><input v-model="draft.mustHave" type="checkbox" aria-label="物品必带" />必带</label>
    <label class="check-field"><input v-model="draft.fragile" type="checkbox" aria-label="物品易碎" />易碎</label>
    <div class="editor-actions">
      <button type="submit">{{ editing ? '保存修改' : '＋ 添加' }}</button>
      <button v-if="editing" type="button" class="cancel" data-testid="cancel-edit" @click="cancel">取消</button>
    </div>
    <p v-if="error" class="field-error editor-error" role="alert">{{ error }}</p>
  </form>
</template>
