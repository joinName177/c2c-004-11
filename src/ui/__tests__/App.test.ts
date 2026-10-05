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

  it('adds an item with full attributes and recomputes all plans', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('单反相机');
    await wrapper.get('[aria-label="物品长度"]').setValue('25');
    await wrapper.get('[aria-label="物品宽度"]').setValue('18');
    await wrapper.get('[aria-label="物品高度"]').setValue('12');
    await wrapper.get('[aria-label="物品重量"]').setValue('1.2');
    await wrapper.get('[aria-label="优先级"]').setValue('3');
    await wrapper.get('[aria-label="必带"]').setValue(true);
    await wrapper.get('[aria-label="易碎"]').setValue(true);
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('单反相机');
    expect(wrapper.text()).toContain('25×18×12 cm · 1.2 kg');
    expect(wrapper.text()).toContain('三套方案已重新计算');
    expect(wrapper.text()).toContain('规划已同步');
    const row = wrapper.findAll('.item-row').find((r) => r.text().includes('单反相机'));
    expect(row?.text()).toContain('易碎');
    expect(row?.get('.must-button').classes()).toContain('checked');
    expect(row?.get('.priority').text()).toBe('P3');
  });

  it('edits an existing item, keeps its identity and recomputes plans', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    expect((wrapper.get('[aria-label="物品重量"]').element as HTMLInputElement).value).toBe('0.65');
    await wrapper.get('[aria-label="物品重量"]').setValue('1.5');
    await wrapper.get('[aria-label="物品高度"]').setValue('8');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('30×24×8 cm · 1.5 kg');
    expect(wrapper.text()).toContain('三套方案已重新计算');
    expect(wrapper.text()).toContain('6 件');
    expect(wrapper.findAll('[data-item-id="jacket"]')).toHaveLength(2);
  });

  it('rejects empty or non-positive dimensions without touching items or plans', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('坏数据');
    await wrapper.get('[aria-label="物品长度"]').setValue('');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('大于 0');
    expect(wrapper.text()).not.toContain('坏数据');
    expect(wrapper.text()).toContain('6 件');
    expect(wrapper.text()).not.toContain('三套方案已重新计算');
    await wrapper.get('[aria-label="物品长度"]').setValue('-5');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('大于 0');
    expect(wrapper.text()).not.toContain('坏数据');
  });

  it('keeps the saved item and plans untouched when cancelling an edit', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    await wrapper.get('[aria-label="物品重量"]').setValue('9.9');
    await wrapper.get('[data-testid="cancel-edit"]').trigger('click');
    expect(wrapper.text()).toContain('30×24×5 cm · 0.65 kg');
    expect(wrapper.text()).not.toContain('三套方案已重新计算');
    expect((wrapper.get('[aria-label="物品重量"]').element as HTMLInputElement).value).toBe('0.3');
  });

  it('reopens the editor with the last confirmed values', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    await wrapper.get('[aria-label="物品高度"]').setValue('9');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    await wrapper.get('[aria-label="编辑 轻薄外套"]').trigger('click');
    expect((wrapper.get('[aria-label="物品高度"]').element as HTMLInputElement).value).toBe('9');
  });

  it('keeps fragile and must-have states independent while editing', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="编辑 微单相机"]').trigger('click');
    expect((wrapper.get('[aria-label="易碎"]').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get('[aria-label="必带"]').element as HTMLInputElement).checked).toBe(false);
    await wrapper.get('[aria-label="必带"]').setValue(true);
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    const row = wrapper.findAll('.item-row').find((r) => r.text().includes('微单相机'));
    expect(row?.text()).toContain('易碎');
    expect(row?.get('.must-button').classes()).toContain('checked');
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
