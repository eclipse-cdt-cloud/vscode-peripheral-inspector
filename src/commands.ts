/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import * as manifest from './manifest';
import { PeripheralBaseNode } from './views/nodes/basenode';
import { PeripheralTreeProvider } from './views/peripheral';
import { NumberFormat } from './common';

export class Commands {
    public constructor(protected peripheralProvider: PeripheralTreeProvider) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.updateNode`, node => this.peripheralsUpdateNode(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.copyValue`, node => this.peripheralsCopyValue(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.setFormat`, node => this.peripheralsSetFormat(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.forceRefresh`, node => this.peripheralsForceRefresh(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.pin`, node => this.peripheralsTogglePin(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.unpin`, node => this.peripheralsTogglePin(node)),
            vscode.commands.registerCommand(`${manifest.PACKAGE_NAME}.svd.refreshAll`, () => this.peripheralsForceRefresh()),
        );
    }

    private async peripheralsUpdateNode(node: PeripheralBaseNode): Promise<void> {
        try {
            const result = await node.performUpdate();
            if (result) {
                this.peripheralsForceRefresh();
            }
        } catch (error) {
            vscode.debug.activeDebugConsole.appendLine(`Unable to update value: ${(error as Error).message}`);
        }
    }

    private peripheralsCopyValue(node: PeripheralBaseNode): void {
        const cv = node.getCopyValue();
        if (cv) {
            vscode.env.clipboard.writeText(cv);
        }
    }

    private async peripheralsSetFormat(node: PeripheralBaseNode): Promise<void> {
        const result = await vscode.window.showQuickPick([
            { label: 'Auto', description: 'Automatically choose format (Inherits from parent)', value: NumberFormat.Auto },
            { label: 'Hex', description: 'Format value in hexadecimal', value: NumberFormat.Hexadecimal },
            { label: 'Decimal', description: 'Format value in decimal', value: NumberFormat.Decimal },
            { label: 'Binary', description: 'Format value in binary', value: NumberFormat.Binary }
        ]);
        if (result === undefined) {
            return;
        }

        node.format = result.value;
        this.peripheralProvider.refresh();
    }

    private async peripheralsForceRefresh(node?: PeripheralBaseNode): Promise<void> {
        if (node) {
            const p = node.getPeripheral();
            if (p) {
                await p.updateData();
            }
        } else {
            this.peripheralProvider.updateData();
        }
    }

    private peripheralsTogglePin(node: PeripheralBaseNode): void {
        this.peripheralProvider.togglePinPeripheral(node);
        this.peripheralProvider.refresh();
    }
}
