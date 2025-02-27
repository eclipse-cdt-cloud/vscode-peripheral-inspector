/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CommandDefinition } from '@eclipse-cdt-cloud/vscode-ui-components/lib/vscode/webview-types';

export const PACKAGE_NAME = 'peripheral-inspector';
export const CONFIG_SVD_PATH = 'definitionPathConfig';
export const DEFAULT_SVD_PATH = 'definitionPath';
export const CONFIG_DEVICE = 'deviceConfig';
export const DEFAULT_DEVICE = 'deviceName';
export const CONFIG_PROCESSOR = 'processorConfig';
export const DEFAULT_PROCESSOR = 'processorName';
export const CONFIG_ADDRGAP = 'svdAddrGapThreshold';
export const DEFAULT_ADDRGAP = 16;
export const CONFIG_ASSET_PATH = 'packAssetUrl';
export const DEFAULT_ASSET_PATH = 'https://pack-content.cmsis.io';
export const CONFIG_SAVE_LAYOUT = 'saveLayout';
export const DEFAULT_SAVE_LAYOUT = true;
export const CONFIG_IGNORE_PERIPHERALS = 'ignorePeripherals';
export const DEFAULT_IGNORE_PERIPHERALS: string[] = [];

// Periodic Refresh
export const CONFIG_PERIODIC_REFRESH_MODE = 'periodicRefreshMode';
export const PERIODIC_REFRESH_MODE_CHOICES = ['always', 'while stopped', 'while running', 'off'] as const;
export type PeriodicRefreshMode = (typeof PERIODIC_REFRESH_MODE_CHOICES)[number];
export const DEFAULT_PERIODIC_REFRESH_MODE: PeriodicRefreshMode = 'always';

export const CONFIG_PERIODIC_REFRESH_INTERVAL = 'periodicRefreshInterval';
export const DEFAULT_PERIODIC_REFRESH_INTERVAL = 500;

// Commands
export namespace Commands {
    // Commands used only within VSCode
    export const SET_FORMAT_COMMAND_ID = `${PACKAGE_NAME}.svd.setFormat`;
    export const FIND_COMMAND_ID = `${PACKAGE_NAME}.svd.find`;
    export const REFRESH_ALL_COMMAND_ID = `${PACKAGE_NAME}.svd.refreshAll`;
    export const COLLAPSE_ALL_COMMAND_ID = `${PACKAGE_NAME}.svd.collapseAll`;
    export const EXPORT_ALL_COMMAND_ID = `${PACKAGE_NAME}.svd.exportAll`;
    export const IGNORE_PERIPHERAL_ID = `${PACKAGE_NAME}.svd.ignorePeripheral`;
    export const CLEAR_IGNORED_PERIPHERAL_ID = `${PACKAGE_NAME}.svd.clearIgnoredPeripherals`;
    export const PERIODIC_REFRESH_ID = `${PACKAGE_NAME}.svd.periodicRefreshMode`;
    export const PERIODIC_REFRESH_INTERVAL_ID = `${PACKAGE_NAME}.svd.periodicRefreshInterval`;

    // Commands used in the UI. They are manually inserted into the DOM.
    export const UPDATE_NODE_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.updateNode`,
        icon: 'edit',
        title: 'Update Value'
    } as const;
    export const EXPORT_NODE_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.exportNode`,
        icon: 'desktop-download',
        title: 'Export Register'
    } as const;
    export const COPY_VALUE_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.copyValue`,
        icon: 'files',
        title: 'Copy Value'
    } as const;
    export const FORCE_REFRESH_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.forceRefresh`,
        icon: 'refresh',
        title: 'Refresh'
    } as const;
    export const PIN_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.pin`,
        icon: 'pin',
        title: 'Pin'
    } as const;
    export const UNPIN_COMMAND: CommandDefinition = {
        commandId: `${PACKAGE_NAME}.svd.unpin`,
        icon: 'pinned',
        title: 'Unpin'
    } as const;
}

export namespace IgnorePeripherals {
    export function isEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    /**
     * Case insensitive check if element is in ignore list
     */
    export function includes(ignore: string[], element: string): boolean {
        return ignore.some((v) => v.toLowerCase() === element.toLowerCase());
    }
}
