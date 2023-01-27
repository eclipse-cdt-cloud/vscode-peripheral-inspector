import * as vscode from 'vscode';
import { DebugTracker } from 'debug-tracker-vscode';
import { PeripheralTreeProvider } from '../views/peripheral';
import { Commands } from '../commands';
import { SvdRegistry } from '../svd-registry';

export const activate = async (context: vscode.ExtensionContext): Promise<SvdRegistry> => {
    const registry = new SvdRegistry();
    const tracker = new DebugTracker(context);
    const peripheralTree = new PeripheralTreeProvider(tracker, registry);
    const commands = new Commands(peripheralTree);

    await peripheralTree.activate(context);
    await commands.activate(context);

    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
