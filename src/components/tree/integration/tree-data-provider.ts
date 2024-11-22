/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { MaybePromise } from '../../../common';
import { CDTTreeItem, CDTTreeTableColumnDefinition } from '../types';
import { TreeNotification } from '../../../common/notification';

export interface CDTTreeDataProvider<TNode, TSerializedNode> {
    onDidChangeTreeData: vscode.Event<TreeNotification<TNode | TNode[] | undefined | null>>;

    /**
     * @deprecated
     */
    getCDTTreeItem(element: TNode): MaybePromise<CDTTreeItem>;

    /**
     * @deprecated
     */
    getCDTTreeRoots(): MaybePromise<CDTTreeItem[]>;

    getChildren(element?: TNode): vscode.ProviderResult<TNode[]>;

    getSelectedItem?(): MaybePromise<CDTTreeItem | undefined>;
    getColumnDefinitions?(): CDTTreeTableColumnDefinition[];

    getSerializedRoots(): MaybePromise<TSerializedNode[]>;
    getSerializedData(element: TNode): MaybePromise<TSerializedNode>;
}
