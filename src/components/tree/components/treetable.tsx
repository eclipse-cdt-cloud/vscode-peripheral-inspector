/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './common.css';
import './treetable.css';

import { Column } from 'primereact/column';
import { TreeNode } from 'primereact/treenode';
import { TreeTable, TreeTableEvent } from 'primereact/treetable';
import { classNames } from 'primereact/utils';
import React, { useEffect, useState } from 'react';
import { useCDTTreeContext } from '../tree-context';
import { CDTTreeItem, CDTTreeTableColumnDefinition, CDTTreeTableExpanderColumn, CDTTreeTableStringColumn, CTDTreeMessengerType, CTDTreeWebviewContext } from '../types';
import { createActions, createHighlightedText, createIcon, createLabelWithTooltip } from './utils';
import { SearchOverlay } from './search-overlay';
import { ProgressBar } from 'primereact/progressbar';

export type ComponentTreeTableProps = {
    nodes?: CDTTreeItem[];
    selectedNode?: CDTTreeItem;
    columnDefinitions?: CDTTreeTableColumnDefinition[];
    isLoading: boolean;
};

const PROGRESS_BAR_HIDE_DELAY = 200;

export const ComponentTreeTable = (props: ComponentTreeTableProps) => {
    const treeContext = useCDTTreeContext();
    const [showProgressBar, setShowProgressBar] = useState(false);
    const [filter, setFilter] = React.useState<string | undefined>();
    const searchRef = React.useRef<SearchOverlay>(null);

    useEffect(() => {
        if (!props.isLoading) {
            // Delay hiding the progress bar to allow the animation to complete
            const timer = setTimeout(() => {
                setShowProgressBar(false);
            }, PROGRESS_BAR_HIDE_DELAY);
            return () => clearTimeout(timer);
        } else {
            setShowProgressBar(true);
        }
    }, [props.isLoading]);

    // Assemble the treetable
    if (props.nodes === undefined) {
        return <div>
            <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
        </div>;
    }

    if (!props.nodes?.length) {
        return <div>No children provided</div>;
    }

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
    const template = (node: TreeNode, field: string) => {
        CDTTreeItem.assert(node);

        const column = node.data.columns?.[field];

        if (column?.type === 'expander') {
            return expanderTemplate(node, column);
        } else if (column?.type === 'string') {
            return stringTemplate(node, column);
        }

        return <span>No columns provided for field {field}</span>;
    };

    const expanderTemplate = (node: TreeNode, column: CDTTreeTableExpanderColumn) => {
        CDTTreeItem.assert(node);

        return <div style={{ paddingLeft: `${((node.data.path.length ?? 1)) * 8}px` }}
        >
            <div className='treetable-node' >
                <div
                    className={
                        classNames('tree-toggler-container', 'codicon', {
                            'codicon-chevron-down': node.expanded,
                            'codicon-chevron-right': !node.expanded && !node.leaf,
                        })
                    }>
                </div>
                {createIcon(node)}
                {createLabelWithTooltip(<span>{column.label}</span>, column.tooltip)}
            </div>
        </div>;
    };

    const stringTemplate = (node: CDTTreeItem, column: CDTTreeTableStringColumn) => {
        const text = createHighlightedText(column.label, column.highlight);

        return <div
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: node.id, cdtTreeItemPath: node.data.path })}
        >
            {createLabelWithTooltip(text, column.tooltip)}
        </div>;
    };

    const togglerTemplate = () => {
        return <div></div>;
    };

    const actionsTemplate = (node: TreeNode) => {
        return <div className='flex align-items-center justify-content-end'>
            {createActions(treeContext, node)}
        </div>;
    };

    const expandedState = getExpandedState(props.nodes);
    const selectedKey = props.selectedNode ? props.selectedNode.key as string : undefined;

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            searchRef.current?.show();
        }
    };

    const onSearchShow = () => setFilter(searchRef.current?.value());
    const onSearchHide = () => setFilter(undefined);
    const onSearchChange = (text: string) => setFilter(text);

    return <div onKeyDown={onKeyDown}>
        <div className='progress-bar-container'>
            {showProgressBar &&
                <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
            }
        </div>
        <SearchOverlay key={'search'} ref={searchRef} onHide={onSearchHide} onShow={onSearchShow} onChange={onSearchChange} />
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
            filterMode='strict' // continue searching on children
            globalFilter={filter}
        >
            {props.columnDefinitions?.map(c => {
                return <Column key={`${c.field}_column`} field={c.field} body={(node) => template(node, c.field)} expander={c.expander} filter={true} />;
            })}
            <Column key={'actions'} field="actions" style={{ width: '64px' }} body={actionsTemplate} />
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
