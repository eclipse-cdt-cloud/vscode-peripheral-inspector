/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import * as manifest from '../../../manifest';
import { CDTTreeViewType } from '../../../components/tree/types';
import { PeripheralBaseNode } from '../nodes';
import { CDTTreeWebviewViewProvider } from '../../../components/tree/integration/webview';
import { CDTTreeDataProvider } from '../../../components/tree/integration/tree-data-provider';

export class PeripheralsTreeWebView extends CDTTreeWebviewViewProvider<PeripheralBaseNode> {
    readonly type: CDTTreeViewType = 'tree';

    public static viewType = `${manifest.PACKAGE_NAME}.peripheral-tree`;

    public constructor(
        protected dataProvider: CDTTreeDataProvider<PeripheralBaseNode>,
        protected context: vscode.ExtensionContext,
    ) {
        super(dataProvider, context);
    }

    async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(PeripheralsTreeWebView.viewType, this)
        );
    }
}

export class PeripheralsTreeTableWebView extends PeripheralsTreeWebView {
    readonly type: CDTTreeViewType = 'treetable';
    public static viewType = `${manifest.PACKAGE_NAME}.peripheral-treetable`;

    async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(PeripheralsTreeTableWebView.viewType, this)
        );
    }
}
