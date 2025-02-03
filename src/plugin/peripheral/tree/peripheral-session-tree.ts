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
import { PeripheralConfigurationProvider } from './peripheral-configuration-provider';
import { DebugSessionStatus } from '../../../debug-tracker';
import { clearTimeout, setTimeout } from 'timers';

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

    private sessionStatus: DebugSessionStatus = DebugSessionStatus.Unknown;
    private onSessionTerminated: vscode.Disposable[] = [];
    private sessionRefreshTimer?: NodeJS.Timeout;

    constructor(
        public session: vscode.DebugSession,
        protected api: PeripheralInspectorAPI,
        protected config: PeripheralConfigurationProvider,
        expanded: boolean,
        private fireRefresh: () => void) {
        super();
        this.name = this.session.name;
        this.expanded = expanded;
    }

    public getId(): string {
        return this.session.id;
    }

    private static getStatePropName(session: vscode.DebugSession): string {
        const propName = (session.workspaceFolder?.name || '*unknown*') + '-SVDstate';
        return propName;
    }

    private async loadSvdState(context: vscode.ExtensionContext): Promise<NodeSetting[]> {
        const saveLayout = this.config.saveLayout();
        if (!saveLayout) {
            return [];
        }

        const propName = PeripheralTreeForSession.getStatePropName(this.session);
        const state = context.workspaceState.get(propName) as NodeSetting[] || [];
        return state;
    }

    private async saveSvdState(state: NodeSetting[], context: vscode.ExtensionContext): Promise<void> {
        const saveLayout = this.config.saveLayout();
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

        const ignoredPeripherals = this.config.ignorePeripherals();

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

                    // Update peripherals to use new session
                    this.peripherals.forEach((p) => p.setParent(this));
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
    async reloadIgnoredPeripherals(): Promise<void> {
        if (!this.loaded || !this.peripheralsConfiguration) {
            // Do nothing
            return;
        }

        const newIgnoredPeripherals = this.config.ignorePeripherals();
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

        this.refresh();

        if (this.svdUri) {
            await PeripheralTreeForSession.addToCache(this.svdUri, this.peripherals, this.peripheralsConfiguration);
        }
    }

    public async performUpdate(): Promise<boolean> {
        return false;
    }

    public async updateData(): Promise<boolean> {
        if (this.loaded && this.sessionStatus !== DebugSessionStatus.Terminated) {
            await Promise.all(this.peripherals.map(peripheral => peripheral.updateData())).finally(() => this.refresh());
        }
        return true;
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

        this.onSessionTerminated.forEach(disposable => disposable.dispose());
        this.onSessionTerminated = [];
        this.onSessionTerminated.push(this.config.onDidChangePeriodicRefreshMode(() => this.updatePeriodicRefresh(), this.session));
        this.onSessionTerminated.push(this.config.onDidChangePeriodicRefreshInterval(() => this.updatePeriodicRefresh(), this.session));
        this.setSessionStatus(DebugSessionStatus.Started);

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
        } catch (error) {
            this.errMessage = `Unable to parse definition file ${svdPath}: ${(error as Error).message}`;
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
        this.setSessionStatus(DebugSessionStatus.Terminated);
        this.onSessionTerminated.forEach(disposable => disposable.dispose());
        this.onSessionTerminated = [];
    }

    public debugStopped(_context: vscode.ExtensionContext): void {
        this.setSessionStatus(DebugSessionStatus.Stopped);
        // We are stopped for many reasons very briefly where we cannot even execute any queries
        // reliably and get errors. Programs stop briefly to set breakpoints, during startup/reset/etc.
        // Also give VSCode some time to finish it's updates (Variables, Stacktraces, etc.)
        setTimeout(() => {
            if (this.sessionStatus !== DebugSessionStatus.Terminated) {
                this.updateData(); // We are called even before the session has started, as part of reset
            }
        }, 100);
    }

    public debugContinued(_context: vscode.ExtensionContext): void {
        this.setSessionStatus(DebugSessionStatus.Running);
    }

    protected setSessionStatus(status: DebugSessionStatus): void {
        this.sessionStatus = status;
        this.updatePeriodicRefresh();
    }

    protected isSessionRunning(): boolean {
        return this.sessionStatus === DebugSessionStatus.Started || this.sessionStatus === DebugSessionStatus.Running;
    }

    protected updatePeriodicRefresh(): void {
        if (this.sessionRefreshTimer) {
            clearTimeout(this.sessionRefreshTimer);
        }

        const refresh = this.config.periodicRefreshMode(this.session);
        const interval = this.config.periodicRefreshInterval(this.session);
        if (interval <= 0 || this.sessionStatus === DebugSessionStatus.Terminated) {
            return;
        }
        if (refresh === 'always' || (refresh === 'while running' && this.isSessionRunning()) || (refresh === 'while stopped' && !this.isSessionRunning())) {
            const scheduleRefresh = () => this.updateData().finally(() => this.updatePeriodicRefresh());
            this.sessionRefreshTimer = setTimeout(scheduleRefresh, interval);
        }
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
