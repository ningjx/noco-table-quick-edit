import { Plugin, QuickEditFormModel } from '@nocobase/client-v2';
import { openChoiceEditor, openIconEditor } from '../shared/InlineOverlayEditor';

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

const PATCH_FLAG = '__ningInlineEditPatched__';
let openNativeQuickEdit: ((options: QuickEditOptions) => Promise<void>) | undefined;

function inputTypeFor(field: any) {
  if (['number', 'integer', 'percent'].includes(field?.interface)) return 'number';
  if (['date'].includes(field?.interface)) return 'date';
  if (['datetime', 'datetimeNoTz'].includes(field?.interface)) return 'datetime-local';
  if (field?.interface === 'time') return 'time';
  if (field?.interface === 'email') return 'email';
  if (field?.interface === 'phone') return 'tel';
  if (field?.interface === 'password') return 'password';
  if (field?.interface === 'url') return 'url';
  if (field?.interface === 'color') return 'color';
  return 'text';
}

function isMultilineField(field: any) {
  const component = field?.uiSchema?.['x-component'];
  return ['textarea', 'textArea', 'text'].includes(field?.interface) || component === 'Input.TextArea';
}

function isAttachmentField(field: any) {
  return field?.interface === 'attachment' || field?.target === 'attachments';
}

function isEnumField(field: any) {
  return ['select', 'multipleSelect', 'radioGroup', 'checkboxGroup'].includes(field?.interface);
}

function getEnumOptions(field: any) {
  const values = field?.uiSchema?.enum;
  if (!Array.isArray(values)) return [] as Array<{ label: string; value: any; color?: string }>;
  return values.map((item: any) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return { label: String(item.label ?? item.value ?? ''), value: item.value ?? item.label, color: item.color };
    }
    return { label: String(item), value: item };
  });
}

function usesCustomInlineEditor(field: any) {
  return (
    isAttachmentField(field) ||
    isMultilineField(field) ||
    isEnumField(field) ||
    field?.interface === 'checkbox' ||
    field?.interface === 'icon' ||
    ['input', 'email', 'phone', 'password', 'url', 'number', 'integer', 'percent', 'date', 'datetime', 'datetimeNoTz', 'time', 'color'].includes(field?.interface)
  );
}

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

async function saveValue(options: QuickEditOptions, value: any, updateAssociationValues: string[] = []) {
  await options.flowEngine.context.api.request({
    url: `${options.collectionName}:update`,
    method: 'post',
    params: { filterByTk: options.filterByTk, updateAssociationValues },
    headers: { 'X-Data-Source': options.dataSourceKey },
    data: { [options.fieldPath]: value },
  });
  options.record[options.fieldPath] = value;
  options.onSuccess?.({ [options.fieldPath]: value });
}

async function openAttachmentPicker(options: QuickEditOptions, field: any, cell: HTMLElement) {
  if (cell.querySelector('[data-ning-inline-editor]')) return;

  const picker = document.createElement('input');
  picker.dataset.ningInlineEditor = 'true';
  picker.type = 'file';
  picker.style.display = 'none';
  picker.multiple = field?.getComponentProps?.()?.multiple !== false;
  const accept = field?.getComponentProps?.()?.accept;
  if (accept) picker.accept = accept;
  cell.appendChild(picker);

  const cleanup = () => {
    picker.remove();
    window.removeEventListener('focus', cleanupAfterDialog);
  };
  const cleanupAfterDialog = () => {
    // The browser restores focus for both selecting a file and pressing Cancel.
    // Defer one task so a following change event can read picker.files first.
    window.setTimeout(cleanup, 0);
  };

  picker.addEventListener('cancel', cleanup, { once: true });
  window.addEventListener('focus', cleanupAfterDialog, { once: true });

  picker.addEventListener(
    'change',
    async () => {
      const files = Array.from(picker.files || []);
      cleanup();
      if (!files.length) return;

      try {
        const fileManager = options.flowEngine.context.app?.pm?.get?.('@nocobase/plugin-file-manager');
        if (!fileManager?.uploadFile) throw new Error('File Manager plugin is unavailable');

        const uploaded = [] as any[];
        for (const file of files) {
          const result = await fileManager.uploadFile({
            file,
            fileCollectionName: field?.target || 'attachments',
            dataSourceKey: options.dataSourceKey,
            query: field?.storage ? { attachmentField: `${field.collectionName}.${field.name}` } : undefined,
          });
          if (result?.errorMessage) throw new Error(result.errorMessage);
          if (!result?.data) throw new Error('Upload response is empty');
          uploaded.push(result.data);
        }

        const current = asArray(options.record?.[options.fieldPath]);
        const next = picker.multiple ? [...current, ...uploaded] : uploaded.slice(-1);
        await saveValue(options, next, [options.fieldPath]);
      } catch (error: any) {
        options.flowEngine.context.message?.error(error?.message || options.flowEngine.context.t('Failed to save form data'));
      }
    },
    { once: true },
  );
  picker.click();
}

