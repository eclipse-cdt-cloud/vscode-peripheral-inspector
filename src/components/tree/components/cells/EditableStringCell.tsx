import './editable-string-cell.css';

import { Checkbox, Input, Select } from 'antd';
import type { CheckboxChangeEvent } from 'antd/lib/checkbox';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CDTTreeItem, CDTTreeItemResource, EditableCDTTreeTableStringColumn, EditableEnumData } from '../../types';
import LabelCell from './LabelCell';

interface EditableLabelCellProps<T extends CDTTreeItemResource> {
    column: EditableCDTTreeTableStringColumn;
    record: CDTTreeItem<T>;
    editing: boolean;
    onSubmit: (newValue: string) => void;
    onCancel: () => void;
    onEdit?: (edit: boolean) => void;
}

const EditableLabelCell = <T extends CDTTreeItemResource>({
    column,
    record,
    editing,
    onSubmit,
    onCancel,
    onEdit
}: EditableLabelCellProps<T>) => {
    const [value, setValue] = useState(column.edit.value);
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorRef = useRef<any>(null);

    useEffect(() => setValue(column.edit.value), [editing, column.edit.value]); // keep editMode in the dependencies to sync state when entering or leaving edit mode

    const commitEdit = useCallback((newValue: string = value, event?: { stopPropagation: () => void; preventDefault: () => void; }) => {
        event?.stopPropagation();
        event?.preventDefault();
        setValue(newValue);
        onSubmit(newValue);
        onEdit?.(false);
    }, [onSubmit, value]);

    const cancelEdit = useCallback(() => {
        setValue(column.edit.value);
        onCancel();
        onEdit?.(false);
    }, [column.edit.value, onCancel, onEdit]);

    // Cancel the edit only if focus leaves the entire container.
    const handleBlur = useCallback(() => {
        setTimeout(() => {
            if (
                containerRef.current &&
                document.activeElement &&
                !containerRef.current.contains(document.activeElement)
            ) {
                cancelEdit();
            }
        }, 0);
    }, [cancelEdit]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                cancelEdit();
            }
            e.stopPropagation();
        },
        [cancelEdit]
    );

    // Consume the double-click event so no other handler is triggered.
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (column.edit) {
            onEdit?.(true);
        }
    }, [column, onEdit]);

    // Focus the editor when entering edit mode.
    useEffect(() => {
        if (editing && editorRef.current) {
            editorRef.current.focus();
        }
    }, [editing]);

    if (editing) {
        return (
            <div className='edit-field-container' ref={containerRef}>
                {(() => {
                    switch (column.edit?.type) {
                        case 'text':
                            return (
                                <Input
                                    ref={editorRef}
                                    className={'text-field-cell'}
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    onPressEnter={e => commitEdit(e.currentTarget.value, e)}
                                    onBlur={handleBlur}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                />
                            );
                        case 'boolean': {
                            const checked = value === '1';
                            return (
                                <Checkbox
                                    ref={editorRef}
                                    checked={checked}
                                    onChange={(e: CheckboxChangeEvent) => commitEdit(e.target.checked ? '1' : '0', e)}
                                    onBlur={handleBlur}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                />
                            );
                        }
                        case 'enum': {
                            const enumEdit = column.edit as EditableEnumData;
                            return (
                                <Select
                                    ref={editorRef}
                                    className={'enum-field-cell'}
                                    placeholder={column.label}
                                    value={value}
                                    onChange={(newValue) => commitEdit(newValue)}
                                    onBlur={handleBlur}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                >
                                    {enumEdit.options.map((opt) => {
                                        return (
                                            <Select.Option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </Select.Option>
                                        );
                                    })}
                                </Select>
                            );
                        }
                        default:
                            return null;
                    }
                })()}
            </div>
        );
    }

    return (
        <div
            className='editable-string-cell'
            onDoubleClick={handleDoubleClick}
            style={{ cursor: column.edit ? 'pointer' : 'default' }}
        >
            <LabelCell record={record} column={column} />
        </div>
    );
};

export default React.memo(EditableLabelCell);
