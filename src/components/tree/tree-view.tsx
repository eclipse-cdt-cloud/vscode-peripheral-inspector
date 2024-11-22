/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import 'primeflex/primeflex.css';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import './tree-view.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION, NotificationType } from 'vscode-messenger-common';
import { PeripheralNode, PeripheralTreeNode } from '../../common/peripherals';
import { Commands, NonBlockingCommands } from '../../manifest';
import { messenger } from '../webview/messenger';
import { AntDComponentTreeTable } from './components/ant-treetable';
import { ComponentTree } from './components/tree';
import { ComponentTreeTable } from './components/treetable';
import { PeripheralTreeConverter } from './integration/peripheral-tree';
import { CDTTreeContext, NotifyOptions } from './tree-context';
import {
    CDTTreeItem,
    CDTTreeState,
    CTDTreeMessengerType
} from './types';
import { TreeConverterContext } from './integration/tree-converter';

interface CDTTreeViewModel {
    items: CDTTreeItem<PeripheralTreeNode>[];
    expandedKeys: string[];
    pinnedKeys: string[];
}

interface State {
    tree: CDTTreeState;
    model: CDTTreeViewModel;
    isLoading: boolean;
}

export class CDTTreeView extends React.Component<unknown, State> {

    public constructor(props: unknown) {
        super(props);
        this.state = {
            tree: {
                type: 'tree'
            },
            model: {
                items: [],
                expandedKeys: [],
                pinnedKeys: []
            },
            isLoading: false
        };
    }

    public async componentDidMount(): Promise<void> {
        messenger.onNotification(CTDTreeMessengerType.updateState, tree => {
            this.setState(prev => ({
                ...prev, tree,
            }));
            this.refreshModel(tree.peripherals, {
                resourceMap: new Map<string, PeripheralTreeNode>(),
                expandedKeys: PeripheralTreeNode.extractExpandedKeys(tree.peripherals),
                pinnedKeys: PeripheralTreeNode.extractPinnedKeys(tree.peripherals)
            });
        });
        messenger.sendNotification(CTDTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected refreshModel(peripherals: PeripheralNode[] | undefined, context: TreeConverterContext<PeripheralTreeNode>): void {
        const items = new PeripheralTreeConverter().convertList(
            peripherals ?? this.state.tree.peripherals ?? [],
            context
        );

        this.setState(prev => ({
            ...prev, model: {
                expandedKeys: context.expandedKeys,
                pinnedKeys: context.pinnedKeys,
                items,
            },
            isLoading: false
        }));
    }

    protected notify<TNotification extends NotificationType<unknown>>(
        notification: TNotification,
        params: TNotification extends NotificationType<infer TParams> ? TParams : never,
        options?: NotifyOptions): void {
        this.setState(prev => ({ ...prev, isLoading: options?.isLoading ?? true }));
        messenger.sendNotification(notification, HOST_EXTENSION, params);
    }

    // Create TreeView flavors
    protected createTree(): React.ReactNode {
        return <ComponentTree
            nodes={this.state.tree.items}
            selectedNode={this.state.tree.selectedItem}
            isLoading={this.state.isLoading}
        />;
    }

    protected createTreeTable(): React.ReactNode {
        return <ComponentTreeTable
            nodes={this.state.tree.items}
            selectedNode={this.state.tree.selectedItem}
            columnDefinitions={this.state.tree.columnFields}
            isLoading={this.state.isLoading}
        />;
    }

    protected createAntDTreeTable(): React.ReactNode {
        return <AntDComponentTreeTable<PeripheralTreeNode>
            dataSource={this.state.model.items}
            dataSourceComparer={(p1, p2) => {
                if (PeripheralNode.is(p1.resource) && PeripheralNode.is(p2.resource)) {
                    PeripheralNode.compare({ ...p1.resource, pinned: p1.pinned }, { ...p2.resource, pinned: p2.pinned });
                }

                return 0;
            }}
            columnDefinitions={this.state.tree.columnFields}
            isLoading={this.state.isLoading}
            expansion={{
                expandedRowKeys: this.state.model.expandedKeys,
                onExpand: (expanded, record) => {
                    this.setState(prev => ({ ...prev, model: { ...prev.model, expandedKeys: updateKeys(this.state.model.expandedKeys, record.id, expanded) } }));
                    this.notify(CTDTreeMessengerType.toggleNode,
                        { data: record, context: { resync: false } },
                        { isLoading: false }
                    );
                }
            }}
            pin={{
                pinnedRowKeys: this.state.model.pinnedKeys,
                onPin: (event, pinned, record) => {
                    this.refreshModel(
                        undefined,
                        {
                            resourceMap: new Map<string, PeripheralTreeNode>(),
                            expandedKeys: this.state.model.expandedKeys,
                            pinnedKeys: updateKeys(this.state.model.pinnedKeys, record.id, pinned)
                        }
                    );

                    if (pinned) {
                        this.notify(CTDTreeMessengerType.executeCommand,
                            { data: { commandId: Commands.UNPIN_COMMAND.commandId, item: record }, context: { resync: false } },
                            { isLoading: false }
                        );
                    } else {
                        this.notify(CTDTreeMessengerType.executeCommand,
                            { data: { commandId: Commands.PIN_COMMAND.commandId, item: record }, context: { resync: false } },
                            { isLoading: false }
                        );
                    }

                    event.stopPropagation();
                }
            }}
            action={
                {
                    onAction: (event, command, record) => {
                        const isLoading = !NonBlockingCommands.IDS.includes(command.commandId);
                        this.notify(CTDTreeMessengerType.executeCommand, { data: { commandId: command.commandId, item: record } }, { isLoading });
                        event.stopPropagation();
                    }
                }
            }
        />;
    }

    public render(): React.ReactNode {
        const child = (() => {
            switch (this.state.tree.type) {
                case 'tree':
                    return this.createTree();
                case 'treetable':
                    return this.createTreeTable();
                case 'antd-treetable':
                    return this.createAntDTreeTable();
            }
        })();

        return <div data-vscode-context='{"preventDefaultContextMenuItems": true}'>
            <CDTTreeContext.Provider value={{
                notify: this.notify.bind(this)
            }
            }>
                {child}
            </CDTTreeContext.Provider>
        </div>;
    }
}


function updateKeys(ids: string[], key: string, add: boolean): string[] {
    if (add) {
        return [...ids, key];
    } else {
        return ids.filter(k => k !== key);
    }
}


const container = document.getElementById('root') as Element;
createRoot(container).render(<CDTTreeView />);
