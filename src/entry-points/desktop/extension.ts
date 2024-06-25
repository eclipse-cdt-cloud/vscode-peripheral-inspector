/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralCommands } from '../../commands';
import { DebugTracker } from '../../debug-tracker';
import { PeripheralInspectorAPI } from '../../peripheral-inspector-api';
import { SvdResolver } from '../../svd-resolver';
import { IPeripheralInspectorAPI } from '../../api-types';
import { PeripheralsTreeTableWebView, PeripheralsTreeWebView } from '../../plugin/peripheral/webview/peripheral-tree-webview-main';
import { PeripheralDataTracker } from '../../plugin/peripheral/tree/peripheral-data-tracker';
import { PeripheralTreeDataProvider } from '../../plugin/peripheral/tree/provider/peripheral-tree-data-provider';
import { PeripheralCDTTreeDataProvider } from '../../plugin/peripheral/tree/provider/peripheral-cdt-tree-data-provider';
export * as api from '../../api-types';

export const activate = async (context: vscode.ExtensionContext): Promise<IPeripheralInspectorAPI> => {
    const tracker = new DebugTracker();
    const api = new PeripheralInspectorAPI();
    const resolver = new SvdResolver(api);

    const peripheralDataTracker = new PeripheralDataTracker(tracker, resolver, api, context);
    const peripheralTreeDataProvider = new PeripheralTreeDataProvider(peripheralDataTracker, context);
    const peripheralCDTTreeDataProvider = new PeripheralCDTTreeDataProvider(peripheralDataTracker, context);
    const peripheralCDTTreeTableDataProvider = new PeripheralCDTTreeDataProvider(peripheralDataTracker, context);

    const peripheralTreeWebView = new PeripheralsTreeWebView(peripheralCDTTreeDataProvider, context);
    const peripheralTreeTableWebView = new PeripheralsTreeTableWebView(peripheralCDTTreeTableDataProvider, context);

    const commands = new PeripheralCommands(peripheralDataTracker);

    await tracker.activate(context);
    await peripheralTreeDataProvider.activate();
    await commands.activate(context);
    await peripheralTreeWebView.activate(context);
    await peripheralCDTTreeDataProvider.activate(peripheralTreeWebView);
    await peripheralTreeTableWebView.activate(context);
    await peripheralCDTTreeTableDataProvider.activate(peripheralTreeTableWebView);

    return api;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
