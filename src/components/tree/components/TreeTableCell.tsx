/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import React, { ComponentType, HTMLAttributes } from 'react';
import { CDTTreeItem, CDTTreeTableColumn, CTDTreeMessengerType, CTDTreeWebviewContext } from '../types';
import { Codicon } from './Codicon';
import { ExpandToggle } from './Expander';
import { useCDTTreeContext } from '../tree-context';
import { LabelCell } from './LabelCell';
import { classNames } from 'primereact/utils';

export interface AsTreeTableCellProps {
    row: CDTTreeItem;
    cell: CDTTreeTableColumn;
    expander?: boolean;
    cellProps?: HTMLAttributes<HTMLElement>;
}

export const AsTreeTableCell = <P extends AsTreeTableCellProps>(Component: ComponentType<P>) => {
    const AsTreeTableCell = React.forwardRef<HTMLElement, P & AsTreeTableCellProps>((props, ref) => {
        const { cellProps, ...componentProps } = props;
        const { row, cell, expander } = componentProps;
        return (
            <div {...cellProps} className={classNames('treetable-node', 'treetable-cell', cellProps?.className)}
                {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: row.id, cdtTreeItemPath: row.path, context: row.options?.contextValue })}
            >
                {expander && <ExpandToggle item={row} depth={row.path.length ?? 1} />}
                {cell.icon && <Codicon icon={cell.icon} />}
                <Component {...componentProps as P} ref={ref} />
            </div>
        );
    });
    return AsTreeTableCell;
};


export interface AsEditableTreeTableCellProps extends AsTreeTableCellProps {
    field: string;
}

export interface EditableComponentRef {
    focus: () => void;
}

export interface EditableComponentProps {
    onCancelEdit: () => void;
    onSubmitValue: (value: string) => void;
    labelProps?: HTMLAttributes<HTMLElement>;
}

export const AsEditable = <P extends EditableComponentProps>(EditComponent: ComponentType<P>): React.FC<Omit<P, 'onSubmitValue' | 'onCancelEdit'> & AsEditableTreeTableCellProps> => {
    return (props) => {
        const [isEditMode, setEditMode] = React.useState(false);
        const editComponent = React.useRef<EditableComponentRef>(null);
        const treeContext = useCDTTreeContext();
        const { labelProps, cell, row, expander, field } = props;

        React.useEffect(() => {
            if (isEditMode && editComponent.current) {
                editComponent.current.focus();
            }
        }, [isEditMode]);

        const onStartEdit = (event: React.MouseEvent) => {
            setEditMode(true);
            event.stopPropagation();
        };

        const onCancelEdit = () => {
            setEditMode(false);
        };

        const onSubmitValue = (value: string) => {
            treeContext.notify(CTDTreeMessengerType.changeValue, {
                field,
                item: row,
                value
            });
            setEditMode(false);
        };

        return isEditMode
            ? <EditComponent
                {...(props as unknown as P)}
                ref={editComponent}
                onCancelEdit={onCancelEdit}
                onSubmitValue={onSubmitValue}
            />
            : <LabelCell cellProps={{ className: 'editable' }} className='editable' cell={cell} row={row} expander={expander} {...labelProps} onDoubleClick={onStartEdit} onClick={() => { /* capture so no expansion */ }} />;
    };
};
