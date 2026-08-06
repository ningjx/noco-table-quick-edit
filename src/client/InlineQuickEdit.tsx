import { FormItem, useCollection, useCollectionManager_deprecated, useToken } from '@nocobase/client';
import { createForm, Field } from '@formily/core';
import { FormContext, RecursionField, observer, useField, useFieldSchema } from '@formily/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * v1 replacement for NocoBase's QuickEdit decorator.
 * It deliberately keeps the built-in field and permission behaviour, but
 * renders the editor inside the table cell instead of opening a popover.
 */
const InlineEditable = observer((props: { children?: React.ReactNode }) => {
  const field = useField<Field>() as any;
  const fieldSchema = useFieldSchema();
  const { token } = useToken();
  const [editing, setEditing] = useState(false);
  const originalValue = useRef(field.value);
  const editorRef = useRef<HTMLDivElement>(null);

  const readPrettySchema: any = {
    name: fieldSchema.name,
    'x-collection-field': fieldSchema['x-collection-field'],
    'x-component': 'CollectionField',
    'x-read-pretty': true,
    default: field.value,
    'x-component-props': fieldSchema['x-component-props'],
  };
  const readPrettyForm = useMemo(
    () => createForm({ values: { [fieldSchema.name]: field.value } }),
    [field.value, fieldSchema.name, fieldSchema['x-component-props']],
  );

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      editorRef.current?.querySelector<HTMLElement>('input,textarea,[tabindex]')?.focus();
    });
    return () => window.clearTimeout(timer);
  }, [editing]);

  const stopEditing = () => setEditing(false);
  const cancel = () => {
    field.setValue(originalValue.current);
    stopEditing();
  };

  if (editing) {
    return (
      <FormItem style={{ margin: 0, height: token.controlHeight, overflow: 'visible' }} labelStyle={{ display: 'none' }}>
        <div
          ref={editorRef}
          className="nb-inline-quick-edit"
          style={{ height: token.controlHeight, display: 'flex', alignItems: 'center' }}
          onBlurCapture={() => {
            window.setTimeout(() => {
              if (!editorRef.current?.contains(document.activeElement)) stopEditing();
            });
          }}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
        >
          {props.children}
        </div>
      </FormItem>
    );
  }

  return (
    <FormItem style={{ margin: 0, height: token.controlHeight }} labelStyle={{ display: 'none' }}>
      <div
        className="nb-inline-quick-edit"
        style={{ minHeight: token.controlHeight, padding: `1px ${token.paddingXS}px`, cursor: 'text' }}
        onClick={() => {
          originalValue.current = field.value;
          setEditing(true);
        }}
      >
        <FormContext.Provider value={readPrettyForm}>
          <RecursionField schema={readPrettySchema} name={fieldSchema.name} />
        </FormContext.Provider>
      </div>
    </FormItem>
  );
});

export const InlineQuickEdit = observer((props: { children?: React.ReactNode }) => {
  const field = useField<Field>();
  const { getCollectionJoinField } = useCollectionManager_deprecated();
  const collection = useCollection();
  const fieldSchema = useFieldSchema();
  const collectionField =
    getCollectionJoinField(fieldSchema['x-collection-field']) || collection?.getField(fieldSchema.name);

  if (!collectionField) return null;
  return field.editable || field.disabled ? <InlineEditable {...props} /> : <FormItem {...props} style={{ margin: 0 }} />;
});
