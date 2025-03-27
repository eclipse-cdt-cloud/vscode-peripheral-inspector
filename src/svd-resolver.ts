/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { isAbsolute, join, normalize } from 'path';
import { parseStringPromise } from 'xml2js';
import { PeripheralInspectorAPI } from './peripheral-inspector-api';
import { parsePackString, pdscFromPack, fileFromPack, Pack } from './cmsis-pack/pack-utils';
import { PDSC, Device, DeviceVariant, getDevices, getSvdPath, getProcessors } from './cmsis-pack/pdsc';
import { readFromUrl } from './utils';
import { PeripheralConfigurationProvider } from './plugin/peripheral/tree/peripheral-configuration-provider';

export class SvdResolver {
    public constructor(protected api: PeripheralInspectorAPI, protected readonly config: PeripheralConfigurationProvider) {
    }

    public async resolve(session: vscode.DebugSession, wsFolderPath?: vscode.Uri): Promise<string | undefined> {
        let svdPath = this.config.sdvPath(session);
        const deviceName = this.config.deviceName(session);
        if (!svdPath && !deviceName) {
            return undefined;
        }

        const processorName = this.config.processorName(session);
        try {
            if (svdPath) {
                const pack = parsePackString(svdPath);

                if (pack) {
                    svdPath = await this.loadFromPack(pack, deviceName, processorName);
                } else if (vscode.env.uiKind === vscode.UIKind.Desktop && !svdPath.startsWith('http')) {
                    // On desktop, ensure full path
                    if (!isAbsolute(svdPath) && wsFolderPath) {
                        svdPath = normalize(join(wsFolderPath.fsPath, svdPath));
                    }
                }
            } else if (deviceName) {
                svdPath = this.api.getSVDFile(deviceName);
                if (!svdPath) {
                    svdPath = await this.api.getSVDFileFromCortexDebug(deviceName);
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            vscode.debug.activeDebugConsole.appendLine((e as Error).message);
        }

        return svdPath;
    }

    protected async loadFromPack(pack: Pack, deviceName: string | undefined, processorName: string | undefined): Promise<string | undefined> {
        const getDeviceName = (device: Device) => (device as DeviceVariant).$.Dvariant || device.$.Dname;

        const assetBase = this.config.assetPath();
        const pdscPath = pdscFromPack(assetBase, pack);
        const pdscBuffer = await readFromUrl(pdscPath.toString());

        if (!pdscBuffer) {
            throw new Error(`No data loaded from ${pdscPath.toString()}`);
        }

        const decoder = new TextDecoder();
        const pdscString = decoder.decode(pdscBuffer);

        const pdsc = await parseStringPromise(pdscString, {
            explicitCharkey: true
        }) as PDSC;

        // Load devices from pack
        const devices = getDevices(pdsc);
        const deviceMap = new Map();
        for (const device of devices) {
            deviceMap.set(getDeviceName(device), device);
        }

        // Select device
        let packDevice: Device | undefined;

        if (deviceName && deviceMap.has(deviceName)) {
            packDevice = deviceMap.get(deviceName);
        } else if (!deviceName && devices.length == 1) {
            packDevice = devices[0];
        } else {
            // Ask user which device to use
            const selected = await vscode.window.showQuickPick([...deviceMap.keys()], { title: 'Select a device', placeHolder: deviceName });
            if (!selected) {
                return;
            }

            if (!deviceMap.has(selected)) {
                throw new Error(`Device not found: ${selected}`);
            }

            packDevice = deviceMap.get(selected);
        }

        if (!packDevice) {
            return;
        }

        // Load processors for device
        const processors = getProcessors(packDevice);

        // Select processor
        if (processorName && processors.includes(processorName)) {
            // Keep existing processor name
        } else if (!processorName && processors.length == 1) {
            processorName = processors[0];
        } else if (processors.length > 1) {
            // Ask user which processor to use
            const selected = await vscode.window.showQuickPick(processors, { title: 'Select a processor', placeHolder: processorName });
            if (!selected) {
                return;
            }

            if (!processors.includes(selected)) {
                throw new Error(`Processor not found: ${selected}`);
            }

            processorName = selected;
        }

        const svdFile = getSvdPath(packDevice, processorName);
        if (!svdFile) {
            throw new Error(`Unable to load device ${getDeviceName(packDevice)}`);
        }

        const svdUri = fileFromPack(assetBase, pack, svdFile);
        return svdUri.toString();
    }
}
