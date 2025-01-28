/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { MaybePromise } from '../../../common';
import { TreeNotification, TreeTerminatedEvent } from '../../../common/notification';
import { CDTTreeTableColumnDefinition } from '../types';

/**
 * A tree data provider that provides data for the CDTTreeView.
 *
 * @param TNode The type of the tree nodes in the domain model.
 * @param TSerializedNode The type of the serialized tree nodes. Those are the nodes that
 * are actually send to the webview to be display in the tree.
 */
export interface CDTTreeDataProvider<TNode, TSerializedNode> {
    onDidTerminate: vscode.Event<TreeTerminatedEvent<TNode>>;
    onDidChangeTreeData: vscode.Event<TreeNotification<TNode | TNode[] | undefined | null>>;
    /**
     * Get the column definitions for the tree table.
     */
    getColumnDefinitions(): CDTTreeTableColumnDefinition[];

    /**
     * Get the root elements of the tree.
     */
    getSerializedRoots(): MaybePromise<TSerializedNode[]>;

    /**
     * Get the children of the given element.
     */
    getSerializedData(element: TNode): MaybePromise<TSerializedNode>;
}
