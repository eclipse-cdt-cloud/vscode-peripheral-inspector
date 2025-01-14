/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
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
    ignoredPeripherals: string[];
    peripherals: PeripheralNode[]
}

export class PeripheralTreeForSession extends PeripheralBaseNode {
    public readonly name: string;

    private static svdCache: { [path: string]: CachedSVDFile } = {};
    private peripherials: PeripheralNode[] = [];
    private loaded = false;
    private errMessage = 'No SVD file loaded';

    constructor(
        public session: vscode.DebugSession,
        protected api: PeripheralInspectorAPI,
        expanded: boolean,
        private fireCb: () => void) {
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
        this.peripherials.forEach((p) => {
            state.push(...p.saveState());
        });

        return state;
    }

    private static async addToCache(uri: vscode.Uri, peripherals: PeripheralNode[], ignoredPeripherals: string[]) {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat && stat.mtime) {
                const tmp: CachedSVDFile = {
                    svdUri: uri,
                    mtime: stat.mtime,
                    peripherals,
                    ignoredPeripherals
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
        let fileUri: vscode.Uri | undefined = undefined;
        let peripherials: PeripheralNode[] | undefined;
        const ignorePeripherals = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string[]>(manifest.IGNORE_PERIPHERALS) ?? [];

        try {
            let contents: ArrayBuffer | undefined;

            if (svdPath.startsWith('http')) {
                contents = await readFromUrl(svdPath);
            } else {
                fileUri = pathToUri(svdPath);
                const cached = await PeripheralTreeForSession.getFromCache(fileUri);
                if (cached && manifest.IgnorePeripherals.isEqual(cached.ignoredPeripherals, ignorePeripherals)) {
                    this.peripherials = cached.peripherals;
                    this.loaded = true;
                    this.errMessage = '';
                    await this.setSession(this.session);
                    return;
                }
                contents = await vscode.workspace.fs.readFile(fileUri);
            }

            if (!contents) {
                return;
            }

            const decoder = new TextDecoder();
            const data = decoder.decode(contents);
            const provider = this.api.getPeripheralsProvider(svdPath);

            if (provider) {
                const enumTypeValuesMap = {};
                const poptions = (await provider.getPeripherals(data, { gapThreshold })).filter(p => !manifest.IgnorePeripherals.includes(ignorePeripherals, p.name));
                peripherials = poptions.map((options) => new PeripheralNode(gapThreshold, options, this));
                peripherials.sort(PeripheralNodeSort.compare);

                for (const p of peripherials) {
                    p.resolveDeferedEnums(enumTypeValuesMap); // This can throw an exception
                    p.collectRanges();
                }
            } else {
                const parser = new SVDParser();
                peripherials = await parser.parseSVD(this, data, gapThreshold, ignorePeripherals);
            }

        } catch (e: unknown) {
            this.errMessage = `${svdPath}: Error: ${e ? e.toString() : 'Unknown error'}`;
            vscode.debug.activeDebugConsole.appendLine(this.errMessage);
        }

        if (!peripherials || peripherials.length === 0) {
            return;
        }

        try {
            this.peripherials = peripherials;
            this.loaded = true;
            await this.setSession(this.session);
            if (fileUri) {
                await PeripheralTreeForSession.addToCache(fileUri, this.peripherials, ignorePeripherals);
            }
        } catch (e) {
            this.peripherials = [];
            this.loaded = false;
            throw e;
        }
        this.loaded = true;
        this.errMessage = '';
    }

    public performUpdate(): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public updateData(): Thenable<boolean> {
        if (this.loaded) {
            const promises = this.peripherials.map((p) => p.updateData());
            Promise.all(promises).then((_) => { this.fireCb(); }, (_) => { this.fireCb(); });
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

        const peripheral = this.peripherials.find((p) => p.name === path[0]);
        if (!peripheral) { return undefined; }

        return peripheral.findByPath(path.slice(1));
    }

    public refresh(): void {
        this.fireCb();
    }

    public getChildren(element?: PeripheralBaseNode): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        if (this.loaded) {
            return element ? element.getChildren() : this.peripherials;
        } else if (!this.loaded) {
            return [new MessageNode(this.errMessage)];
        } else {
            return this.peripherials;
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

        this.peripherials = [];
        this.fireCb();

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
            this.peripherials.sort(PeripheralNodeSort.compare);
            this.fireCb();
        } catch (e) {
            this.errMessage = `Unable to parse definition file ${svdPath}: ${(e as Error).message}`;
            vscode.debug.activeDebugConsole.appendLine(this.errMessage);
            if (vscode.debug.activeDebugConsole) {
                vscode.debug.activeDebugConsole.appendLine(this.errMessage);
            }
            this.fireCb();
        }
    }

    public sessionTerminated(context: vscode.ExtensionContext): void {
        const state = this.saveState();
        this.saveSvdState(state, context);
    }

    public togglePinPeripheral(node: PeripheralBaseNode): void {
        node.pinned = !node.pinned;
        this.peripherials.sort(PeripheralNodeSort.compare);
    }

    serialize(): PeripheralSessionNodeDTO {
        return PeripheralSessionNodeDTO.create({
            ...super.serialize(),
            children: []
        });
    }
}
