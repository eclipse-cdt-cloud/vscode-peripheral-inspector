/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { MaybePromise } from '../../../common';
import { TreeNotification } from '../../../common/notification';
import { CDTTreeTableColumnDefinition } from '../types';

export interface CDTTreeDataProvider<TNode, TSerializedNode> {
    onDidChangeTreeData: vscode.Event<TreeNotification<TNode | TNode[] | undefined | null>>;
    getColumnDefinitions(): CDTTreeTableColumnDefinition[];

    getSerializedRoots(): MaybePromise<TSerializedNode[]>;
    getSerializedData(element: TNode): MaybePromise<TSerializedNode>;
}
