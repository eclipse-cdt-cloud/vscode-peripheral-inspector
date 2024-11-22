/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralDataTracker } from '../plugin/peripheral/tree/peripheral-data-tracker';
import { PeripheralCDTTreeDataProvider } from '../plugin/peripheral/tree/provider/peripheral-cdt-tree-data-provider';
import { PeripheralTreeDataProvider } from '../plugin/peripheral/tree/provider/peripheral-tree-data-provider';
import { PeripheralsAntDTreeTableWebView, PeripheralsTreeTableWebView, PeripheralsTreeWebView } from '../plugin/peripheral/webview/peripheral-tree-webview-main';

/**
 * **Notice**
 * You also need to add the view in package.json
 *
 * ```json
   {
     "id": "peripheral-inspector.svd",
     "name": "Peripherals",
     "when": "peripheral-inspector.svd.hasData"
   }
 * ```
 */
export async function enableTree(context: vscode.ExtensionContext, peripheralDataTracker: PeripheralDataTracker): Promise<void> {
    const peripheralTreeDataProvider = new PeripheralTreeDataProvider(peripheralDataTracker, context);
    await peripheralTreeDataProvider.activate();
}

/**
 * **Notice**
 * You also need to add the view in package.json
 *
 * ```json
   {
     "type": "webview",
     "id": "peripheral-inspector.peripheral-tree",
     "name": "Peripherals Tree",
     "when": "peripheral-inspector.svd.hasData"
   }
 * ```
 */
export async function enableCDTTree(context: vscode.ExtensionContext, peripheralDataTracker: PeripheralDataTracker): Promise<void> {
    const peripheralCDTTreeDataProvider = new PeripheralCDTTreeDataProvider(peripheralDataTracker, context);
    const peripheralTreeWebView = new PeripheralsTreeWebView(peripheralCDTTreeDataProvider, context);
    await peripheralTreeWebView.activate(context);
    await peripheralCDTTreeDataProvider.activate(peripheralTreeWebView);
}

/**
 * **Notice**
 * You also need to add the view in package.json
 *
 * ```json
   {
    "type": "webview",
    "id": "peripheral-inspector.peripheral-treetable",
    "name": "Peripherals Tree-table",
    "when": "peripheral-inspector.svd.hasData"
   }
 * ```
 */
export async function enableCDTTreeTable(context: vscode.ExtensionContext, peripheralDataTracker: PeripheralDataTracker): Promise<void> {
    const peripheralCDTTreeTableDataProvider = new PeripheralCDTTreeDataProvider(peripheralDataTracker, context);
    const peripheralTreeTableWebView = new PeripheralsTreeTableWebView(peripheralCDTTreeTableDataProvider, context);
    await peripheralCDTTreeTableDataProvider.activate(peripheralTreeTableWebView);
    await peripheralTreeTableWebView.activate(context);
}


/**
 * **Notice**
 * You also need to add the view in package.json
 *
 * ```json
   {
    "type": "webview",
    "id": "peripheral-inspector.peripheral-antd-treetable",
    "name": "Peripherals AntD Tree-table",
    "when": "peripheral-inspector.svd.hasData"
   }
 * ```
 */
export async function enableCDTAntDTreeTable(context: vscode.ExtensionContext, peripheralDataTracker: PeripheralDataTracker): Promise<void> {
    const dataProvider = new PeripheralCDTTreeDataProvider(peripheralDataTracker, context);
    const webView = new PeripheralsAntDTreeTableWebView(dataProvider, context);
    await dataProvider.activate(webView);
    await webView.activate(context);
}
