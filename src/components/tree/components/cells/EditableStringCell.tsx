import './editable-string-cell.css';

import { Checkbox, Input, Select } from 'antd';
import type { CheckboxChangeEvent } from 'antd/lib/checkbox';
import React, { useCallback, useEffect, useRef } from 'react';
import { CDTTreeItem, CDTTreeItemResource, EditableCDTTreeTableStringColumn } from '../../types';
import LabelCell from './LabelCell';

interface EditableLabelCellProps<T extends CDTTreeItemResource> {
    column: EditableCDTTreeTableStringColumn;
    record: CDTTreeItem<T>;
    editing: boolean;
    autoFocus: boolean;
    onSubmit: (newValue: string) => void;
    onCancel: () => void;
    onEdit?: (edit: boolean) => void;
}

const EditableLabelCell = <T extends CDTTreeItemResource>({
    column,
    record,
    editing,
    autoFocus,
    onSubmit,
    onCancel,
    onEdit
}: EditableLabelCellProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorRef = useRef<any>(null);

    const commitEdit = useCallback((newValue: string, event?: { stopPropagation: () => void; preventDefault: () => void; }) => {
        event?.stopPropagation();
        event?.preventDefault();
        onSubmit(newValue);
        onEdit?.(false);
    }, [onSubmit]);

    const cancelEdit = useCallback(() => {
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
        onEdit?.(true);
    }, [column, onEdit]);

    // Focus the editor when entering edit mode.
    useEffect(() => {
        if (editing && editorRef.current && autoFocus) {
            editorRef.current.focus();
        }
    }, [editing, autoFocus]);

    if (editing) {
        return (
            <div className='edit-field-container' ref={containerRef}>
                {(() => {
                    switch (column.edit.type) {
                        case 'text':
                            return (
                                <Input
                                    ref={editorRef}
                                    className={'text-field-cell'}
                                    defaultValue={column.edit.value}
                                    onPressEnter={e => commitEdit(e.currentTarget.value, e)}
                                    onBlur={handleBlur}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                />
                            );
                        case 'boolean': {
                            const checked = column.edit.value === '1';
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
                            return (
                                <Select
                                    ref={editorRef}
                                    className={'enum-field-cell'}
                                    placeholder={column.label}
                                    value={column.label} // we want to use 'Write Only' as value even if it is not an option
                                    onChange={(newValue) => commitEdit(newValue)}
                                    onBlur={handleBlur}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                >
                                    {column.edit.options.map((opt) => {
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
        <div className='editable-string-cell' onDoubleClick={handleDoubleClick}>
            <LabelCell record={record} column={column} />
        </div>
    );
};

export default React.memo(EditableLabelCell);
