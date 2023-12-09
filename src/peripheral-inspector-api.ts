/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { IPeripheralsProvider, IPeripheralInspectorAPI } from './api-types';

const CORTEX_EXTENSION = 'marus25.cortex-debug';

interface SVDInfo {
    expression: RegExp;
    path: string;
}

export class PeripheralInspectorAPI implements IPeripheralInspectorAPI {
    private SVDDirectory: SVDInfo[] = [];
    private PeripheralProviders: Record<string, IPeripheralsProvider> = {};

    public registerSVDFile(expression: RegExp | string, path: string): void {
        if (typeof expression === 'string') {
            expression = new RegExp(`^${expression}$`, '');
        }

        this.SVDDirectory.push({ expression: expression, path: path });
    }

    public getSVDFile(device: string): string | undefined {
        // Try loading from device support pack registered with this extension
        const entry = this.SVDDirectory.find((de) => de.expression.test(device));
        if (entry) {
            return entry.path;
        }

        return undefined;
    }

    public async getSVDFileFromCortexDebug(device: string): Promise<string | undefined> {
        try {
            // Try loading from device support pack registered with this extension
            const cortexDebug = vscode.extensions.getExtension<IPeripheralInspectorAPI>(CORTEX_EXTENSION);
            if (cortexDebug) {
                const cdbg = await cortexDebug.activate();
                if (cdbg) {
                    return cdbg.getSVDFile(device);
                }
            }
        } catch(_e) {
            // Ignore error
        }

        return undefined;
    }

    public registerPeripheralsProvider(fileExtension: string, provider: IPeripheralsProvider) {
        this.PeripheralProviders[fileExtension] = provider;
    }

    public getPeripheralsProvider(svdPath: string) : IPeripheralsProvider | undefined {
        const ext = Object.keys(this.PeripheralProviders).filter((extension) => svdPath.endsWith(`.${extension}`))[0];
        return ext ? this.PeripheralProviders[ext] : undefined;
    }
}
