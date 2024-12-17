/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralDataTracker } from '../plugin/peripheral/tree/peripheral-data-tracker';
import { PeripheralTreeDataProvider } from '../plugin/peripheral/tree/peripheral-tree-data-provider';
import { PeripheralsTreeTableWebView } from '../plugin/peripheral/webview/peripheral-tree-webview-main';

export async function enableTree(context: vscode.ExtensionContext, peripheralDataTracker: PeripheralDataTracker): Promise<void> {
    const dataProvider = new PeripheralTreeDataProvider(peripheralDataTracker, context);
    const webView = new PeripheralsTreeTableWebView(dataProvider, context);
    await dataProvider.activate(webView);
    await webView.activate(context);
}
