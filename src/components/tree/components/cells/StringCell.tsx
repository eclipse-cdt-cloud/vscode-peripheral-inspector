import React, { useCallback } from 'react';
import { CDTTreeItem, CDTTreeItemResource, CDTTreeTableStringColumn } from '../../types';
import EditableStringCell from './EditableStringCell';
import LabelCell from './LabelCell';

interface StringCellProps<T extends CDTTreeItemResource> {
    column: CDTTreeTableStringColumn;
    record: CDTTreeItem<T>;
    editing?: boolean;
    onSubmit?: (record: CDTTreeItem<T>, newValue: string) => void;
    onCancel?: (record: CDTTreeItem<T>) => void;
}

const StringCell = <T extends CDTTreeItemResource>({ column, record, editing = false, onSubmit, onCancel }: StringCellProps<T>) => {
    const handleSubmit = useCallback(
        (newValue: string) => onSubmit?.(record, newValue),
        [record, onSubmit]
    );

    const handleCancel = useCallback(
        () => onCancel?.(record),
        [record, onCancel]
    );

    return column.edit && onSubmit
        ? <EditableStringCell record={record} column={column} onSubmit={handleSubmit} onCancel={handleCancel} editing={editing} />
        : <LabelCell record={record} column={column} />;
};

export default StringCell;
