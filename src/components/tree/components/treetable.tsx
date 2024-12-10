/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './common.css';
import './treetable.css';

import { ConfigProvider, Table, TableColumnsType } from 'antd';
import { ColumnType, ExpandableConfig } from 'antd/es/table/interface';
import { default as React, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { CommandDefinition } from '../../../common';
import { getNestedValue } from '../../../common/utils';
import { CDTTreeItem, CDTTreeTableActionColumn, CDTTreeTableColumnDefinition, CDTTreeTableStringColumn, CTDTreeWebviewContext } from '../types';
import { classNames, createHighlightedText, createLabelWithTooltip } from './utils';
import { debounce } from 'throttle-debounce';
/**
 * Component to render a tree table.
 */
export type ComponentTreeTableProps<T = unknown> = {
    /**
     * Information about the columns to be rendered.
     */
    columnDefinitions?: CDTTreeTableColumnDefinition[];
    /**
     * Data source to be rendered.
     */
    dataSource?: CDTTreeItem<T>[];
    /**
     * Function to sort the root elements of the data source.
     */
    dataSourceComparer?: (a: CDTTreeItem<T>, b: CDTTreeItem<T>) => number;
    /**
     * Configuration for the expansion of the tree table.
     */
    expansion?: {
        /**
         * List of expanded row keys.
         */
        expandedRowKeys?: string[];
        /**
         * Callback to be called when a row is expanded or collapsed.
         */
        onExpand?: ExpandableConfig<CDTTreeItem<unknown>>['onExpand'];
    },
    /**
     * Configuration for the pinning of the tree table.
     */
    pin?: {
        /**
         * List of pinned row keys.
         */
        pinnedRowKeys?: string[];
        /**
         * Callback to be called when a row is pinned or unpinned.
         */
        onPin?: (event: React.UIEvent, pinned: boolean, record: CDTTreeItem<unknown>) => void;
    }
    /**
     * Configuration for the actions of the tree table.
     */
    action?: {
        /**
         * Callback to be called when an action is triggered.
         */
        onAction?: (event: React.UIEvent, command: CommandDefinition, value: unknown, record: CDTTreeItem<unknown>) => void;
    }
};

interface BodyRowProps extends React.HTMLAttributes<HTMLDivElement> {
    'data-row-key': string;
}

const BodyRow = React.forwardRef<HTMLDivElement, BodyRowProps>((props, ref) => {
    // Support VSCode context menu items
    return (
        <div
            ref={ref}
            tabIndex={0}
            key={props['data-row-key']}
            {...props}
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: props['data-row-key'] })}
        />
    );
});

function useWindowSize() {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    useLayoutEffect(() => {
        const updateSize = debounce(100, () => {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        });

        window.addEventListener('resize', updateSize);
        return () => {
            window.removeEventListener('resize', updateSize);
            updateSize.cancel();
        };
    }, []);

    return size;
}

