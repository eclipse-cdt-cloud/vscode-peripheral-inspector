/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import './common.css';
import './treetable.css';

import { Column } from 'primereact/column';
import { TreeNode } from 'primereact/treenode';
import { TreeTable, TreeTableEvent } from 'primereact/treetable';
import React from 'react';
import { useCDTTreeContext } from '../tree-context';
import { CDTTreeItem, CDTTreeTableColumnDefinition, CTDTreeMessengerType } from '../types';
import { LabelCell } from './LabelCell';
import { TextFieldCell } from './TextFieldCell';
import { createActions } from './utils';

export type ComponentTreeTableProps = {
    nodes?: CDTTreeItem[];
    selectedNode?: CDTTreeItem;
    columnDefinitions?: CDTTreeTableColumnDefinition[];
};

export const ComponentTreeTable = (props: ComponentTreeTableProps) => {
    // Assemble the treetable
    if (props.nodes === undefined) {
        return <div>loading</div>;
    }

    if (!props.nodes?.length) {
        return <div>No children provided</div>;
    }

    const treeContext = useCDTTreeContext();

    // Event handler
    const onToggle = (event: TreeTableEvent) => {
        if (event.node.leaf) {
            // Cannot expand leaf || already expanded
            return;
        }
        treeContext.notify(CTDTreeMessengerType.toggleNode, event.node);
    };

    const onClick = (event: TreeTableEvent) => {
        treeContext.notify(CTDTreeMessengerType.clickNode, event.node);
    };

    // Sub Components
    const cellRenderer = (node: TreeNode, field: string, expander: boolean) => {
        CDTTreeItem.assert(node);

        const column = node.columns?.[field];
        if (!column) {
            return <span>No columns provided for field {field}</span>;
        }

        if (column.edit?.type === 'text') {
            return <TextFieldCell key={node.id} row={node} cell={column} expander={expander} field={field} />;
        }
        return <LabelCell key={node.id} row={node} cell={column} expander={expander} />;
    };

    const togglerTemplate = () => {
        return <div></div>;
    };

    const actionsRenderer = (node: TreeNode) => {
        return <div className='flex align-items-center justify-content-end'>
            {createActions(treeContext, node)}
        </div>;
    };

    const expandedState = getExpandedState(props.nodes);
    const selectedKey = props.selectedNode ? props.selectedNode.key as string : undefined;

    return <div>
        <TreeTable
            value={props.nodes}
            selectionKeys={selectedKey}
            expandedKeys={expandedState}
            tableStyle={{ minWidth: '10rem' }}
            selectionMode='single'
            togglerTemplate={togglerTemplate}
            onToggle={(_event) => {
                // This function is required to be a NO OP
                // Otherwise expanding doesn't work
            }}
            onExpand={event => onToggle(event)}
            onCollapse={event => onToggle(event)}
            onRowClick={event => onClick(event)}
        >
            {props.columnDefinitions?.map((column, idx) => {
                return <Column key={column.field + '-column'} field={column.field} body={(node) => cellRenderer(node, column.field, idx === 0)} expander={idx === 0} />;
            })}
            <Column key={'actions-column'} field="actions" style={{ width: '64px' }} body={actionsRenderer} />
        </TreeTable>
    </div>;
};

function getExpandedState(nodes?: CDTTreeItem[]): Record<string, boolean> {
    if (nodes === undefined) {
        return {};
    }

    const expandedKeys: Record<string, boolean> = {};

    function traverse(node: CDTTreeItem): void {
        if (node.expanded) {
            expandedKeys[node.key ?? 'unknown'] = true;
        }
        for (const child of node.children ?? []) {
            traverse(child);
        }
    }

    for (const node of nodes) {
        traverse(node);
    }

    return expandedKeys;
}
