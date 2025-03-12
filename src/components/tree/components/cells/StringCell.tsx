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
    onEdit?: (record: CDTTreeItem<T>, edit: boolean) => void;
}

const StringCell = <T extends CDTTreeItemResource>({ column, record, editing = false, onSubmit, onCancel, onEdit }: StringCellProps<T>) => {
    const handleSubmit = useCallback(
        (newValue: string) => onSubmit?.(record, newValue),
        [record, onSubmit]
    );

    const handleCancel = useCallback(
        () => onCancel?.(record),
        [record, onCancel]
    );

    const handleEdit = useCallback(
        (edit: boolean) => onEdit?.(record, edit),
        [record, onEdit]
    );


    return column.edit && onSubmit
        ? <EditableStringCell record={record} column={column} onSubmit={handleSubmit} onCancel={handleCancel} onEdit={handleEdit} editing={editing} />
        : <LabelCell record={record} column={column} />;
};

export default StringCell;
