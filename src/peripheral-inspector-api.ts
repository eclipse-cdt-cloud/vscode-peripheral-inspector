/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import {
    IPeripheralsProvider,
    IPeripheralInspectorAPI,
    InterruptTable
} from './api-types';

const CORTEX_EXTENSION = 'marus25.cortex-debug';

interface SVDInfo {
    expression: RegExp;
    path: string;
}

interface LoadedSVDInfo {
    interruptTable?: InterruptTable;
}

export class PeripheralInspectorAPI implements IPeripheralInspectorAPI {
    private SVDDirectory: SVDInfo[] = [];
    private PeripheralProviders: Record<string, IPeripheralsProvider> = {};
    private LoadedSVDInfos: Record<string, LoadedSVDInfo> = {};

    /** IPeripheralInspectorAPI implementation */

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
        } catch {
            // Ignore error
        }

        return undefined;
    }

    public registerPeripheralsProvider(fileExtension: string, provider: IPeripheralsProvider) {
        this.PeripheralProviders[fileExtension] = provider;
    }

    public getInterruptTable(svdPath: string): InterruptTable | undefined {
        return this.LoadedSVDInfos[svdPath]?.interruptTable;
    }

    /** Locally used methods */

    public getPeripheralsProvider(svdPath: string): IPeripheralsProvider | undefined {
        const ext = Object.keys(this.PeripheralProviders).filter((extension) => svdPath.endsWith(`.${extension}`))[0];
        return ext ? this.PeripheralProviders[ext] : undefined;
    }

    public updateLoadedSVDInfo(svdPath: string, svdInfo?: LoadedSVDInfo): void {
        // Implementation for building the loaded SVD info
        // eslint-disable-next-line no-console
        console.log(`Building loaded SVD info for SVD path: ${svdPath}`);
        if (svdInfo) {
            this.LoadedSVDInfos[svdPath] = svdInfo;
        } else {
            delete this.LoadedSVDInfos[svdPath];
        }
    }
}
