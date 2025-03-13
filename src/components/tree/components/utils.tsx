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
import { CDTTreeItem, CDTTreeItemResource, CDTTreeTableStringColumn } from '../types';

export function classNames(...classes: (string | Record<string, boolean> | undefined)[]): string {
    return classes.map(className => {
        if (!className) {
            return '';
        }
        if (typeof className === 'string') {
            return className;
        }
        return Object.entries(className).filter(([, value]) => value).map(([key]) => key);
    }).filter(className => className.length > 0).join(' ');
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
    </div>;

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
 * Recursively filters the tree to include items that match the search text
 * and their ancestor hierarchy. If children are not to be filtered, all children
 * of a matched item are included. Elements that match the search text are marked.
 */
export function filterTree<T extends CDTTreeItemResource>(
    items: CDTTreeItem<T>[],
    searchText: string,
    options: { filterChildren?: boolean } = { filterChildren: false }
): CDTTreeItem<T>[] {
    const matching: CDTTreeItem<T>[] = [];
    items.forEach(item => {
        // Check if the current item matches the search
        const matches = Object.values(item.columns ?? {})
            .filter(column => column.type === 'string')
            .some(column =>
                ((column as CDTTreeTableStringColumn).label || '').toLowerCase().includes(searchText.toLowerCase())
            );

        if (matches) {
            // item matches: show all or only matching children
            const children = options.filterChildren
                ? item.children ? filterTree(item.children, searchText, options) : []
                : item.children ?? [];
            matching.push({
                ...item,
                children: children.length > 0 ? children : undefined,
                matching: true,
            });
        } else if (item.children) {
            // item does not match: check if a child matches as we need to show the item as ancestor in that case
            const matchingChildren = filterTree(item.children, searchText, options);
            if (matchingChildren.length > 0) {
                matching.push({
                    ...item,
                    children: matchingChildren,
                    matching: false
                });
            }
        }
    });
    return matching;
}

/**
 * Options for traversing the tree.
 */
export interface TraverseOptions<T extends CDTTreeItemResource, U> {
    /**
     * A predicate function to determine if an item should be included.
     * If omitted, all items are included.
     */
    predicate?: (item: CDTTreeItem<T>) => boolean;

    /**
     * A mapping function to transform items.
     * If omitted, items are returned as-is.
     */
    mapper?: (item: CDTTreeItem<T>) => U;
}

/**
 * Recursively traverses the tree, optionally filtering and mapping items.
 *
 * @param items - The root items of the tree.
 * @param options - Optional traversal options including predicate and mapFn.
 * @returns An array of items that satisfy the predicate and are optionally mapped.
 */
export function traverseTree<T extends CDTTreeItemResource, U = CDTTreeItem<T>>(
    items: CDTTreeItem<T>[],
    options?: TraverseOptions<T, U>
): U[] {
    const result: U[] = [];

    const { predicate, mapper } = options || {};

    for (const item of items) {
        // Determine if the current item satisfies the predicate
        const shouldInclude = predicate ? predicate(item) : true;

        if (shouldInclude) {
            // Apply the mapping function if provided, else return the item as-is
            const mappedItem = mapper ? mapper(item) : (item as unknown as U);
            result.push(mappedItem);
        }

        if (item.children && item.children.length > 0) {
            // Recursively traverse the children
            const childResults = traverseTree(item.children, options);

            // If mapping is applied, childResults are already mapped
            // Push all child results into the main result array
            result.push(...childResults);
        }
    }
    return result;
}

export function getAncestors<T extends CDTTreeItemResource>(
    item: CDTTreeItem<T>
): CDTTreeItem<CDTTreeItemResource>[] {
    const ancestors: CDTTreeItem<CDTTreeItemResource>[] = [];
    let current: CDTTreeItem<CDTTreeItemResource> | undefined = item.parent;
    while (current) {
        ancestors.push(current);
        current = current.parent as unknown as CDTTreeItem<T>;
    }
    return ancestors;
}
