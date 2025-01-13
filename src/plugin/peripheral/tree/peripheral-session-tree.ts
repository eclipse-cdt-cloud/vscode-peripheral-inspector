/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { IPeripheralsProvider, PeripheralOptions, PeripheralsConfiguration } from '../../../api-types';
import { NodeSetting, PERIPHERAL_ID_SEP, PeripheralNodeSort, PeripheralSessionNodeDTO } from '../../../common';
import * as manifest from '../../../manifest';
import { PeripheralInspectorAPI } from '../../../peripheral-inspector-api';
import { SVDParser } from '../../../svd-parser';
import { readFromUrl } from '../../../utils';
import { MessageNode, PeripheralBaseNode, PeripheralNode } from '../nodes';

const pathToUri = (path: string): vscode.Uri => {
    try {
        return vscode.Uri.file(path);
    } catch (e) {
        return vscode.Uri.parse(path);
    }
};

interface CachedSVDFile {
    svdUri: vscode.Uri;
    mtime: number;
    peripherals: PeripheralNode[],
    configuration: PeripheralsConfiguration;
}

export class PeripheralTreeForSession extends PeripheralBaseNode {
    public readonly name: string;

    private static svdCache: { [path: string]: CachedSVDFile } = {};

    private peripherals: PeripheralNode[] = [];
    private peripheralsConfiguration?: PeripheralsConfiguration;

    private loaded = false;
    private errMessage = 'No SVD file loaded';
    private svdUri: vscode.Uri | undefined;

    constructor(
        public session: vscode.DebugSession,
        protected api: PeripheralInspectorAPI,
        expanded: boolean,
        private fireRefresh: () => void) {
        super();
        this.name = this.session.name;
        this.expanded = expanded;

        this.init();
    }

    public getId(): string {
        return this.session.id;
    }

