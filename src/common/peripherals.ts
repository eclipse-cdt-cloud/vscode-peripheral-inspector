/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { ClusterOptions, FieldOptions, PeripheralOptions, PeripheralRegisterOptions } from '../api-types';
import { NumberFormat } from './format';
import { hasProperty } from './utils';

export type OmitType<T> = Omit<T, '__type'>;
export interface PeripheralBaseTreeNode {
    __type: string;
    expanded: boolean;
    id: string;
    parentId?: string;
    children?: PeripheralBaseTreeNode[];
}
export namespace PeripheralBaseTreeNode {
    export const Type = 'PeripheralBaseTreeNode';

    export function is(node: PeripheralBaseTreeNode): node is PeripheralBaseTreeNode {
        return hasType(node, PeripheralBaseTreeNode.Type);
    }

    export function create(options: OmitType<PeripheralBaseTreeNode>): PeripheralBaseTreeNode {
        return {
            ...options,
            __type: Type,
        };
    }

    export function hasType(node: object, type: string): boolean {
        return '__type' in node && node.__type === type;
    }
}

export const PERIPHERAL_ID_SEP = '-';

export interface PeripheralBaseNode extends PeripheralBaseTreeNode {
    format: NumberFormat;
    pinned?: boolean;
    session: string | undefined;
}

export namespace PeripheralBaseNode {
    export const Type = 'PeripheralBaseNode';

    export function is(node: object): node is PeripheralBaseNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralBaseNode>): PeripheralBaseNode {
        return {
            ...options,
            __type: Type,
        };
    }
}

export type PeripheralNodeContextValue = 'peripheral' | 'peripheral.pinned'
export interface PeripheralNode extends PeripheralBaseNode, PeripheralOptions {
    children: Array<PeripheralRegisterNode | PeripheralClusterNode>;
    groupName: string;
}
export namespace PeripheralNode {
    export const Type = 'PeripheralNode';

    export function is(node: object): node is PeripheralNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralNode>): PeripheralNode {
        return {
            ...options,
            __type: Type,
        };
    }

    export type ComparableTypes = Pick<PeripheralNode, 'pinned' | 'groupName' | 'name'>
    export function compare(p1: ComparableTypes, p2: ComparableTypes): number {
        if ((p1.pinned && p2.pinned) || (!p1.pinned && !p2.pinned)) {
            // none or both peripherals are pinned, sort by name prioritizing groupname
            if (p1.groupName !== p2.groupName) {
                return p1.groupName > p2.groupName ? 1 : -1;
            } else if (p1.name !== p2.name) {
                return p1.name > p2.name ? 1 : -1;
            } else {
                return 0;
            }
        } else {
            return p1.pinned ? -1 : 1;
        }
    }
}

export interface ClusterOrRegisterBaseNode extends PeripheralBaseNode {
    offset: number | undefined;
}
export namespace ClusterOrRegisterBaseNode {
    export const Type = 'ClusterOrRegisterBaseNode';

    export function is(node: object): node is ClusterOrRegisterBaseNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<ClusterOrRegisterBaseNode>): ClusterOrRegisterBaseNode {
        return {
            ...options,
            __type: Type,
        };
    }
}

export type PeripheralRegisterOrClusterNode = PeripheralRegisterNode | PeripheralClusterNode;
export interface PeripheralClusterNode extends ClusterOrRegisterBaseNode, ClusterOptions {
    children: PeripheralRegisterOrClusterNode[];
    offset: number;
}
export namespace PeripheralClusterNode {
    export const Type = 'PeripheralClusterNode';

    export function is(node: object): node is PeripheralClusterNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralClusterNode>): PeripheralClusterNode {
        return {
            ...options,
            __type: Type,
        };
    }
}

export type PeripheralFieldNodeContextValue = 'field' | 'field-res' | 'fieldRO' | 'fieldWO'
export interface PeripheralFieldNode extends PeripheralBaseNode, FieldOptions {
    parentAddress: number;
    previousValue?: number;
    currentValue: number;
    resetValue: number;
}
export namespace PeripheralFieldNode {
    export const Type = 'PeripheralFieldNode';

    export function is(node: object): node is PeripheralFieldNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralFieldNode>): PeripheralFieldNode {
        return {
            ...options,
            __type: Type,
        };
    }
}

export type PeripheralRegisterNodeContextValue = 'registerRW' | 'registerRO' | 'registerWO'
export interface PeripheralRegisterNode extends ClusterOrRegisterBaseNode, PeripheralRegisterOptions {
    children: PeripheralFieldNode[];
    previousValue?: number;
    currentValue: number;
    resetValue: number;
    hexLength: number;
    offset: number;
    address: number;
}
export namespace PeripheralRegisterNode {
    export const Type = 'PeripheralRegisterNode';

    export function is(node: object): node is PeripheralRegisterNode {
        return PeripheralBaseTreeNode.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralRegisterNode>): PeripheralRegisterNode {
        return {
            ...options,
            __type: Type,
        };
    }
}

export type PeripheralTreeNode = PeripheralBaseTreeNode | PeripheralNode | PeripheralRegisterNode | PeripheralClusterNode | PeripheralFieldNode;

export namespace PeripheralTreeNode {
    export function getFormat(peripheralId: string | undefined, tree: Map<string, PeripheralTreeNode>): NumberFormat {
        if (peripheralId === undefined) {
            return NumberFormat.Auto;
        }

        const node = tree.get(peripheralId);
        if (node === undefined) {
            return NumberFormat.Auto;
        }

        if (hasProperty<PeripheralBaseNode>(node, 'format') && node.format !== NumberFormat.Auto) {
            return node.format;
        }

        if (node.parentId === undefined) {
            return NumberFormat.Auto;
        }

        return getFormat(node.parentId, tree);
    }


    export function extractExpandedKeys(nodes: PeripheralTreeNode[] | undefined): string[] {
        return extractIds(nodes, node => node.expanded === true);
    }

    export function extractPinnedKeys(nodes: PeripheralTreeNode[] | undefined): string[] {
        return extractIds(nodes, node => hasProperty<PeripheralBaseNode>(node, 'pinned') && node.pinned === true);
    }

    export function extractIds(nodes: PeripheralTreeNode[] | undefined, pred: (node: PeripheralTreeNode) => boolean): string[] {
        if (nodes === undefined) {
            return [];
        }

        const ids: string[] = [];

        function traverse(node: PeripheralTreeNode): void {
            if (pred(node)) {
                ids.push(node.id);
            }
            for (const child of node.children ?? []) {
                traverse(child);
            }
        }

        for (const node of nodes) {
            traverse(node);
        }

        return ids;
    }

}
