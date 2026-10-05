import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('adds an item with custom attributes and refreshes all plans immediately', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('单反镜头');
    await wrapper.get('[aria-label="物品长度(厘米)"]').setValue('15');
    await wrapper.get('[aria-label="物品宽度(厘米)"]').setValue('10');
    await wrapper.get('[aria-label="物品高度(厘米)"]').setValue('10');
    await wrapper.get('[aria-label="物品重量(千克)"]').setValue('0.8');
    await wrapper.get('[aria-label="物品优先级"]').setValue('3');
    await wrapper.get('[aria-label="物品必带"]').setValue(true);
    await wrapper.get('[aria-label="物品易碎"]').setValue(true);
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('15×10×10 cm · 0.8 kg');
    expect(wrapper.text()).toContain('易碎');
    expect(wrapper.text()).toContain('规划已同步');
  });

  it('edits an existing item, keeps its identity and recalculates plans and risks', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    expect((wrapper.get('[aria-label="物品长度(厘米)"]').element as HTMLInputElement).value).toBe('30');
    expect((wrapper.get('[aria-label="物品重量(千克)"]').element as HTMLInputElement).value).toBe('0.65');
    await wrapper.get('[aria-label="物品长度(厘米)"]').setValue('300');
    await wrapper.get('[aria-label="物品重量(千克)"]').setValue('1.4');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('300×24×5 cm · 1.4 kg');
    expect(wrapper.findAll('[data-item-id="jacket"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('轻薄外套 尺寸越界');
    expect(wrapper.text()).toContain('规划已同步');
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    expect((wrapper.get('[aria-label="物品长度(厘米)"]').element as HTMLInputElement).value).toBe('300');
    expect((wrapper.get('[aria-label="物品重量(千克)"]').element as HTMLInputElement).value).toBe('1.4');
  });

  it('keeps the saved item and plans untouched when the edit is cancelled', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 微单相机"]').trigger('click');
    await wrapper.get('[aria-label="物品重量(千克)"]').setValue('9.9');
    await wrapper.get('[aria-label="物品名称"]').setValue('被改掉的相机');
    await wrapper.get('[data-testid="cancel-edit"]').trigger('click');
    expect(wrapper.text()).toContain('18×14×10 cm · 0.72 kg');
    expect(wrapper.text()).not.toContain('被改掉的相机');
    expect(wrapper.text()).toContain('规划已同步');
    expect(wrapper.find('[data-testid="cancel-edit"]').exists()).toBe(false);
  });

  it('rejects empty or non-positive numbers instead of storing zero', async () => {
    const { wrapper } = render();
    const rows = wrapper.findAll('.item-row').length;
    await wrapper.get('[aria-label="物品名称"]').setValue('坏数据');
    await wrapper.get('[aria-label="物品长度(厘米)"]').setValue('');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.findAll('.item-row')).toHaveLength(rows);
    await wrapper.get('[aria-label="物品长度(厘米)"]').setValue('10');
    await wrapper.get('[aria-label="物品重量(千克)"]').setValue('0');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.findAll('.item-row')).toHaveLength(rows);
    expect(wrapper.text()).not.toContain('坏数据');
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    await wrapper.get('[aria-label="物品重量(千克)"]').setValue('-3');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('30×24×5 cm · 0.65 kg');
  });

  it('keeps must-have and fragile states independent through an edit', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 微单相机"]').trigger('click');
    expect((wrapper.get('[aria-label="物品易碎"]').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get('[aria-label="物品必带"]').element as HTMLInputElement).checked).toBe(false);
    await wrapper.get('[aria-label="物品必带"]').setValue(true);
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    await wrapper.get('[aria-label="编辑 微单相机"]').trigger('click');
    expect((wrapper.get('[aria-label="物品易碎"]').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get('[aria-label="物品必带"]').element as HTMLInputElement).checked).toBe(true);
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
