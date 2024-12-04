/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip/tooltip';
import { CDTTreeItem, CDTTreeTableStringColumn } from '../types';

export function classNames(...classes: (string | Record<string, boolean>)[]): string {
    return classes.filter(c => c !== undefined).map(c => {
        if (typeof c === 'string') {
            return c;
        }

        return Object.entries(c).filter(([, value]) => value).map(([key]) => key);
    }).join(' ');
}

export function createHighlightedText(label?: string, highlights?: [number, number][]): React.JSX.Element {
    if (label === undefined) {
        return <span>No label provided</span>;
    }
    if (highlights === undefined || highlights.length === 0) {
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

    return <div className='tree-label'>
        <span>{result}</span>
    </div>;
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


/**
 * Recursively filters the tree to include only items that match the search text
 * and their ancestor hierarchy.
 */
export function filterTree<T>(
    items: CDTTreeItem<T>[],
    searchText: string
): CDTTreeItem<T>[] {
    const filtered: CDTTreeItem<T>[] = [];

    items.forEach(item => {
        const children = item.children ? filterTree(item.children, searchText) : [];

        // Check if the current item matches the search
        const matches = Object.values(item.columns ?? {})
            .filter(column => column.type === 'string')
            .some(column =>
                ((column as CDTTreeTableStringColumn).label || '').toLowerCase().includes(searchText.toLowerCase())
            );

        if (matches || children.length > 0) {
            filtered.push({
                ...item,
                // Only include children that match or have matching descendants
                children: children.length > 0 ? children : undefined,
                // Optionally, expand the parent if a child matches
                expanded: children.length > 0 || item.expanded,
            });
        }
    });
    return filtered;
}

export function allKeys<T>(items: CDTTreeItem<T>[]): string[] {
    const keys: string[] = [];
    const stack = [...items];
    while (stack.length) {
        const current = stack.pop();
        if (current) {
            keys.push(current.key);
            if (current.children) {
                stack.push(...current.children);
            }
        }
    }
    return keys;
}
