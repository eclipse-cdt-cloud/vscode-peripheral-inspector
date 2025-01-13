/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import { CDTTreeItem, CDTTreeItemResource } from '../types';
import { classNames } from './utils';
import React from 'react';

export interface RenderExpandIconProps<RecordType> {
    prefixCls: string;
    expanded: boolean;
    record: RecordType;
    expandable: boolean;
    onExpand: TriggerEventHandler<RecordType>;
}

export type TriggerEventHandler<RecordType> = (record: RecordType, event: React.MouseEvent<HTMLElement>) => void;

export function ExpandIcon<T extends CDTTreeItemResource>({ expanded, onExpand, record, expandable }: RenderExpandIconProps<CDTTreeItem<T>>): React.ReactElement {
    if (!expandable) {
        // simulate spacing to the left that we gain through expand icon so that leaf items look correctly intended
        return <span className='leaf-item-spacer' />;
    }

    const doExpand = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onExpand(record, event);
    };

    const iconClass = expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
    return (
        <div
            className={classNames('tree-toggler-container', 'codicon', iconClass)}
            onClick={doExpand}
            role="button"
            tabIndex={0}
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') doExpand(event as unknown as React.MouseEvent<HTMLElement>); }}
        ></div>
    );
}
