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
import { createActions, createHighlightedText, createLabelWithTooltip } from './utils';
import { ProgressBar } from 'primereact/progressbar';

export type ComponentTreeProps = {
    nodes?: CDTTreeItem[];
    selectedNode?: CDTTreeItem;
    isLoading: boolean;
};

export const ComponentTree = (props: ComponentTreeProps) => {
    const treeContext = useCDTTreeContext();
    const [showProgressBar, setShowProgressBar] = useState(false);

    useEffect(() => {
        if (!props.isLoading) {
            // Delay hiding the progress bar to allow the animation to complete
            const timer = setTimeout(() => {
                setShowProgressBar(false);
            }, 200);
            return () => clearTimeout(timer);
        } else {
            setShowProgressBar(true);
        }
    }, [props.isLoading]);

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
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: node.id, cdtTreeItemPath: node.path })}
        >
            {createLabelWithTooltip(createHighlightedText(node.label, node.options?.highlights), node.options?.tooltip)}
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

    return <div>
        <div style={{ height: '2px' }}>
            {showProgressBar &&
                <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
            }
        </div>
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
        />
    </div >;
};