async function openInlineEditor(options: QuickEditOptions) {
  const cell = options.target?.closest?.('td');
  if (!cell || document.querySelector('[data-ning-inline-editor]')) return;

  const collection = options.flowEngine.context.dataSourceManager
    .getDataSource(options.dataSourceKey)
    ?.getCollection(options.collectionName);
  const field = collection?.getField(options.fieldPath);
  const original = options.record?.[options.fieldPath];
  // All non-trivial field types keep NocoBase's own editor, options and save pipeline.
  if (!usesCustomInlineEditor(field)) {
    return openNativeQuickEdit?.(options);
  }
  if (field?.interface === 'checkbox') {
    await saveValue(options, !Boolean(original));
    return;
  }
  if (isEnumField(field)) {
    openChoiceEditor({
      cell,
      value: original,
      choices: getEnumOptions(field),
      multiple: ['multipleSelect', 'checkboxGroup'].includes(field?.interface),
      onSave: (value) => saveValue(options, value),
      onError: () => options.flowEngine.context.message?.error(options.flowEngine.context.t('Failed to save form data')),
    });
    return;
  }
  if (field?.interface === 'icon') {
    openIconEditor({
      cell,
      value: original,
      onSave: (value) => saveValue(options, value),
      onError: () => options.flowEngine.context.message?.error(options.flowEngine.context.t('Failed to save form data')),
    });
    return;
  }
  if (isAttachmentField(field)) {
    await openAttachmentPicker(options, field, cell);
    return;
  }

  const multiline = isMultilineField(field);
  const input = document.createElement(multiline ? 'textarea' : 'input');
  input.dataset.ningInlineEditor = 'true';
  if (!multiline) (input as HTMLInputElement).type = inputTypeFor(field);
  input.value = original == null ? '' : String(original);
  input.style.cssText =
    multiline
      ? 'position:fixed;left:0;top:0;height:160px;min-height:0;box-sizing:border-box;border:1px solid #1677ff;border-radius:6px;padding:8px 10px;line-height:1.5;resize:vertical;outline:none;background:#fff;z-index:1100;overflow:auto;box-shadow:0 6px 16px rgba(0,0,0,.15);'
      : 'position:absolute;left:6px;right:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);min-height:0;box-sizing:border-box;border:1px solid #1677ff;border-radius:4px;padding:0 8px;outline:none;background:#fff;z-index:2;';

  const oldPosition = cell.style.position;
  cell.style.position = 'relative';
  const displays = Array.from(cell.children) as HTMLElement[];
  const previousDisplays = displays.map((element) => element.style.display);
  if (!multiline) {
    displays.forEach((element) => {
      element.style.visibility = 'hidden';
    });
    cell.appendChild(input);
  } else {
    const updateMultilinePosition = () => {
      const rect = cell.getBoundingClientRect();
      const left = Math.max(8, rect.left);
      input.style.left = `${left}px`;
      input.style.top = `${rect.bottom + 4}px`;
      input.style.width = `${Math.min(480, window.innerWidth - left - 16)}px`;
    };
    document.body.appendChild(input);
    updateMultilinePosition();
    window.addEventListener('resize', updateMultilinePosition);
    window.addEventListener('scroll', updateMultilinePosition, true);
    (input as any).__ningPositionCleanup = updateMultilinePosition;
  }
  input.focus();
  input.select();

  let finished = false;
  const close = () => {
    if (finished) return;
    finished = true;
    input.remove();
    const updateMultilinePosition = (input as any).__ningPositionCleanup;
    if (updateMultilinePosition) {
      window.removeEventListener('resize', updateMultilinePosition);
      window.removeEventListener('scroll', updateMultilinePosition, true);
    }
    cell.style.position = oldPosition;
    displays.forEach((element, index) => {
      element.style.visibility = '';
      element.style.display = previousDisplays[index] || '';
    });
  };
  const cancel = () => close();
  const save = async () => {
    if (finished) return;
    const rawValue = input.value;
    const value = input.type === 'number' && rawValue !== '' ? Number(rawValue) : rawValue || null;
    if (Object.is(value, original)) return close();
    input.disabled = true;
    try {
      await saveValue(options, value);
      close();
    } catch (error) {
      input.disabled = false;
      input.focus();
      options.flowEngine.context.message?.error(options.flowEngine.context.t('Failed to save form data'));
    }
  };

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    }
    if (event.key === 'Escape') cancel();
  });
  input.addEventListener('blur', () => void save(), { once: true });
}

export class PluginExcelInlineTableClientV2 extends Plugin {
  async load() {
    const quickEdit = QuickEditFormModel as any;
    if (quickEdit[PATCH_FLAG]) return;
    quickEdit[PATCH_FLAG] = true;
    openNativeQuickEdit = quickEdit.open.bind(quickEdit);

    // TableBlockModel invokes this method only after its built-in ACL and
    // per-column "Enable quick edit" checks have passed.
    quickEdit.open = openInlineEditor;

    // NocoBase's native table only exposes quick edit through a hover icon.
    // A capture listener turns a normal cell click into that same authorized flow.
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

export default PluginExcelInlineTableClientV2;
