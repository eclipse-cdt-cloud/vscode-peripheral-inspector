/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralTreeProvider } from '../views/peripheral';
import { Commands } from '../commands';
import { DebugTracker } from '../debug-tracker';
import { PeripheralInspectorAPI } from '../peripheral-inspector-api';
import { SvdResolver } from '../svd-resolver';
import { IPeripheralInspectorAPI } from '../api-types';
export * as api from '../api-types';

export const activate = async (context: vscode.ExtensionContext): Promise<IPeripheralInspectorAPI> => {
    const tracker = new DebugTracker();
    const api = new PeripheralInspectorAPI();
    const resolver = new SvdResolver(api);
    const peripheralTree = new PeripheralTreeProvider(tracker, resolver, api, context);
    const commands = new Commands(peripheralTree);

    await tracker.activate(context);
    await peripheralTree.activate();
    await commands.activate(context);

    return api;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
