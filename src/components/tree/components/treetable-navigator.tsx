/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import { CDTTreeItem } from '../types';

export interface TreeNavigatorProps {
    ref: React.RefObject<HTMLDivElement>;
    rowIndex: Map<string, number>;
    expandedRowKeys: string[];
    expand: (expanded: boolean, record: CDTTreeItem) => void;
    select: (record: CDTTreeItem) => void;
}

/**
 * TreeNavigator is a helper class to navigate
 * through a tree table.
 */
export class TreeNavigator {
    constructor(private readonly props: TreeNavigatorProps) {
    }

    next(node: CDTTreeItem) {
        if (node.children && node.children.length > 0 && this.props.expandedRowKeys.includes(node.id)) {
            // Go deeper
            this.select(node.children[0]);
        } else {
            let nextNode = this.getNext(node);
            if (nextNode) {
                this.select(nextNode);
            } else {
                // Go to parent sibling recursively
                nextNode = this.getParentNext(node.parent);
                if (nextNode) {
                    this.select(nextNode);
                }
            }
        }
    }

    nextPage() {
        this.scrollRelative(this.visibleDomElementCount);
    }

    private getSiblings(node: CDTTreeItem): CDTTreeItem[] {
        return node.parent?.children?.filter(child => this.props.rowIndex.has(child.id)) ?? [];
    }

    private getNext(node: CDTTreeItem): CDTTreeItem | undefined {
        const siblings = this.getSiblings(node);
        const index = siblings.findIndex(n => n.id === node.id);
        return siblings[index + 1];
    }

    private getParentNext(node: CDTTreeItem | undefined): CDTTreeItem | undefined {
        if (!node) return undefined;
        const nextSibling = this.getNext(node);
        if (nextSibling) {
            return nextSibling;
        } else {
            return this.getParentNext(node.parent);
        }
    }

    previous(node: CDTTreeItem) {
        let prevNode = this.getPrevious(node);
        if (prevNode) {
            // Go deeper to the last child if the previous node has children and is expanded
            while (prevNode.children && prevNode.children.length > 0 && this.props.expandedRowKeys.includes(prevNode.id)) {
                prevNode = prevNode.children[prevNode.children.length - 1];
            }
            this.select(prevNode);
        } else {
            const parent = node.parent;
            // Go to parent if no previous sibling
            if (parent && !CDTTreeItem.isRoot(parent)) {
                this.select(parent);
            }
        }
    }

    previousPage() {
        this.scrollRelative(-(this.visibleDomElementCount - 1));
    }

    private getPrevious(node: CDTTreeItem): CDTTreeItem | undefined {
        const siblings = this.getSiblings(node);
        const index = siblings.findIndex(n => n.id === node.id);
        return siblings[index - 1];
    }

    toggle(node: CDTTreeItem) {
        if (this.props.expandedRowKeys.includes(node.id)) {
            this.collapse(node);
        } else {
            this.expand(node);
        }
    }

    expand(node: CDTTreeItem) {
        if (node.children && node.children.length > 0) {
            if (this.props.expandedRowKeys.includes(node.id)) {
                this.next(node);
            } else {
                this.props.expand(true, node);
            }
        }
    }

    collapse(node: CDTTreeItem) {
        if (node.children && node.children.length > 0 && this.props.expandedRowKeys.includes(node.id)) {
            this.props.expand(false, node);
        } else if (node.parent && !CDTTreeItem.isRoot(node.parent)) {
            this.select(node.parent, 'absolute');
        }
    }

    private select(node: CDTTreeItem, scrollMode: 'relative' | 'absolute' = 'absolute') {
        // Virtual scrolling may have hidden the node
        if (!this.isDomVisible(node)) {
            if (scrollMode === 'absolute') {
                this.scrollAbsolute(node);
                this.props.select(node);
            } else {
                this.scrollRelative(-(this.visibleDomElementCount / 2));
            }

            this.props.select(node);
            // Allow the DOM to update before focusing
            setTimeout(() => this.getDomElement(node)?.focus(), 100);
        } else {
            this.props.select(node);
            this.getDomElement(node)?.focus();
        }

        this.getDomElement(node)?.addEventListener;
    }

    // ==== DOM ====

    private scrollRelative(count = this.visibleDomElementCount) {
        const rowHeight = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-row')?.clientHeight ?? 22;
        const body = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-tbody-virtual-holder');
        if (body) {
            body.scrollTop = Math.max(body.scrollTop + count * rowHeight, 0);
        }
    }

    private scrollAbsolute(node: CDTTreeItem) {
        const rowHeight = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-row')?.clientHeight ?? 22;
        const body = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-tbody-virtual-holder');
        if (body) {
            const index = this.props.rowIndex.get(node.id) ?? 1;
            body.scrollTop = Math.max(index * rowHeight, 0);
        }
    }

    private getDomElement(record: CDTTreeItem) {
        return this.props.ref.current?.querySelector<HTMLDivElement>(`[data-row-key="${record.key}"]`);
    }

    private isDomVisible(record: CDTTreeItem) {
        return !!this.getDomElement(record);
    }

    private get visibleDomElementCount() {
        return this.props.ref.current?.querySelectorAll<HTMLDivElement>('.ant-table-row').length ?? 1;
    }
}