export const AntDComponentTreeTable = <T,>(props: ComponentTreeTableProps<T>) => {
    const { width, height } = useWindowSize();
    const [dataSource, setDataSource] = useState<CDTTreeItem[]>(props.dataSource ?? []);

    useEffect(() => {
        setDataSource((props.dataSource ?? []).sort(props.dataSourceComparer));
    }, [props.dataSource, props.pin?.pinnedRowKeys]);

    // ==== Expansion ====

    const expandedRowKeys = useMemo(() => {
        return props.expansion?.expandedRowKeys;
    }, [props.expansion?.expandedRowKeys]);


    const expandIcon = useCallback(
        ({ expanded, onExpand, record, expandable }: RenderExpandIconProps<CDTTreeItem>) => {
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
        },
        []
    );

    const handleExpand = useCallback(
        (expanded: boolean, record: CDTTreeItem) => {
            props.expansion?.onExpand?.(expanded, record);
        },
        [props.expansion]
    );

    // ==== Renderers ====

    const renderStringColumn = useCallback(
        (label: string, item: CDTTreeItem<unknown>, columnDef: CDTTreeTableStringColumn) => {
            const icon = columnDef.icon ? <i className={classNames('cell-icon', columnDef.icon)}></i> : null;
            let content = createHighlightedText(label, columnDef.highlight);

            if (columnDef.tooltip) {
                content = createLabelWithTooltip(<span>{content}</span>, columnDef.tooltip);
            }

            return (
                <div className='tree-cell ant-table-cell-ellipsis' tabIndex={0}>
                    {icon}
                    {content}
                </div>
            );
        },
        []
    );

    const renderActionColumn = useCallback(
        (column: CDTTreeTableActionColumn | undefined, record: CDTTreeItem<unknown>) => {
            const actions: React.ReactNode[] = [];

            if (record.pinned !== undefined) {
                actions.push(
                    <i
                        key={record.pinned ? 'unpin' : 'pin'}
                        title={record.pinned ? 'Unpin row' : 'Pin row'}
                        className={`codicon ${record.pinned ? 'codicon-pin' : 'codicon-pinned'}`}
                        onClick={(event) => props.pin?.onPin?.(event, !record.pinned, record)}
                        aria-label={record.pinned ? 'Unpin row' : 'Pin row'}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === 'Enter') props.pin?.onPin?.(event, !record.pinned, record); }}
                    ></i>
                );
            }

            if (column?.commands) {
                column.commands.forEach((command) => {
                    actions.push(
                        <i
                            key={command.commandId}
                            title={command.title}
                            className={`codicon codicon-${command.icon}`}
                            onClick={(event) => props.action?.onAction?.(event, command, command.value, record)}
                            aria-label={command.title}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === 'Enter') props.action?.onAction?.(event, command, command.value, record); }}
                        ></i>
                    );
                });
            }

            return <div className={'tree-actions'}>{actions}</div>;
        },
        [props.pin, props.action]
    );

    // ==== Columns ====

    const createColumns = (columnDefinitions: CDTTreeTableColumnDefinition[]): TableColumnsType<CDTTreeItem> => {
        function stringColumn(def: CDTTreeTableColumnDefinition): ColumnType<CDTTreeItem> {
            return {
                title: def.field,
                dataIndex: ['columns', def.field, 'label'],
                width: 0,
                ellipsis: true,
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

    const columns = useMemo(() => createColumns(props.columnDefinitions ?? []), [props.columnDefinitions]);

    // ==== Handlers ====

    const handleRowClick = useCallback(
        (record: CDTTreeItem) => () => {
            const isExpanded = props.expansion?.expandedRowKeys?.includes(record.id);
            props.expansion?.onExpand?.(!isExpanded, record);
        },
        [props.expansion]
    );

    // ==== Return ====

    return <div>
        <ConfigProvider
            theme={{
                cssVar: true,
                hashed: false
            }}
            renderEmpty={() => <div className={'empty-message'}>No data available.</div>}
        >
            <Table<CDTTreeItem>
                columns={columns}
                dataSource={dataSource}
                components={{ body: { row: BodyRow } }}
                virtual
                scroll={{ x: width, y: height - 2 }}
                showHeader={false}
                pagination={false}
                onRow={(record) => ({
                    onClick: handleRowClick(record)
                })}
                expandable={{
                    expandIcon: expandIcon,
                    showExpandColumn: true,
                    expandedRowKeys: expandedRowKeys,
                    onExpand: handleExpand
                }}
            />
        </ConfigProvider>
    </div>;
};

interface RenderExpandIconProps<RecordType> {
    prefixCls: string;
    expanded: boolean;
    record: RecordType;
    expandable: boolean;
    onExpand: TriggerEventHandler<RecordType>;
}

export type TriggerEventHandler<RecordType> = (record: RecordType, event: React.MouseEvent<HTMLElement>) => void;