    private init(): void {
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.IGNORE_PERIPHERALS}`)) {
                this.reloadIgnoredPeripherals();
            }
        });
    }

    private static getStatePropName(session: vscode.DebugSession): string {
        const propName = (session.workspaceFolder?.name || '*unknown*') + '-SVDstate';
        return propName;
    }

    private async loadSvdState(context: vscode.ExtensionContext): Promise<NodeSetting[]> {
        const saveLayout = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<boolean>(manifest.CONFIG_SAVE_LAYOUT, manifest.DEFAULT_SAVE_LAYOUT);
        if (!saveLayout) {
            return [];
        }

        const propName = PeripheralTreeForSession.getStatePropName(this.session);
        const state = context.workspaceState.get(propName) as NodeSetting[] || [];
        return state;
    }

    private async saveSvdState(state: NodeSetting[], context: vscode.ExtensionContext): Promise<void> {
        const saveLayout = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<boolean>(manifest.CONFIG_SAVE_LAYOUT, manifest.DEFAULT_SAVE_LAYOUT);
        if (saveLayout && this.session) {
            const propName = PeripheralTreeForSession.getStatePropName(this.session);
            context.workspaceState.update(propName, state);
        }
    }

    public saveState(): NodeSetting[] {
        const state: NodeSetting[] = [];
        this.peripherals.forEach((p) => {
            state.push(...p.saveState());
        });

        return state;
    }

    private static async addToCache(uri: vscode.Uri, peripherals: PeripheralNode[], configuration: PeripheralsConfiguration) {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat && stat.mtime) {
                const tmp: CachedSVDFile = {
                    svdUri: uri,
                    mtime: stat.mtime,
                    peripherals,
                    configuration
                };
                PeripheralTreeForSession.svdCache[uri.toString()] = tmp;
            }
        } catch {
            delete PeripheralTreeForSession.svdCache[uri.toString()];
            return;
        }
    }

    private static async getFromCache(uri: vscode.Uri): Promise<CachedSVDFile | undefined> {
        try {
            const cached = PeripheralTreeForSession.svdCache[uri.toString()];
            if (cached) {
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat && (stat.mtime === stat.mtime)) {
                    return cached;
                }
                delete PeripheralTreeForSession.svdCache[uri.toString()];
            }
        } catch {
            return undefined;
        }
        return undefined;
    }

    private async createPeripherals(svdPath: string, gapThreshold: number): Promise<void> {
        this.errMessage = `Loading ${svdPath} ...`;
        let parsedConfiguration: PeripheralsConfiguration | undefined;
        let parsedPeripherals: PeripheralNode[] | undefined;

        const ignoredPeripherals = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string[]>(manifest.IGNORE_PERIPHERALS) ?? [];

        try {
            let contents: ArrayBuffer | undefined;

            if (svdPath.startsWith('http')) {
                contents = await readFromUrl(svdPath);
            } else {
                this.svdUri = pathToUri(svdPath);
                const cached = await PeripheralTreeForSession.getFromCache(this.svdUri);
                if (cached && manifest.IgnorePeripherals.isEqual(cached.configuration.ignoredPeripherals, ignoredPeripherals)) {
                    this.peripherals = cached.peripherals;
                    this.peripheralsConfiguration = cached.configuration;
                    this.loaded = true;
                    this.errMessage = '';
                    await this.setSession(this.session);
                    return;
                }
                contents = await vscode.workspace.fs.readFile(this.svdUri);
            }

            if (!contents) {
                return;
            }

            const decoder = new TextDecoder();
            const data = decoder.decode(contents);
            const provider = this.api.getPeripheralsProvider(svdPath);

            if (provider) {
                parsedConfiguration = await this.parseWithProvider(provider, data, gapThreshold, ignoredPeripherals);
            } else {
                parsedConfiguration = await this.parseWithSVDParser(data, gapThreshold, ignoredPeripherals);
            }

            const poptions = Array.from(Object.values(parsedConfiguration.peripheralOptions)).filter(p => !manifest.IgnorePeripherals.includes(ignoredPeripherals, p.name));
            parsedPeripherals = poptions.map((options) => new PeripheralNode(gapThreshold, options, this));
            parsedPeripherals.sort(PeripheralNodeSort.compare);

            for (const p of parsedPeripherals) {
                p.resolveDeferedEnums(parsedConfiguration.enumTypeValues); // This can throw an exception
                p.collectRanges();
            }

        } catch (e: unknown) {
            this.errMessage = `${svdPath}: Error: ${e ? e.toString() : 'Unknown error'}`;
            vscode.debug.activeDebugConsole.appendLine(this.errMessage);
        }

        if (!parsedConfiguration || !parsedPeripherals || parsedPeripherals.length === 0) {
            return;
        }

        try {
            this.peripherals = parsedPeripherals;
            this.peripheralsConfiguration = parsedConfiguration;

            this.loaded = true;
            await this.setSession(this.session);
            if (this.svdUri) {
                await PeripheralTreeForSession.addToCache(this.svdUri, this.peripherals, this.peripheralsConfiguration);
            }
        } catch (e) {
            this.peripherals = [];
            this.peripheralsConfiguration = undefined;
            this.loaded = false;
            throw e;
        }
        this.loaded = true;
        this.errMessage = '';
    }

    private async parseWithProvider(provider: IPeripheralsProvider, data: string, gapThreshold: number, ignoredPeripherals: string[]): Promise<PeripheralsConfiguration> {
        const enumTypeValues = {};
        const providedOptions = (await provider.getPeripherals(data, { gapThreshold }));
        const peripheralOptions = providedOptions.reduce((map, obj) => {
            map[obj.name] = obj;
            return map;
        }, {} as Record<string, PeripheralOptions>);

        return {
            gapThreshold,
            ignoredPeripherals,
            peripheralOptions,
            enumTypeValues
        };
    }

    private async parseWithSVDParser(data: string, gapThreshold: number, ignoredPeripherals: string[]): Promise<PeripheralsConfiguration> {
        const parser = new SVDParser();
        return await parser.parseSVD(data, gapThreshold, ignoredPeripherals);
    }


    /**
     * Reload allows the session to filter out peripherals that are in the ignore list or include them again.
     */
    private async reloadIgnoredPeripherals(): Promise<void> {
        if (!this.loaded || !this.peripheralsConfiguration) {
            // Do nothing
            return;
        }

        const newIgnoredPeripherals = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string[]>(manifest.IGNORE_PERIPHERALS) ?? [];
        const addPeripherals = this.peripheralsConfiguration.ignoredPeripherals.filter(p => !manifest.IgnorePeripherals.includes(newIgnoredPeripherals, p));
        this.peripheralsConfiguration.ignoredPeripherals = newIgnoredPeripherals;

        this.peripherals = this.peripherals.filter(p => !manifest.IgnorePeripherals.includes(newIgnoredPeripherals, p.name));
        if (addPeripherals.length > 0) {
            for (const peripheral of addPeripherals) {
                const options = this.peripheralsConfiguration.peripheralOptions[peripheral];
                if (options) {
                    const p = new PeripheralNode(this.peripheralsConfiguration.gapThreshold, options, this);
                    p.resolveDeferedEnums(this.peripheralsConfiguration.enumTypeValues);
                    p.collectRanges();
                    p.setSession(this.session);
                    this.peripherals.push(p);
                }
            }
            this.peripherals.sort(PeripheralNodeSort.compare);
        }

        if (this.svdUri) {
            await PeripheralTreeForSession.addToCache(this.svdUri, this.peripherals, this.peripheralsConfiguration);
        }

        this.refresh();
    }

    public performUpdate(): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public updateData(): Thenable<boolean> {
        if (this.loaded) {
            const promises = this.peripherals.map((p) => p.updateData());
            Promise.all(promises).then((_) => { this.refresh(); }, (_) => { this.refresh(); });
        }
        return Promise.resolve(true);
    }

    public getPeripheral(): PeripheralBaseNode {
        throw new Error('Method not implemented.');
    }

    public collectRanges(_ary: AddrRange[]): void {
        throw new Error('Method not implemented.');
    }

    public findByPath(path: string[]): PeripheralBaseNode | undefined {
        if (path[0] === this.getId()) {
            return this;
        }

        const peripheral = this.peripherals.find((p) => p.name === path[0]);
        if (!peripheral) { return undefined; }

        return peripheral.findByPath(path.slice(1));
    }

    public refresh(): void {
        this.fireRefresh();
    }

    public getChildren(element?: PeripheralBaseNode): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        if (this.loaded) {
            return element ? element.getChildren() : this.peripherals;
        } else if (!this.loaded) {
            return [new MessageNode(this.errMessage)];
        } else {
            return this.peripherals;
        }
    }

    public getCopyValue(): string | undefined {
        return undefined;
    }

    public async sessionStarted(context: vscode.ExtensionContext, svdPath: string, thresh: number): Promise<void> {        // Never rejects
        if (((typeof thresh) === 'number') && (thresh < 0)) {
            thresh = -1;     // Never merge register reads even if adjacent
        } else {
            // Set the threshold between 0 and 32, with a default of 16 and a multiple of 8
            thresh = ((((typeof thresh) === 'number') ? Math.max(0, Math.min(thresh, 32)) : 16) + 7) & ~0x7;
        }

        this.peripherals = [];
        this.refresh();

        try {
            await this.createPeripherals(svdPath, thresh);

            const settings = await this.loadSvdState(context);
            settings.forEach((s: NodeSetting) => {
                const node = this.findByPath(s.node.split(PERIPHERAL_ID_SEP));
                if (node) {
                    node.expanded = s.expanded || false;
                    node.pinned = s.pinned || false;
                    if (s.format) {
                        node.format = s.format;
                    }
                }
            });
            this.peripherals.sort(PeripheralNodeSort.compare);
            this.refresh();
        } catch (e) {
            this.errMessage = `Unable to parse definition file ${svdPath}: ${(e as Error).message}`;
            vscode.debug.activeDebugConsole.appendLine(this.errMessage);
            if (vscode.debug.activeDebugConsole) {
                vscode.debug.activeDebugConsole.appendLine(this.errMessage);
            }
            this.refresh();
        }
    }

    public sessionTerminated(context: vscode.ExtensionContext): void {
        const state = this.saveState();
        this.saveSvdState(state, context);
    }

    public togglePinPeripheral(node: PeripheralBaseNode): void {
        node.pinned = !node.pinned;
        this.peripherals.sort(PeripheralNodeSort.compare);
    }

    serialize(): PeripheralSessionNodeDTO {
        return PeripheralSessionNodeDTO.create({
            ...super.serialize(),
            children: []
        });
    }
}
