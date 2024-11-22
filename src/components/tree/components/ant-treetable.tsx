/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './ant-treetable.css';
import './common.css';

import { ConfigProvider, Table, TableColumnsType } from 'antd';
import { ColumnType, ExpandableConfig } from 'antd/es/table/interface';
import { ProgressBar } from 'primereact/progressbar';
import { classNames } from 'primereact/utils';
import { default as React, useEffect, useState } from 'react';
import { CommandDefinition } from '../../../common';
import { CDTTreeItem, CDTTreeTableActionColumn, CDTTreeTableColumnDefinition, CDTTreeTableStringColumn, CTDTreeWebviewContext } from '../types';
import { createHighlightedText, createLabelWithTooltip } from './utils';
import { getNestedValue } from '../../../common/utils';

export type ComponentTreeTableProps<T = unknown> = {
    columnDefinitions?: CDTTreeTableColumnDefinition[];
    dataSource?: CDTTreeItem<T>[];
    dataSourceComparer?: (a: CDTTreeItem<T>, b: CDTTreeItem<T>) => number;
    expansion?: {
        expandedRowKeys?: string[];
        onExpand?: ExpandableConfig<CDTTreeItem<unknown>>['onExpand'];
    },
    pin?: {
        pinnedRowKeys?: string[];
        onPin?: (event: React.MouseEvent, pinned: boolean, record: CDTTreeItem<unknown>) => void;
    }
    action?: {
        onAction?: (event: React.MouseEvent, command: CommandDefinition, record: CDTTreeItem<unknown>) => void;
    },
    isLoading: boolean;
};

interface BodyRowProps extends React.HTMLAttributes<HTMLDivElement> {
    'data-row-key': string;
}

const BodyRow = React.forwardRef<HTMLDivElement, BodyRowProps>((props, ref) => {
    return (
        <div
            ref={ref}
            {...props}
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: props['data-row-key'] })}
        />
    );
});

function useWindowSize() {
    const [size, setSize] = useState([0, 0]);
    React.useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
        }
        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, []);
    return size;
}

export const AntDComponentTreeTable = <T,>(props: ComponentTreeTableProps<T>) => {
    const [showProgressBar, setShowProgressBar] = useState(false);
    const [dataSource, setDataSource] = useState<CDTTreeItem[]>(props.dataSource ?? []);
    const [width, height] = useWindowSize();

    useEffect(() => {
        if (!props.isLoading) {
            setShowProgressBar(false);
        } else {
            setShowProgressBar(true);
        }
    }, [props.isLoading]);

    if (dataSource === undefined) {
        return <div>
            <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
        </div>;
    }

    if (dataSource.length === 0) {
        return <div>No children provided</div>;
    }


    // ==== Renderers ====

    const renderStringColumn = (label: string, _record: CDTTreeItem, columnDef: CDTTreeTableStringColumn) => {
        let icon: React.ReactNode | undefined;

        if (columnDef.icon) {
            icon = <i className={classNames('cell-icon', columnDef.icon)}></i>;
        }

        let content = createHighlightedText(label, columnDef.highlight);
        if (columnDef.tooltip) {
            content = createLabelWithTooltip(<span>{content}</span>, columnDef.tooltip);
        }

        return <>
            {icon}
            {content}
        </>;
    };

    const renderActionColumn = (column: CDTTreeTableActionColumn | undefined, record: CDTTreeItem) => {
        const actions: React.ReactNode[] = [];

        if (record.pinnable) {
            if (record.pinned) {
                actions.push(<i
                    key={'unpin'}
                    className={'codicon codicon-pin'}
                    onClick={(event) => props.pin?.onPin?.(event, false, record)}></i>);
            } else {
                actions.push(<i
                    key={'pin'}
                    className={'codicon codicon-pinned'}
                    onClick={(event) => props.pin?.onPin?.(event, true, record)}></i>);
            }
        }

        return <div className="tree-actions">
            {...actions}
            {column?.commands?.map(a => <i
                key={a.commandId}
                className={`codicon codicon-${a.icon}`}
                onClick={(event) => props.action?.onAction?.(event, a, record)}></i>)}
        </div>;
    };


    // ==== Columns ====

    const createColumns = (columnDefinitions: CDTTreeTableColumnDefinition[]): TableColumnsType<CDTTreeItem> => {
        function stringColumn(def: CDTTreeTableColumnDefinition): ColumnType<CDTTreeItem> {
            return {
                title: def.field,
                dataIndex: ['columns', def.field, 'label'],
                width: 0,
                render: (label, record) => renderStringColumn(label, record, getNestedValue<CDTTreeTableStringColumn>(record, ['columns', def.field]))
            };
        }

        function actionColumn(def: CDTTreeTableColumnDefinition): ColumnType<CDTTreeItem> {
            return {
                title: def.field,
                dataIndex: ['columns', def.field],
                width: 64,
                render: renderActionColumn
            };
        }

        return [
            ...(columnDefinitions?.map(c => {
                if (c.type === 'string') {
                    return stringColumn(c);
                } else if (c.type === 'action') {
                    return actionColumn(c);
                }

                return {
                    title: c.field,
                    dataIndex: ['columns', c.field, 'label'],
                    width: 200
                };
            }) ?? [])
        ];
    };
    const [columns, setColumns] = useState<TableColumnsType<CDTTreeItem>>(createColumns(props.columnDefinitions ?? []));
    useEffect(() => {
        setColumns(createColumns(props.columnDefinitions ?? []));
    }, [props.columnDefinitions]);

    useEffect(() => {
        setDataSource((props.dataSource ?? []).sort(props.dataSourceComparer));
    }, [props.dataSource, props.pin?.pinnedRowKeys]);

    return <div>
        <div className='progress-bar-container'>
            {showProgressBar &&
                <ProgressBar mode="indeterminate" className='sticky top-0'></ProgressBar>
            }
        </div>
        <ConfigProvider
            theme={{
                cssVar: true,
                hashed: false
            }}
        >
            <Table<CDTTreeItem>
                columns={columns}
                dataSource={dataSource}
                components={{ body: { row: BodyRow } }}
                virtual
                scroll={{ x: width, y: height - 2 }}
                showHeader={false}
                pagination={false}
                onRow={(record) => {
                    return {
                        onClick: () => {
                            props.expansion?.onExpand?.(!props.expansion?.expandedRowKeys?.includes(record.id), record);
                        }
                    };
                }}
                expandable={{
                    expandIcon: ({ expanded, onExpand, record, expandable }) => {
                        if (!expandable) {
                            return;
                        }

                        return expanded ? (
                            <div
                                className={
                                    classNames('tree-toggler-container', 'codicon', 'codicon-chevron-down')
                                }
                                onClick={e => onExpand(record, e)}
                            >
                            </div>
                        ) : (
                            <div
                                className={
                                    classNames('tree-toggler-container', 'codicon', 'codicon-chevron-right')
                                }
                                onClick={e => onExpand(record, e)}
                            >
                            </div>);
                    },
                    showExpandColumn: true,
                    expandedRowKeys: props.expansion?.expandedRowKeys,
                    onExpand: (expanded, record) => {
                        props.expansion?.onExpand?.(expanded, record);
                    }
                }}
            />
        </ConfigProvider>
    </div>;
};
