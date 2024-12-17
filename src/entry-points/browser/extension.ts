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
import { enableTree } from '../tree';
export * as api from '../../api-types';

export const activate = async (context: vscode.ExtensionContext): Promise<IPeripheralInspectorAPI> => {
    const tracker = new DebugTracker();
    const api = new PeripheralInspectorAPI();
    const resolver = new SvdResolver(api);

    const peripheralDataTracker = new PeripheralDataTracker(tracker, resolver, api, context);
    const commands = new PeripheralCommands(peripheralDataTracker);

    await tracker.activate(context);
    await commands.activate(context);

    await enableTree(context, peripheralDataTracker);

    return api;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
