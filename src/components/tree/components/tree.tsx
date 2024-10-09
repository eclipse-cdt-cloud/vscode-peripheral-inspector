/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './common.css';
import './tree.css';

import { Tree, TreeEventNodeEvent, TreeNodeClickEvent } from 'primereact/tree';
import { TreeNode } from 'primereact/treenode';
import { classNames } from 'primereact/utils';
import React, { useEffect, useState } from 'react';
import { useCDTTreeContext } from '../tree-context';
import { CDTTreeItem, CTDTreeMessengerType, CTDTreeWebviewContext } from '../types';
import { SearchOverlay } from './search-overlay';

import { createActions, createHighlightedText, createLabelWithTooltip } from './utils';
import { ProgressBar } from 'primereact/progressbar';

export type ComponentTreeProps = {
    nodes?: CDTTreeItem[];
    selectedNode?: CDTTreeItem;
    isLoading: boolean;
};

const PROGRESS_BAR_HIDE_DELAY = 200;

export const ComponentTree = (props: ComponentTreeProps) => {
    const treeContext = useCDTTreeContext();
    const [showProgressBar, setShowProgressBar] = useState(false);
    const [filter, setFilter] = React.useState<string | undefined>();
    const searchRef = React.useRef<SearchOverlay>(null);

    useEffect(() => {
        // Slightly delay showing/hiding the progress bar to avoid flickering
        const timer = setTimeout(() => setShowProgressBar(props.isLoading), PROGRESS_BAR_HIDE_DELAY);
        return () => clearTimeout(timer);
    }, [props.isLoading]);

    useEffect(() => {
        if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
            document.body.classList.add('has-scrollbar');
        } else {
            document.body.classList.remove('has-scrollbar');
        }
    });

    // Assemble the tree
    if (props.nodes === undefined) {
        return <div>loading</div>;
    }

    // Assemble the tree
    if (props.nodes === undefined) {
        return <div>
            <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
        </div>;
    }

    if (!props.nodes.length) {
        return <div>No children provided</div>;
    }

    // Event handler
    const onToggle = async (event: TreeEventNodeEvent) => {
        if (event.node.leaf) {
            // Cannot expand leaf || already expanded
            return;
        }
        treeContext.notify(CTDTreeMessengerType.toggleNode, event.node);
    };

    const onClick = async (event: TreeNodeClickEvent) => {
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
        <div className='progress-bar-container'>
            {showProgressBar &&
                <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
            }
        </div>
        <SearchOverlay key={'search'} ref={searchRef} onHide={onSearchHide} onShow={onSearchShow} onChange={onSearchChange} />
        <Tree
            value={props.nodes}
            className="w-full md:w-30rem"
            style={{ minWidth: '10rem' }}
            nodeTemplate={nodeTemplate}
            togglerTemplate={togglerTemplate}
            selectionMode='single'
            selectionKeys={props.selectedNode?.key?.toString()}
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

