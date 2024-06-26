/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import { Tree, TreeEventNodeEvent, TreeNodeClickEvent } from 'primereact/tree';
import { TreeNode } from 'primereact/treenode';
import { classNames } from 'primereact/utils';
import React from 'react';
import { useCDTTreeContext } from '../tree-context';
import { CDTTreeItem, CTDTreeMessengerType, CTDTreeWebviewContext } from '../types';
import './common.css';
import { SearchOverlay } from './search-overlay';
import './tree.css';
import { createActions, createHighlightedText, createLabelWithTooltip } from './utils';

export type ComponentTreeProps = {
    nodes?: CDTTreeItem[];
    selectedNode?: CDTTreeItem;
};

export const ComponentTree = ({ nodes, selectedNode }: ComponentTreeProps) => {
    // Assemble the tree
    if (nodes === undefined) {
        return <div>loading</div>;
    }

    if (!nodes.length) {
        return <div>No children provided</div>;
    }

    const treeContext = useCDTTreeContext();
    const [filter, setFilter] = React.useState<string | undefined>();
    const searchRef = React.useRef<SearchOverlay>(null);

    // Event handler
    const onToggle = (event: TreeEventNodeEvent) => {
        if (event.node.leaf) {
            // Cannot expand leaf || already expanded
            return;
        }
        treeContext.notify(CTDTreeMessengerType.toggleNode, event.node);
    };

    const onClick = (event: TreeNodeClickEvent) => {
        treeContext.notify(CTDTreeMessengerType.clickNode, event.node);
    };

    // Sub components
    const nodeTemplate = (node: TreeNode) => {
        CDTTreeItem.assert(node);
        return <div className='tree-node'
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: node.id, cdtTreeItemPath: node.data.path })}
        >
            {createLabelWithTooltip(createHighlightedText(node.label, node.data.options?.highlights), node.data.options?.tooltip)}
            {createActions(treeContext, node)}
        </div>;
    };

    const togglerTemplate = (node: TreeNode) => {
        return <div className={
            classNames('tree-toggler-container', 'codicon', {
                'codicon-chevron-down': node.expanded,
                'codicon-chevron-right': !node.expanded && !node.leaf,
            })
        }>
        </div>;
    };

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
        <SearchOverlay key={'search'} ref={searchRef} onHide={onSearchHide} onShow={onSearchShow} onChange={onSearchChange} />
        <Tree
            value={nodes}
            className="w-full md:w-30rem"
            style={{ minWidth: '10rem' }}
            nodeTemplate={nodeTemplate}
            togglerTemplate={togglerTemplate}
            selectionMode='single'
            selectionKeys={selectedNode?.key?.toString()}
            onNodeClick={event => onClick(event)}
            onExpand={event => onToggle(event)}
            onCollapse={event => onToggle(event)}
            filter={true}
            filterMode='strict'
            filterValue={filter}
            onFilterValueChange={() => { /* needed as otherwise the filter value is not taken into account */ }}
            showHeader={false}
        />
    </div>;
};

