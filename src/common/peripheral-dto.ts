/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { ClusterOptions, FieldOptions, PeripheralOptions, PeripheralRegisterOptions } from '../api-types';
import { NumberFormat } from './format';
import { hasProperty } from './utils';

// ==== PeripheralBaseTreeNode ====

export type OmitType<T> = Omit<T, '__type'>;
export interface PeripheralBaseTreeNodeDTO {
    __type: string;
    expanded: boolean;
    id: string;
    parentId?: string;
    children?: PeripheralBaseTreeNodeDTO[];
}
export namespace PeripheralBaseTreeNodeDTO {
    export const Type = 'PeripheralBaseTreeNode';

    export function is(node: PeripheralBaseTreeNodeDTO): node is PeripheralBaseTreeNodeDTO {
        return hasType(node, PeripheralBaseTreeNodeDTO.Type);
    }

    export function create(options: OmitType<PeripheralBaseTreeNodeDTO>): PeripheralBaseTreeNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }

    export function hasType(node: object, type: string): boolean {
        return '__type' in node && node.__type === type;
    }
}

// ==== PeripheralBaseNode ====

export const PERIPHERAL_ID_SEP = '-';
export interface PeripheralBaseNodeDTO extends PeripheralBaseTreeNodeDTO {
    name: string;
    format: NumberFormat;
    pinned?: boolean;
    session: string | undefined;
}
export namespace PeripheralBaseNodeDTO {
    export const Type = 'PeripheralBaseNode';

    export function is(node: object): node is PeripheralBaseNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralBaseNodeDTO>): PeripheralBaseNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}

// ==== PeripheralNode ====

export type PeripheralNodeContextValue = 'peripheral' | 'peripheral.pinned'
export interface PeripheralNodeDTO extends PeripheralBaseNodeDTO, PeripheralOptions {
    children: Array<PeripheralRegisterNodeDTO | PeripheralClusterNodeDTO>;
    groupName: string;
}
export namespace PeripheralNodeDTO {
    export const Type = 'PeripheralNode';

    export function is(node: object): node is PeripheralNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralNodeDTO>): PeripheralNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}

// ==== ClusterOrRegisterBaseNode ====

export interface ClusterOrRegisterBaseNodeDTO extends PeripheralBaseNodeDTO {
    offset: number | undefined;
}
export namespace ClusterOrRegisterBaseNodeDTO {
    export const Type = 'ClusterOrRegisterBaseNode';

    export function is(node: object): node is ClusterOrRegisterBaseNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<ClusterOrRegisterBaseNodeDTO>): ClusterOrRegisterBaseNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}
export type PeripheralRegisterOrClusterNodeDTO = PeripheralRegisterNodeDTO | PeripheralClusterNodeDTO;

// ==== PeripheralClusterNode ====

export interface PeripheralClusterNodeDTO extends ClusterOrRegisterBaseNodeDTO, ClusterOptions {
    children: PeripheralRegisterOrClusterNodeDTO[];
    offset: number;
}
export namespace PeripheralClusterNodeDTO {
    export const Type = 'PeripheralClusterNode';

    export function is(node: object): node is PeripheralClusterNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralClusterNodeDTO>): PeripheralClusterNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}

// ==== PeripheralFieldNode ====

export type PeripheralFieldNodeContextValue = 'field' | 'field-res' | 'fieldRO' | 'fieldWO'
export interface PeripheralFieldNodeDTO extends PeripheralBaseNodeDTO, FieldOptions {
    parentAddress: number;
    previousValue?: number;
    currentValue: number;
    resetValue: number;
}
export namespace PeripheralFieldNodeDTO {
    export const Type = 'PeripheralFieldNode';

    export function is(node: object): node is PeripheralFieldNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralFieldNodeDTO>): PeripheralFieldNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}

// ==== PeripheralRegisterNode ====

export type PeripheralRegisterNodeContextValue = 'registerRW' | 'registerRO' | 'registerWO'
export interface PeripheralRegisterNodeDTO extends ClusterOrRegisterBaseNodeDTO, PeripheralRegisterOptions {
    children: PeripheralFieldNodeDTO[];
    previousValue?: number;
    currentValue: number;
    resetValue: number;
    hexLength: number;
    offset: number;
    size: number;
    address: number;
}
export namespace PeripheralRegisterNodeDTO {
    export const Type = 'PeripheralRegisterNode';

    export function is(node: object): node is PeripheralRegisterNodeDTO {
        return PeripheralBaseTreeNodeDTO.hasType(node, Type);
    }

    export function create(options: OmitType<PeripheralRegisterNodeDTO>): PeripheralRegisterNodeDTO {
        return {
            ...options,
            __type: Type,
        };
    }
}

// ==== PeripheralTreeNodeDTOs ====

export type PeripheralTreeNodeDTOs = PeripheralBaseTreeNodeDTO | PeripheralNodeDTO | PeripheralRegisterNodeDTO | PeripheralClusterNodeDTO | PeripheralFieldNodeDTO;
export namespace PeripheralTreeNodeDTOs {
    export function getFormat(peripheralId: string | undefined, tree: Map<string, PeripheralTreeNodeDTOs>): NumberFormat {
        if (peripheralId === undefined) {
            return NumberFormat.Auto;
        }

        const node = tree.get(peripheralId);
        if (node === undefined) {
            return NumberFormat.Auto;
        }

        if (hasProperty<PeripheralBaseNodeDTO>(node, 'format') && node.format !== NumberFormat.Auto) {
            return node.format;
        }

        if (node.parentId === undefined) {
            return NumberFormat.Auto;
        }

        return getFormat(node.parentId, tree);
    }


    export function extractExpandedKeys(nodes: PeripheralTreeNodeDTOs[] | undefined): string[] {
        return extractIds(nodes, node => node.expanded === true);
    }

    export function extractPinnedKeys(nodes: PeripheralTreeNodeDTOs[] | undefined): string[] {
        return extractIds(nodes, node => hasProperty<PeripheralBaseNodeDTO>(node, 'pinned') && node.pinned === true);
    }

    export function extractIds(nodes: PeripheralTreeNodeDTOs[] | undefined, pred: (node: PeripheralTreeNodeDTOs) => boolean): string[] {
        if (nodes === undefined) {
            return [];
        }

        const ids: string[] = [];

        function traverse(node: PeripheralTreeNodeDTOs): void {
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
