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
import { messenger } from '../webview/messenger';
import { ComponentTree } from './components/tree';
import {
    CDTTreeState,
    CTDTreeMessengerType
} from './types';
import { CDTTreeContext } from './tree-context';
import { ComponentTreeTable } from './components/treetable';

interface State {
    tree: CDTTreeState;
    isLoading: boolean;
}

export class CDTTreeView extends React.Component<unknown, State> {

    public constructor(props: unknown) {
        super(props);
        this.state = {
            tree: {
                type: 'tree'
            },
            isLoading: false
        };
    }

    public async componentDidMount(): Promise<void> {
        messenger.onNotification(CTDTreeMessengerType.updateState, tree => {
            this.setState(prev => ({ ...prev, tree, isLoading: false }));
        });
        messenger.sendNotification(CTDTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected notify<TNotification extends NotificationType<P>, P>(notification: TNotification, params: P): void {
        this.setState(prev => ({ ...prev, isLoading: true }));
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

    public render(): React.ReactNode {
        const child = (() => {
            switch (this.state.tree.type) {
                case 'tree':
                    return this.createTree();
                case 'treetable':
                    return this.createTreeTable();
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

const container = document.getElementById('root') as Element;
createRoot(container).render(<CDTTreeView />);
