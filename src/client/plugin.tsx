import { Plugin } from '@nocobase/client';
import { QuickEditFormModel } from '@nocobase/client-v2';

type QuickEditOptions = {
  flowEngine: any;
  target: HTMLElement;
  dataSourceKey: string;
  collectionName: string;
  fieldPath: string;
  filterByTk?: string | number;
  record: Record<string, any>;
  onSuccess?: (values: Record<string, any>) => void;
};

const PATCH_FLAG = '__ningLegacyInlineEditPatched__';

function inputTypeFor(field: any) {
  if (['number', 'integer', 'percent'].includes(field?.interface)) return 'number';
  if (field?.interface === 'date') return 'date';
  return 'text';
}

async function openInlineEditor(options: QuickEditOptions) {
  const cell = options.target?.closest?.('td');
  if (!cell || cell.querySelector('[data-ning-inline-editor]')) return;

  const collection = options.flowEngine.context.dataSourceManager
    .getDataSource(options.dataSourceKey)
    ?.getCollection(options.collectionName);
  const field = collection?.getField(options.fieldPath);
  const original = options.record?.[options.fieldPath];
  const input = document.createElement('input');
  input.dataset.ningInlineEditor = 'true';
  input.type = inputTypeFor(field);
  input.value = original == null ? '' : String(original);
  input.style.cssText =
    'position:absolute;left:6px;right:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);min-height:0;box-sizing:border-box;border:1px solid #1677ff;border-radius:4px;padding:0 8px;outline:none;background:#fff;z-index:2;';

  const oldPosition = cell.style.position;
  cell.style.position = 'relative';
  const displays = Array.from(cell.children) as HTMLElement[];
  const previousDisplays = displays.map((element) => element.style.display);
  displays.forEach((element) => {
    element.style.visibility = 'hidden';
  });
  cell.appendChild(input);
  input.focus();
  input.select();

  let finished = false;
  const close = () => {
    if (finished) return;
    finished = true;
    input.remove();
    cell.style.position = oldPosition;
    displays.forEach((element, index) => {
      element.style.visibility = '';
      element.style.display = previousDisplays[index] || '';
    });
  };
  const save = async () => {
    if (finished) return;
    const rawValue = input.value;
    const value = input.type === 'number' && rawValue !== '' ? Number(rawValue) : rawValue || null;
    if (Object.is(value, original)) return close();
    input.disabled = true;
    try {
      await options.flowEngine.context.api.request({
        url: `${options.collectionName}:update`,
        method: 'post',
        params: { filterByTk: options.filterByTk, updateAssociationValues: [] },
        headers: { 'X-Data-Source': options.dataSourceKey },
        data: { [options.fieldPath]: value },
      });
      options.record[options.fieldPath] = value;
      options.onSuccess?.({ [options.fieldPath]: value });
      close();
    } catch {
      input.disabled = false;
      input.focus();
      options.flowEngine.context.message?.error(options.flowEngine.context.t('Failed to save form data'));
    }
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void save();
    if (event.key === 'Escape') close();
  });
  input.addEventListener('blur', () => void save(), { once: true });
}

export class PluginExcelInlineTableClient extends Plugin {
  async load() {
    const quickEdit = QuickEditFormModel as any;
    if (quickEdit[PATCH_FLAG]) return;
    quickEdit[PATCH_FLAG] = true;
    quickEdit.open = openInlineEditor;

    document.addEventListener(
      'click',
      (event) => {
        const source = event.target as HTMLElement | null;
        if (!source || source.closest('input,button,a,[role="button"],.edit-icon')) return;
        const cell = source.closest('td');
        const editIcon = cell?.querySelector<HTMLElement>('.edit-icon');
        if (!editIcon) return;
        event.preventDefault();
        event.stopPropagation();
        editIcon.click();
      },
      true,
    );
  }
}

export default PluginExcelInlineTableClient;
