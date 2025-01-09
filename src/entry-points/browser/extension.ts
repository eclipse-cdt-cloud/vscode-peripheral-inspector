/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { IPeripheralInspectorAPI } from '../../api-types';
import { PeripheralCommands } from '../../commands';
import { DebugTracker } from '../../debug-tracker';
import { PeripheralInspectorAPI } from '../../peripheral-inspector-api';
import { PeripheralDataTracker } from '../../plugin/peripheral/tree/peripheral-data-tracker';
import { SvdResolver } from '../../svd-resolver';
import { PeripheralTreeDataProvider } from '../../plugin/peripheral/tree/peripheral-tree-data-provider';
import { PeripheralsTreeTableWebView } from '../../plugin/peripheral/webview/peripheral-tree-webview-main';
export * as api from '../../api-types';

export const activate = async (context: vscode.ExtensionContext): Promise<IPeripheralInspectorAPI> => {
    const tracker = new DebugTracker();
    const api = new PeripheralInspectorAPI();
    const resolver = new SvdResolver(api);

    const peripheralDataTracker = new PeripheralDataTracker(tracker, resolver, api, context);
    const dataProvider = new PeripheralTreeDataProvider(peripheralDataTracker, context);
    const webView = new PeripheralsTreeTableWebView(dataProvider, context);
    const commands = new PeripheralCommands(peripheralDataTracker, webView);

    await tracker.activate(context);
    await commands.activate(context);
    await dataProvider.activate(webView);
    await webView.activate(context);

    return api;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
