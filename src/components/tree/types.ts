/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { NotificationType } from 'vscode-messenger-common';
import { CommandDefinition, VscodeContext } from '../../common';
import { TreeNotification } from '../../common/notification';

// ==== Items ====

export interface CDTTreeItem<T = unknown> {
    __type: 'CDTTreeItem'
    id: string;
    key: string;
    parentId?: string;
    children?: CDTTreeItem<T>[];
    resource: T;
    columns?: Record<string, CDTTreeTableColumn>;
    pinnable?: boolean;
    pinned?: boolean;
    expanded?: boolean;
}

export namespace CDTTreeItem {
    export function create<TResource>(options: Omit<CDTTreeItem<TResource>, '__type'>): CDTTreeItem<TResource> {
        return {
            __type: 'CDTTreeItem',
            ...options
        };
    }
}


// ==== Columns ====

export interface CDTTreeTableColumnDefinition {
    type: string;
    field: string;
    expander?: boolean;
}

export interface CDTTreeTableStringColumn {
    type: 'string';
    icon?: string;
    label: string;
    highlight?: [number, number][];
    tooltip?: string;
}

export interface CDTTreeTableActionColumn {
    type: 'action';
    commands: CDTTreeTableActionColumnCommand[];
}

export interface CDTTreeTableActionColumnCommand extends CommandDefinition {
    value?: unknown;
}

export type CDTTreeTableColumn = CDTTreeTableStringColumn | CDTTreeTableActionColumn;

// ==== Model ====

export interface CDTTreeExtensionModel<TItems = unknown> {
    items?: TItems[];
    columnFields?: CDTTreeTableColumnDefinition[];
}


export interface CDTTreeViewModel<TItem = unknown> {
    items: CDTTreeItem<TItem>[];
    expandedKeys: string[];
    pinnedKeys: string[];
}


export interface CTDTreeWebviewContext {
    webviewSection: string;
    cdtTreeItemId: string;
}

export namespace CTDTreeWebviewContext {
    export function is(context: object): context is CTDTreeWebviewContext {
        return 'cdtTreeItemId' in context;
    }

    export function create(context: CTDTreeWebviewContext): VscodeContext {
        return {
            'data-vscode-context': JSON.stringify({
                ...context,
                preventDefaultContextMenuItems: true
            })
        };
    }
}

export interface CDTTreeExecuteCommand {
    commandId: string;
    item: CDTTreeItem;
    value?: unknown;
}

export namespace CTDTreeMessengerType {
    export const updateState: NotificationType<CDTTreeExtensionModel> = { method: 'updateState' };
    export const ready: NotificationType<void> = { method: 'ready' };

    export const executeCommand: NotificationType<TreeNotification<CDTTreeExecuteCommand>> = { method: 'executeCommand' };
    export const toggleNode: NotificationType<TreeNotification<CDTTreeItem>> = { method: 'toggleNode' };
    export const clickNode: NotificationType<TreeNotification<CDTTreeItem>> = { method: 'clickNode' };
}
