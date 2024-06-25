/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import { TreeNode } from 'primereact/treenode';
import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CommandDefinition } from '../../../common';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip/tooltip';
import { CDTTreeContext } from '../tree-context';
import { CDTTreeItem, CTDTreeMessengerType } from '../types';

export function createHighlightedText(label?: string, highlights?: [number, number][]): React.JSX.Element {
    if (label === undefined) {
        return <span>No label provided</span>;
    }
    if (highlights === undefined) {
        return <span>{label}</span>;
    }

    highlights.sort((a, b) => a[0] - b[0]);

    const result: React.JSX.Element[] = [];
    let currentPosition = 0;

    highlights.forEach(([start, end], index) => {
        if (currentPosition < start) {
            result.push(<span key={`text-${index}`}>{label.slice(currentPosition, start)}</span>);
        }
        result.push(<span key={`highlight-${index}`} className="label-highlight">{label.slice(start, end + 1)}</span>);
        currentPosition = end + 1;
    });

    // Add any remaining text after the last highlight
    if (currentPosition < label.length) {
        result.push(<span key="text-end">{label.slice(currentPosition)}</span>);
    }

    return <span>{result}</span>;
}

export function createLabelWithTooltip(child: React.JSX.Element, tooltip?: string): React.JSX.Element {
    const label = <div className="tree-label flex-auto flex align-items-center">
        {child}
    </div >;

    if (tooltip === undefined) {
        return label;
    }

    return <Tooltip>
        <TooltipTrigger>
            {label}
        </TooltipTrigger>
        <TooltipContent>
            <Markdown className="markdown" remarkPlugins={[remarkGfm]}>{tooltip}</Markdown>
        </TooltipContent>
    </Tooltip>;
}


export function createActions(context: CDTTreeContext, node: TreeNode): React.JSX.Element {
    CDTTreeItem.assert(node);

    const onClick = (event: React.MouseEvent, action: CommandDefinition) => {
        context.notify(CTDTreeMessengerType.executeCommand, { commandId: action.commandId, item: node });
        event.stopPropagation();
    };

    return <div className="tree-actions">
        {node.options?.commands?.map(a => <i key={a.commandId} className={`codicon codicon-${a.icon}`} onClick={(event) => onClick(event, a)}></i>)}
    </div>;
}


export function createIcon(node: TreeNode): React.JSX.Element | undefined {
    if (node.icon === undefined) {
        return;
    }

    return <i className={`codicon codicon-${node.icon}`} style={{ marginRight: '0.5rem' }}></i>;
}
