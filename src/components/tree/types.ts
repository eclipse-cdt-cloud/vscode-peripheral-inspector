/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { NotificationType } from 'vscode-messenger-common';
import { CommandDefinition, VSCodeContext } from '../../common';
import { TreeNotification } from '../../common/notification';

// ==== Items ====

/**
 * A tree item that is used in the CDT tree view.
 */
export interface CDTTreeItem<T = unknown> {
    __type: 'CDTTreeItem'
    id: string;
    key: string;
    parent?: CDTTreeItem<unknown>;
    children?: CDTTreeItem<T>[];
    /**
     * The resource that this tree item represents. This can be any type of object.
     */
    resource: T;
    /**
     * The columns that are displayed for this tree item.
     */
    columns?: Record<string, CDTTreeTableColumn>;
    /**
     * Whether this item is pinned. Undefined means that the item can not be pinned.
     */
    pinned?: boolean;
    /**
     * Whether this item is expanded. Undefined means that the item is not expanded.
     */
    expanded?: boolean;
    /**
     * Whether this item is matched by the current filter. Undefined means that the item is not matched.
     */
    matching?: boolean;
}

export namespace CDTTreeItem {
    export function create<TResource>(options: Omit<CDTTreeItem<TResource>, '__type'>): CDTTreeItem<TResource> {
        return {
            __type: 'CDTTreeItem',
            ...options
        };
    }

    export function createRoot(): CDTTreeItem<unknown> {
        return create<unknown>({
            id: 'root',
            key: 'root',
            resource: undefined,
            children: []
        });
    }

    export function isRoot(item: CDTTreeItem): boolean {
        return item.id === 'root';
    }
}

// ==== Columns ====

/**
 * A column definition for a tree table.
 * This is used to define the columns that are displayed in the tree table.
 */
export interface CDTTreeTableColumnDefinition {
    /**
     * The type of the column. It can be used to show different types of columns.
     */
    type: string;
    /**
     * The field that is used to get the value for this column. See {@link CDTTreeItem.columns}.
     */
    field: string;
}

/**
 * A string column represents a column that displays a string value.
 */
export interface CDTTreeTableStringColumn {
    type: 'string';
    icon?: string;
    label: string;
    /**
     * Allows to highlight parts of the string.
     */
    highlight?: [number, number][];
    /**
     * The tooltip that is displayed when hovering over the string.
     */
    tooltip?: string;
}

/**
 * An action column represents a column that displays multiple interactable buttons/icons.
 */
export interface CDTTreeTableActionColumn {
    type: 'action';
    commands: CDTTreeTableActionColumnCommand[];
}

/**
 * A command that can be executed when clicking on a button/icon in an action column.
 */
export interface CDTTreeTableActionColumnCommand extends CommandDefinition {
    /**
     * The value that is passed to the command when it is executed.
     */
    value?: unknown;
}

export type CDTTreeTableColumn = CDTTreeTableStringColumn | CDTTreeTableActionColumn;

// ==== Model ====

/**
 * The model that is used to initialize the CDT tree view.
 * It is passed to the webview when the tree view is created / updated.
 */
export interface CDTTreeExtensionModel<TItems = unknown> {
    items?: TItems[];
    columnFields?: CDTTreeTableColumnDefinition[];
}

/**
 * The view model that is used to update the CDT tree view.
 * It is the actual model that is used to render the tree view.
 */
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

    export function create(context: CTDTreeWebviewContext): VSCodeContext {
        return VSCodeContext.create(context);
    }
}

export interface CDTTreeExecuteCommand {
    commandId: string;
    itemId: string;
    value?: unknown;
}

export namespace CTDTreeMessengerType {
    export const updateState: NotificationType<CDTTreeExtensionModel> = { method: 'updateState' };
    export const ready: NotificationType<void> = { method: 'ready' };

    export const executeCommand: NotificationType<TreeNotification<CDTTreeExecuteCommand>> = { method: 'executeCommand' };
    export const toggleNode: NotificationType<TreeNotification<string>> = { method: 'toggleNode' };
    export const clickNode: NotificationType<TreeNotification<string>> = { method: 'clickNode' };
}
