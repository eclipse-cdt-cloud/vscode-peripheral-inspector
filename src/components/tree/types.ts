/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import { TreeNode as PrimeTreeNode } from 'primereact/treenode';
import { NotificationType } from 'vscode-messenger-common';
import { CommandDefinition, VscodeContext } from '../../common';

export interface CDTTreeOptions {
    contextValue?: string,
    commands?: CommandDefinition[];
    highlights?: [number, number][];
    tooltip?: string,
}

export interface EditableCellData {
    type: string;
}

export interface NoEditableData extends EditableCellData {
    type: 'none';
}

export interface EditableTextData extends EditableCellData {
    type: 'text';
}

export interface CDTTreeTableColumn {
    value: string;
    highlight?: [number, number][];
    tooltip?: string;
    icon?: string;
    edit?: EditableTextData | NoEditableData;
}

export interface CDTTreeItem extends PrimeTreeNode {
    __type: 'CDTTreeItem'
    id: string;
    key: string;
    icon?: string;
    path: string[];
    options?: CDTTreeOptions;
    columns?: Record<string, CDTTreeTableColumn>;
    children?: CDTTreeItem[];
}

export namespace CDTTreeItem {
    export function is(item: PrimeTreeNode): item is CDTTreeItem {
        return '__type' in item && item.__type === 'CDTTreeItem';
    }

    export function as(item: PrimeTreeNode): CDTTreeItem {
        assert(item);
        return item;
    }

    export function assert(treeNode: PrimeTreeNode): asserts treeNode is CDTTreeItem {
        if (!is(treeNode)) {
            throw new Error(`Provided tree item isn't a valid CDTTreeItem: ${treeNode}`);
        }
    }

    export function create(options: Omit<CDTTreeItem, '__type'>): CDTTreeItem {
        return {
            __type: 'CDTTreeItem',
            ...options
        };
    }
}

export type CDTTreeViewType = 'tree' | 'treetable';

export interface CDTTreeTableColumnDefinition {
    field: string;
}

export interface CDTTreeState {
    items?: CDTTreeItem[];
    selectedItem?: CDTTreeItem;
    columnFields?: CDTTreeTableColumnDefinition[];
    type: CDTTreeViewType;
}

export interface CDTTreeExecuteCommand {
    commandId: string;
    item: CDTTreeItem;
}

export interface CTDTreeWebviewContext {
    webviewSection: string;
    cdtTreeItemId: string;
    cdtTreeItemPath: string[];
    context?: string;
}

export namespace CTDTreeWebviewContext {
    export function is(context: object): context is CTDTreeWebviewContext {
        return 'cdtTreeItemId' in context && 'cdtTreeItemPath' in context;
    }

    export function create(context: CTDTreeWebviewContext): VscodeContext {
        return { 'data-vscode-context': JSON.stringify(context) };
    }
}

export interface CDTTreeItemChangeValue {
    item: CDTTreeItem;
    field: string;
    value: string;
}

export namespace CTDTreeMessengerType {
    export const updateState: NotificationType<CDTTreeState> = { method: 'updateState' };
    export const ready: NotificationType<void> = { method: 'ready' };
    export const executeCommand: NotificationType<CDTTreeExecuteCommand> = { method: 'executeCommand' };
    export const changeValue: NotificationType<CDTTreeItemChangeValue> = { method: 'changeValue' };
    export const toggleNode: NotificationType<CDTTreeItem> = { method: 'toggleNode' };
    export const clickNode: NotificationType<CDTTreeItem> = { method: 'clickNode' };
}
