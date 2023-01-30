/**
 * Copyright (C) 2023 Arm Limited
 */

import * as vscode from 'vscode';
import { DebugTracker } from 'debug-tracker-vscode';
import { PeripheralTreeProvider } from '../views/peripheral';
import { Commands } from '../commands';
import { SvdRegistry } from '../svd-registry';
import { SvdResolver } from '../svd-resolver';

export const activate = async (context: vscode.ExtensionContext): Promise<SvdRegistry> => {
    const tracker = new DebugTracker(context);
    const registry = new SvdRegistry();
    const resolver = new SvdResolver(registry);
    const peripheralTree = new PeripheralTreeProvider(tracker, resolver);
    const commands = new Commands(peripheralTree);

    await peripheralTree.activate(context);
    await commands.activate(context);

    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
