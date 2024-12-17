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
import { PeripheralNodeDTO, PeripheralSessionNodeDTO, PeripheralTreeNodeDTOs } from '../../common/peripheral-dto';
import { Commands } from '../../manifest';
import { messenger } from '../webview/messenger';
import { AntDComponentTreeTable } from './components/treetable';
import { PeripheralTreeConverter } from './integration/peripheral-tree-converter';
import { TreeConverterContext } from './integration/tree-converter';
import {
    CDTTreeExtensionModel,
    CDTTreeItem,
    CDTTreeViewModel,
    CTDTreeMessengerType
} from './types';
import { PeripheralNodeSort } from '../../common';


interface State {
    extensionModel: CDTTreeExtensionModel<PeripheralTreeNodeDTOs>;
    viewModel: CDTTreeViewModel<PeripheralTreeNodeDTOs>;
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
        messenger.onNotification(CTDTreeMessengerType.updateState, (state: CDTTreeExtensionModel<PeripheralTreeNodeDTOs>) => {
            this.setState(prev => ({
                ...prev, extensionModel: state,
            }));
            this.refreshModel(state.items, {
                resourceMap: new Map<string, PeripheralTreeNodeDTOs>(),
                expandedKeys: PeripheralTreeNodeDTOs.extractExpandedKeys(state.items),
                pinnedKeys: PeripheralTreeNodeDTOs.extractPinnedKeys(state.items)
            });
        });
        messenger.onNotification(CTDTreeMessengerType.openSearch, () => {
            const elements = document.getElementsByClassName('search-overlay visible');
            if (elements.length > 0) {
                // search overlay is already visible
                elements[0]?.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true
                }));
            } else {
                document.getElementById('tree-table-root')?.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'f',
                    code: 'KeyF',
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true
                }));
            }
        });
        messenger.sendNotification(CTDTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected refreshModel(items: PeripheralTreeNodeDTOs[] | undefined, context: TreeConverterContext<PeripheralTreeNodeDTOs>): void {
        const converter = new PeripheralTreeConverter();
        const toConvert = items ?? this.state.extensionModel.items ?? [];
        const parent = CDTTreeItem.createRoot();
        const convertedItems = toConvert.map(c => converter.convert(c,
            {
                ...context,
                parent
            }
        ));
        parent.children = convertedItems;

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
        return <div data-vscode-context='{"preventDefaultContextMenuItems": true}'>
            <AntDComponentTreeTable<PeripheralTreeNodeDTOs>
                dataSource={this.state.viewModel.items}
                dataSourceSorter={(dataSource) => this.dataSourceSorter(dataSource)}
                columnDefinitions={this.state.extensionModel.columnFields}
                expansion={{
                    expandedRowKeys: this.state.viewModel.expandedKeys,
                    onExpand: (expanded, record) => {
                        this.setState(prev => ({ ...prev, viewModel: { ...prev.viewModel, expandedKeys: updateKeys(this.state.viewModel.expandedKeys, record.id, expanded) } }));
                        this.notify(CTDTreeMessengerType.toggleNode,
                            { data: record.id, context: { resync: false } },
                        );
                    }
                }}
                pin={{
                    pinnedRowKeys: this.state.viewModel.pinnedKeys,
                    onPin: (event, pinned, record) => {
                        this.refreshModel(
                            undefined,
                            {
                                resourceMap: new Map<string, PeripheralTreeNodeDTOs>(),
                                expandedKeys: this.state.viewModel.expandedKeys,
                                pinnedKeys: updateKeys(this.state.viewModel.pinnedKeys, record.id, pinned)
                            }
                        );

                        if (pinned) {
                            this.notify(CTDTreeMessengerType.executeCommand,
                                { data: { commandId: Commands.UNPIN_COMMAND.commandId, itemId: record.id }, context: { resync: false } },
                            );
                        } else {
                            this.notify(CTDTreeMessengerType.executeCommand,
                                { data: { commandId: Commands.PIN_COMMAND.commandId, itemId: record.id }, context: { resync: false } },
                            );
                        }

                        event.stopPropagation();
                    }
                }}
                action={
                    {
                        onAction: (event, command, value, record) => {
                            event.stopPropagation();
                            this.notify(CTDTreeMessengerType.executeCommand, { data: { commandId: command.commandId, itemId: record.id, value } });
                        }
                    }
                }
                edit={
                    {
                        onEdit: (record, value) => {
                            this.notify(CTDTreeMessengerType.executeCommand, { data: { commandId: Commands.UPDATE_NODE_COMMAND.commandId, itemId: record.id, value } });
                        }
                    }
                }
            /></div>;
    }

    protected dataSourceSorter(dataSource: CDTTreeItem<PeripheralTreeNodeDTOs>[]): CDTTreeItem<PeripheralTreeNodeDTOs>[] {
        if (dataSource.length === 0) {
            return dataSource;
        }

        const peripheralSort = (p1: CDTTreeItem<PeripheralTreeNodeDTOs>, p2: CDTTreeItem<PeripheralTreeNodeDTOs>) => {
            if (PeripheralNodeDTO.is(p1.resource) && PeripheralNodeDTO.is(p2.resource)) {
                return PeripheralNodeSort.compare({ ...p1.resource, pinned: p1.pinned }, { ...p2.resource, pinned: p2.pinned });
            }

            return 0;
        };

        if (PeripheralSessionNodeDTO.is(dataSource[0].resource)) {
            // We have sessions as root
            dataSource.forEach(session => {
                session.children?.sort(peripheralSort);
            });

            return dataSource;
        } else if (PeripheralNodeDTO.is(dataSource[0].resource)) {
            // We have peripheral as root
            return dataSource.sort(peripheralSort);
        }

        return dataSource;
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
