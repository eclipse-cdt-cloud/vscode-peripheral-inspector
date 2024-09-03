/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { MaybePromise } from '../../../common';
import { CDTTreeItem, CDTTreeTableColumnDefinition } from '../types';

export interface CDTTreeDataProvider<TNode> {
    onDidChangeTreeData: vscode.Event<TNode | undefined | null | void>;

    getCDTTreeItem(element: TNode): MaybePromise<CDTTreeItem>;
    getCDTTreeRoots(): MaybePromise<CDTTreeItem[]>;

    getChildren(element?: TNode): vscode.ProviderResult<TNode[]>;

    getSelectedItem?(): MaybePromise<CDTTreeItem | undefined>;
    getColumnDefinitions?(): CDTTreeTableColumnDefinition[];
}
