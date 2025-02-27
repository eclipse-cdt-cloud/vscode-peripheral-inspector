/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import 'primeflex/primeflex.css';
import './peripheral-view.css';

import {
    CDTTreeExtensionModel,
    CDTTreeItem,
    CDTTreeMessengerType,
    CDTTreeViewModel,
    CDTTreeConverterContext,
    CDTTreePartialUpdate,
} from '@eclipse-cdt-cloud/vscode-ui-components';
import {
    messenger,
    CDTTree
} from '@eclipse-cdt-cloud/vscode-ui-components/lib/browser-types';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION, NotificationType } from 'vscode-messenger-common';
import { PeripheralNodeSort } from '../../common';
import {
    PeripheralNodeDTO,
    PeripheralSessionNodeDTO,
    PeripheralTreeNodeDTOs,
} from '../../common/peripheral-dto';
import { Commands } from '../../manifest';
import { PeripheralTreeConverter } from './peripheral-resource-converter';

messenger.start();

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
                pinnedKeys: [],
                references: {},
                resources: {},
                root: CDTTreeItem.createRoot(),
            },
        };
    }

    public async componentDidMount(): Promise<void> {
        messenger.onNotification(CDTTreeMessengerType.updateState, (state: CDTTreeExtensionModel<PeripheralTreeNodeDTOs>) => {
            this.setState(prev => ({
                ...prev, extensionModel: state,
            }));
            this.refreshFull(state.items);
        });
        messenger.onNotification(CDTTreeMessengerType.updatePartial, (message: CDTTreePartialUpdate<PeripheralTreeNodeDTOs>) => {
            this.refreshPartial(message.items ?? []);
        });
        messenger.onNotification(CDTTreeMessengerType.openSearch, () => {
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
        messenger.sendNotification(CDTTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected refreshFull(items: PeripheralTreeNodeDTOs[] | undefined): void {
        const context: CDTTreeConverterContext<PeripheralTreeNodeDTOs> = {
            assignedItems: {},
            assignedResources: {},
            expandedKeys: [],
            pinnedKeys: []
        };
        const converter = new PeripheralTreeConverter();
        const toConvert = items ?? this.state.extensionModel.items ?? [];
        // Create a root item
        // Allows the items to be siblings
        const root = CDTTreeItem.createRoot();
        const convertedItems = toConvert.map(c => converter.convert(c,
            {
                ...context,
                parent: root
            }
        ));
        root.children = convertedItems;

        this.setState(prev => ({
            ...prev, viewModel: {
                references: context.assignedItems,
                resources: context.assignedResources,
                expandedKeys: context.expandedKeys,
                pinnedKeys: context.pinnedKeys,
                items: convertedItems,
                root
            },
        }));
    }

    protected refreshPartial(items: PeripheralTreeNodeDTOs[]): void {
        if (items.length === 0) {
            return;
        }

        this.setState(prev => {
            const context: CDTTreeConverterContext<PeripheralTreeNodeDTOs> = {
                expandedKeys: prev.viewModel.expandedKeys,
                pinnedKeys: prev.viewModel.pinnedKeys,
                assignedItems: prev.viewModel.references,
                assignedResources: prev.viewModel.resources
            };
            const converter = new PeripheralTreeConverter();

            const convertedItems = items.map(item => {
                let parent = prev.viewModel.root;
                if (item.parentId) {
                    parent = context.assignedItems[item.parentId] ?? parent;
                }

                return converter.convert(item,
                    {
                        ...context,
                        parent
                    }
                );

            });

            convertedItems.forEach(item => {
                // Replace the old item with the new one
                const childrenToUpdate = item.parent ? item.parent.children ?? [] : prev.viewModel.items;
                const index = childrenToUpdate.findIndex(c => c.id === item.id);
                if (index >= 0) {
                    childrenToUpdate[index] = item;
                } else {
                    childrenToUpdate.push(item);
                }
            });

            return {
                ...prev, viewModel: {
                    expandedKeys: context.expandedKeys,
                    pinnedKeys: context.pinnedKeys,
                    references: context.assignedItems,
                    resources: context.assignedResources,
                    items: prev.viewModel.items,
                    root: prev.viewModel.root
                },
            };
        });
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
            <CDTTree<PeripheralTreeNodeDTOs>
                dataSource={this.state.viewModel.items}
                dataSourceSorter={(dataSource) => this.dataSourceSorter(dataSource)}
                columnDefinitions={this.state.extensionModel.columnFields}
                expansion={{
                    expandedRowKeys: this.state.viewModel.expandedKeys,
                    onExpand: (expanded, record) => {
                        this.setState(prev => ({ ...prev, viewModel: { ...prev.viewModel, expandedKeys: updateKeys(this.state.viewModel.expandedKeys, record.id, expanded) } }));
                        this.notify(CDTTreeMessengerType.toggleNode,
                            { data: record.id },
                        );
                    }
                }}
                pin={{
                    pinnedRowKeys: this.state.viewModel.pinnedKeys,
                    onPin: (event, pinned, record) => {
                        this.setState(prev => ({ ...prev, viewModel: { ...prev.viewModel, pinnedKeys: updateKeys(this.state.viewModel.pinnedKeys, record.id, pinned) } }));

                        if (pinned) {
                            this.notify(CDTTreeMessengerType.executeCommand,
                                { data: { commandId: Commands.UNPIN_COMMAND.commandId, itemId: record.id } },
                            );
                        } else {
                            this.notify(CDTTreeMessengerType.executeCommand,
                                { data: { commandId: Commands.PIN_COMMAND.commandId, itemId: record.id } },
                            );
                        }

                        event.stopPropagation();
                    }
                }}
                action={
                    {
                        onAction: (event, command, value, record, api) => {
                            if (command.commandId === Commands.UPDATE_NODE_COMMAND.commandId) {
                                api.selectRow(record);
                                return api.setEditRowKey(record.key);
                            }

                            event.stopPropagation();
                            this.notify(CDTTreeMessengerType.executeCommand, { data: { commandId: command.commandId, itemId: record.id, value } });
                        }
                    }
                }
                edit={
                    {
                        onEdit: (record, value) => {
                            this.notify(CDTTreeMessengerType.executeCommand, { data: { commandId: Commands.UPDATE_NODE_COMMAND.commandId, itemId: record.id, value } });
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
