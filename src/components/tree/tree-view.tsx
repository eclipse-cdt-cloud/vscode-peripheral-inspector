/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import 'primeflex/primeflex.css';
import './tree-view.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION, NotificationType } from 'vscode-messenger-common';
import { PeripheralNode, PeripheralTreeNode } from '../../common/peripherals';
import { Commands } from '../../manifest';
import { messenger } from '../webview/messenger';
import { AntDComponentTreeTable } from './components/treetable';
import { PeripheralTreeConverter } from './integration/peripheral-tree-converter';
import { TreeConverterContext } from './integration/tree-converter';
import {
    CDTTreeExtensionModel,
    CDTTreeViewModel,
    CTDTreeMessengerType
} from './types';


interface State {
    extensionModel: CDTTreeExtensionModel<PeripheralTreeNode>;
    viewModel: CDTTreeViewModel<PeripheralTreeNode>;
}

export class CDTTreeView extends React.Component<unknown, State> {

    public constructor(props: unknown) {
        super(props);
        this.state = {
            extensionModel: {},
            viewModel: {
                items: [],
                expandedKeys: [],
                pinnedKeys: []
            },
        };
    }

    public async componentDidMount(): Promise<void> {
        messenger.onNotification(CTDTreeMessengerType.updateState, (state: CDTTreeExtensionModel<PeripheralTreeNode>) => {
            this.setState(prev => ({
                ...prev, extensionModel: state,
            }));
            this.refreshModel(state.items, {
                resourceMap: new Map<string, PeripheralTreeNode>(),
                expandedKeys: PeripheralTreeNode.extractExpandedKeys(state.items),
                pinnedKeys: PeripheralTreeNode.extractPinnedKeys(state.items)
            });
        });
        messenger.sendNotification(CTDTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected refreshModel(items: PeripheralTreeNode[] | undefined, context: TreeConverterContext<PeripheralTreeNode>): void {
        const convertedItems = new PeripheralTreeConverter().convertList(
            items ?? this.state.extensionModel.items ?? [],
            context
        );

        this.setState(prev => ({
            ...prev, viewModel: {
                expandedKeys: context.expandedKeys,
                pinnedKeys: context.pinnedKeys,
                items: convertedItems,
            },
        }));
    }

    protected notify<TNotification extends NotificationType<unknown>>(
        notification: TNotification,
        params: TNotification extends NotificationType<infer TParams> ? TParams : never): void {
        messenger.sendNotification(notification, HOST_EXTENSION, params);
    }

    public render(): React.ReactNode {
        return <div>
            {this.createTreeTable()}
        </div>;
    }

    protected createTreeTable(): React.ReactNode {
        return <AntDComponentTreeTable<PeripheralTreeNode>
            dataSource={this.state.viewModel.items}
            dataSourceComparer={(p1, p2) => {
                if (PeripheralNode.is(p1.resource) && PeripheralNode.is(p2.resource)) {
                    return PeripheralNode.compare({ ...p1.resource, pinned: p1.pinned }, { ...p2.resource, pinned: p2.pinned });
                }

                return 0;
            }}
            columnDefinitions={this.state.extensionModel.columnFields}
            expansion={{
                expandedRowKeys: this.state.viewModel.expandedKeys,
                onExpand: (expanded, record) => {
                    this.setState(prev => ({ ...prev, viewModel: { ...prev.viewModel, expandedKeys: updateKeys(this.state.viewModel.expandedKeys, record.id, expanded) } }));
                    this.notify(CTDTreeMessengerType.toggleNode,
                        { data: record, context: { resync: false } },
                    );
                }
            }}
            pin={{
                pinnedRowKeys: this.state.viewModel.pinnedKeys,
                onPin: (event, pinned, record) => {
                    this.refreshModel(
                        undefined,
                        {
                            resourceMap: new Map<string, PeripheralTreeNode>(),
                            expandedKeys: this.state.viewModel.expandedKeys,
                            pinnedKeys: updateKeys(this.state.viewModel.pinnedKeys, record.id, pinned)
                        }
                    );

                    if (pinned) {
                        this.notify(CTDTreeMessengerType.executeCommand,
                            { data: { commandId: Commands.UNPIN_COMMAND.commandId, item: record }, context: { resync: false } },
                        );
                    } else {
                        this.notify(CTDTreeMessengerType.executeCommand,
                            { data: { commandId: Commands.PIN_COMMAND.commandId, item: record }, context: { resync: false } },
                        );
                    }

                    event.stopPropagation();
                }
            }}
            action={
                {
                    onAction: (event, command, value, record) => {
                        event.stopPropagation();
                        this.notify(CTDTreeMessengerType.executeCommand, { data: { commandId: command.commandId, item: record, value } });
                    }
                }
            }
        />;
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
