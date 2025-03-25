/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import './common.css';
import './treetable.css';

import { ConfigProvider, Table } from 'antd';
import { ColumnType, ExpandableConfig } from 'antd/es/table/interface';
import { Resizable } from 're-resizable';
import { default as React, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { debounce } from 'throttle-debounce';
import { CommandDefinition, findNestedValue } from '../../../common';
import { Commands } from '../../../manifest';
import { CDTTreeItem, CDTTreeItemResource, CDTTreeTableActionColumn, CDTTreeTableActionColumnCommand, CDTTreeTableColumnDefinition, CDTTreeTableStringColumn, CTDTreeWebviewContext } from '../types';
import ActionCell from './cells/ActionCell';
import StringCell from './cells/StringCell';
import { ExpandIcon } from './expand-icon';
import { SearchOverlay } from './search-overlay';
import { TreeNavigator } from './treetable-navigator';
import { classNames, filterTree, getAncestors, traverseTree, useClickHook } from './utils';

const COLUMN_MIN_WIDTH = 50;
const ACTION_COLUMN_WIDTH = 16 * 5;

/**
 * Component to render a tree table.
 */
export type ComponentTreeTableProps<T extends CDTTreeItemResource = CDTTreeItemResource> = {
    /**
     * Information about the columns to be rendered.
     */
    columnDefinitions?: CDTTreeTableColumnDefinition[];
    /**
     * Data source to be rendered.
     */
    dataSource?: CDTTreeItem<T>[];
    /**
    * Function to sort the data source.
    */
    dataSourceSorter?: (dataSource: CDTTreeItem<T>[]) => CDTTreeItem<T>[];
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
        onExpand?: ExpandableConfig<CDTTreeItem<T>>['onExpand'];
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
        onPin?: (event: React.UIEvent, pinned: boolean, record: CDTTreeItem<T>) => void;
    },
    /**
     * Configuration for the actions of the tree table.
     */
    action?: {
        /**
         * Callback to be called when an action is triggered.
         */
        onAction?: (event: React.UIEvent, command: CommandDefinition, value: unknown, record: CDTTreeItem<T>) => void;
    },
    edit?: {
        /**
         * Callback to be called when a row is edited.
         */
        onEdit?: (record: CDTTreeItem<T>, value: string) => void;
    }
};

interface ResizeableCell {
    resizeable?: boolean;
    maxWidth?: number;
    onDidColumnResize?: (event: MouseEvent | TouchEvent, width: number) => void;
}

interface BodyRowProps extends React.HTMLAttributes<HTMLDivElement> {
    'data-row-key': string;
    record: CDTTreeItem<CDTTreeItemResource>;
}

const BodyRow = React.forwardRef<HTMLDivElement, BodyRowProps>((props, ref) => {
    // Support VSCode context menu items
    return (
        <div
            ref={ref}
            data-test
            tabIndex={0}
            key={props['data-row-key']}
            {...props}
            {...CTDTreeWebviewContext.create({ webviewSection: 'tree-item', cdtTreeItemId: props['data-row-key'], cdtTreeItemType: props.record.resource.__type })}
        />
    );
});


interface BodyCellProps extends React.HTMLAttributes<HTMLDivElement>, ResizeableCell {
}

const BodyCell = React.forwardRef<HTMLDivElement, BodyCellProps>((props, ref) => {
    const { resizeable, onDidColumnResize, maxWidth, className, onResize, style, ...rest } = props;
    const [width, setWidth] = useState<string | number | undefined>(props.style?.width);

    useEffect(() => {
        if (resizeable) {
            setWidth(props.style?.width);
        }
    }, [props.style?.width]);

    const cell = <div
        ref={ref}
        style={{ minWidth: '50px', ...style }}
        {...rest}
        className={className}
        onResize={onResize}
    />;

    if (!resizeable) {
        return cell;
    }

    return (
        <Resizable
            minWidth={50}
            maxWidth={maxWidth}
            className={classNames('ant-table-cell-resizable', className ?? '')}
            size={{
                width,
            }}
            onResizeStart={(_event, _direction, ref) => {
                const row = ref.closest('.ant-table-row');
                row?.classList.add('ant-table-row-resizing');
            }}
            onResize={(event, _direction, ref, _delta) => {
                onDidColumnResize?.(event, ref.clientWidth);

            }}
            onResizeStop={(event, _direction, ref, _delta) => {
                onDidColumnResize?.(event, ref.clientWidth);
                const row = ref.closest('.ant-table-row');
                row?.classList.remove('ant-table-row-resizing');
            }}
            handleClasses={{
                right: 'resizable-handle',
            }}
            enable={{
                bottom: false,
                bottomLeft: false,
                bottomRight: false,
                left: false,
                right: true,
                top: false,
                topLeft: false,
                topRight: false
            }}
            {...rest}
        >
        </Resizable>
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

export const AntDComponentTreeTable = <T extends CDTTreeItemResource,>(props: ComponentTreeTableProps<T>) => {
    const { width, height } = useWindowSize();
    const [globalSearchText, setGlobalSearchText] = useState<string | undefined>();
    const globalSearchRef = React.useRef<SearchOverlay>(null);
    const autoSelectRowRef = React.useRef<boolean>(false);

    const ref = React.useRef<HTMLDivElement | null>(null);
    const tblRef: Parameters<typeof Table>[0]['ref'] = React.useRef(null);

    // ==== Data ====

    const filteredData = useMemo(() => {
        let data = props.dataSource ?? [];
        if (globalSearchText) {
            data = filterTree(data, globalSearchText);
        }
        if (props.dataSourceSorter) {
            data = props.dataSourceSorter([...data]);
        }
        return data;
    }, [props.dataSource, props.dataSourceSorter, globalSearchText]);

    // ==== Search ====

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            globalSearchRef.current?.show();
        }
    }, []);

    const onSearchShow = useCallback(() => setGlobalSearchText(globalSearchRef.current?.value()), []);
    const onSearchHide = useCallback(() => {
        setGlobalSearchText(undefined);
        autoSelectRowRef.current = true;
    }, [autoSelectRowRef]);
    const onSearchChange = useMemo(() => debounce(300, (text: string) => setGlobalSearchText(text)), []);

    // ==== Selection ====

    const [selection, setSelection] = useState<CDTTreeItem>();

    const selectRow = useCallback((record: CDTTreeItem) => {
        // Single select only
        if (selection?.key !== record.key) {
            setSelection(record);
        }
    }, [selection]);

    // ==== Expansion ====

    const expandedRowKeys = useMemo(() => {
        const expanded = new Set(props.expansion?.expandedRowKeys ?? []);
        if (globalSearchText) {
            // on search expand all nodes that match the search
            const matchingExpansion = traverseTree(filteredData, { predicate: item => item.matching ?? false, mapper: getAncestors });
            matchingExpansion.forEach(ancestorHierarchy => ancestorHierarchy.forEach(ancestor => expanded.add(ancestor.key)));
        } else {
            // otherwise use the expandedRowKeys from the props but ensure that the selected element is also expanded
            if (autoSelectRowRef.current && selection) {
                getAncestors(selection).forEach(ancestor => expanded.add(ancestor.key));
            }
        }
        return Array.from(expanded);
    }, [filteredData, globalSearchText, props.expansion?.expandedRowKeys, selection, autoSelectRowRef.current]);


    const handleExpand = useCallback(
        (expanded: boolean, record: CDTTreeItem<T>) => {
            props.expansion?.onExpand?.(expanded, record);
        },
        [props.expansion?.onExpand]
    );

    // ==== Edit ====
    const [editRowKey, setEditRowKey] = useState<string | undefined>();

    // ==== Index ====

    const dataSourceIndex = useMemo(() => {
        const rowIndex = new Map<string, number>();
        const keyIndex = new Map<string, CDTTreeItem>();

        let currentIndex = 0;

        const traverse = (nodes: CDTTreeItem[]) => {
            nodes.forEach(node => {
                rowIndex.set(node.id, currentIndex++);
                keyIndex.set(node.key, node);

                if (node.children && node.children.length > 0 && expandedRowKeys.includes(node.id)) {
                    traverse(node.children);
                }
            });
        };

        traverse(filteredData ?? []);
        return {
            rowIndex,
            keyIndex
        };
    }, [filteredData, expandedRowKeys]);

    // ==== Navigation ====

    const navigator = React.useMemo(() => new TreeNavigator({
        ref,
        rowIndex: dataSourceIndex.rowIndex,
        expandedRowKeys,
        expand: handleExpand,
        select: selectRow
    }), [ref, dataSourceIndex.rowIndex, expandedRowKeys, handleExpand, selectRow]);

    const onTableKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        const selectedKey = selection?.key;
        if (!selectedKey) {
            return;
        }

        const record = dataSourceIndex.keyIndex.get(selectedKey);
        if (!record) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown': {
                navigator.next(record);
                break;
            }
            case 'ArrowUp': {
                navigator.previous(record);
                break;
            }
            case 'ArrowLeft': {
                navigator.collapse(record);
                break;
            }
            case 'ArrowRight': {
                navigator.expand(record);
                break;
            }
            case 'Enter': {
                navigator.toggle(record);
                break;
            }
            case ' ': {
                navigator.toggle(record);
                break;
            }
            case 'PageUp': {
                navigator.previousPage();
                break;
            }
            case 'PageDown': {
                navigator.nextPage();
                break;
            }
        }
    }, [selection, dataSourceIndex]);


    // ==== Columns ====
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [prevWindowWidth, setPrevWindowWidth] = useState(width);
    const availableWidth = useMemo(() => width - ACTION_COLUMN_WIDTH - COLUMN_MIN_WIDTH * (props.columnDefinitions?.filter(c => c.resizable).length ?? 0), [width, props.columnDefinitions]);

    const handleResize =
        (field: string) =>
            (_: MouseEvent | TouchEvent, width: number) => {
                console.log('handleResize', field, width);
                setColumnWidths((prev) => ({ ...prev, [field]: width }));
            };

    useEffect(() => {
        const delta = width - prevWindowWidth;
        if (delta < 0) {
            // Shrink columns that are too wide
            setColumnWidths((prev) => {
                const newWidths = { ...prev };
                for (const key in newWidths) {
                    const currentWidth = newWidths[key];
                    if (currentWidth > availableWidth) {
                        newWidths[key] = Math.max(currentWidth + delta, COLUMN_MIN_WIDTH);
                    }
                }
                return newWidths;
            });
        }
        setPrevWindowWidth(width);
    }, [width]);

    const getActions = useCallback((record: CDTTreeItem<T>, column: CDTTreeTableActionColumn) => {
        const actions: CDTTreeTableActionColumnCommand[] = [];
        if (record.pinned !== undefined) {
            actions.push({
                commandId: record.pinned ? Commands.UNPIN_COMMAND.commandId : Commands.PIN_COMMAND.commandId,
                title: record.pinned ? 'Unpin row' : 'Pin row',
                icon: record.pinned ? 'pin' : 'pinned',
                value: !record.pinned,
            });
        }
        actions.push(...column.commands);
        return actions;
    }, []);

    const onAction = useCallback((event: React.UIEvent, command: CommandDefinition, value: unknown, record: CDTTreeItem<T>) => {
        if (command.commandId === Commands.PIN_COMMAND.commandId || command.commandId === Commands.UNPIN_COMMAND.commandId) {
            event.stopPropagation();
            return props.pin?.onPin?.(event, !record.pinned, record);
        }
        if (command.commandId === Commands.UPDATE_NODE_COMMAND.commandId) {
            selectRow(record);
            return setEditRowKey(record.key);
        }
        return props.action?.onAction?.(event, command, value, record);
    }, [props.action, props.pin?.onPin]);

    const renderActionCell = useCallback((column: CDTTreeTableActionColumn | undefined, record: CDTTreeItem<T>) => {
        if (!column) {
            return undefined;
        }

        return <ActionCell column={column} record={record} actions={getActions(record, column)} onAction={onAction} />;
    }, [props.pin, props.action]);

    const onSubmitEdit = useCallback((record: CDTTreeItem<T>, value: string) => {
        setEditRowKey(undefined);
        props.edit?.onEdit?.(record, value);
    }, [props.edit?.onEdit]);

    const onSubmitCancel = useCallback(() => {
        setEditRowKey(undefined);
    }, []);

    const onEdit = useCallback((record: CDTTreeItem<T>, edit: boolean) => {
        if (edit) {
            selectRow(record);
            setEditRowKey(record.key);
        } else {
            setEditRowKey(undefined);
        }
    }, []);

    const isEditing = useCallback((column: CDTTreeTableStringColumn, record: CDTTreeItem<T>) => editRowKey === record.key || column.edit?.type === 'boolean' || column.edit?.type === 'enum', [editRowKey]);

    const renderStringCell = useCallback((column: CDTTreeTableStringColumn | undefined, record: CDTTreeItem<T>) => {
        if (!column) {
            return undefined;
        }

        return (<StringCell column={column} record={record} onSubmit={onSubmitEdit} onCancel={onSubmitCancel} onEdit={onEdit} editing={isEditing(column, record)} autoFocus={column.edit?.type === 'text'} />);
    }, [editRowKey]);

    const columns = useMemo(() => {
        return props.columnDefinitions?.map<ColumnType<CDTTreeItem<T>>>(colDef => {
            const resizeable: ResizeableCell = {
                resizeable: colDef.resizable,
                maxWidth: availableWidth,
                onDidColumnResize: handleResize(colDef.field)
            };

            if (colDef.type === 'string') {
                return {
                    title: colDef.field,
                    dataIndex: ['columns', colDef.field],
                    width: columnWidths[colDef.field] ?? 0,
                    ellipsis: true,
                    render: renderStringCell,
                    className: colDef.field,
                    onCell: (record) => {
                        const column = findNestedValue<CDTTreeTableStringColumn>(record, ['columns', colDef.field]);

                        return !column || !column.colSpan
                            ? {
                                ...resizeable,
                            } as React.HTMLAttributes<unknown> & React.TdHTMLAttributes<unknown>
                            : {
                                ...resizeable,
                                colSpan: column.colSpan === 'fill' ? props.columnDefinitions?.length : column.colSpan,
                                style: { zIndex: 1 }
                            };
                    }
                };
            }
            if (colDef.type === 'action') {
                return {
                    title: colDef.field,
                    dataIndex: ['columns', colDef.field],
                    width: ACTION_COLUMN_WIDTH,
                    render: renderActionCell,
                };
            }
            return {
                ...resizeable,
                title: colDef.field,
                dataIndex: ['columns', colDef.field, 'label'],
                width: 200,
            };
        }) ?? [];
    }, [props.columnDefinitions, columnWidths, renderStringCell, renderActionCell]);

    // ==== Handlers ====

    // Ensure that even if we lose the active element through scrolling or other means, we can still navigate by restoring the focus
    useEffect(() => {
        if (!ref.current) {
            return;
        }

        const observer = new MutationObserver(() => {
            if (document.activeElement === globalSearchRef.current?.input()) {
                // do not steal focus from the search input
                return;
            }
            const selectedRow = document.querySelector<HTMLElement>('.ant-table-row-selected');
            if (!selectedRow) {
                // Selected row was removed from the DOM, focus on the table
                ref.current?.focus();
            } else if (selectedRow !== document.activeElement && !selectedRow.contains(document.activeElement)) {
                // Selected row is still in the DOM, but not focused
                selectedRow?.focus();
            }
        });

        observer.observe(ref.current, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [ref.current]);

    // Abort scrolling when mouse drag was finished (e.g., left mouse button is no longer pressed) outside the iframe
    useEffect(() => {
        const abortScroll = (event: MouseEvent) => {
            if (!(event.buttons & 1)) {
                // left button is no longer pressed...
                const elements = document.getElementsByClassName('ant-table-tbody-virtual-scrollbar-thumb-moving');
                if (elements.length > 0) {
                    // ...but we are still scrolling the thumb (left button was released outside iframe) -> abort scrolling
                    window.dispatchEvent(new MouseEvent('mouseup'));
                }
            }
        };
        document.addEventListener('mouseenter', abortScroll);
        return () => document.removeEventListener('mouseenter', abortScroll);
    }, []);

    // Scroll to selected row if autoSelectRowRef is set
    useEffect(() => {
        if (autoSelectRowRef.current && selection) {
            tblRef.current?.scrollTo({ key: selection.key });
            autoSelectRowRef.current = false;
        }
    }, [autoSelectRowRef.current]);

    const onRowSingleClick = useCallback(
        (_event: React.MouseEvent<HTMLElement>, record: CDTTreeItem<T>) => {
            const isExpanded = expandedRowKeys?.includes(record.id);
            handleExpand(!isExpanded, record);
            selectRow(record);
        },
        [props.expansion?.expandedRowKeys]
    );

    const onRowClick = useClickHook<HTMLElement>({
        onSingleClick: onRowSingleClick,
        delay: 10 // We don't have a double click event for now
    });

    // ==== Return ====

    return <div id='tree-table-root' onKeyDown={onKeyDown}>
        <SearchOverlay key={'search'} ref={globalSearchRef} onHide={onSearchHide} onShow={onSearchShow} onChange={onSearchChange} />
        <ConfigProvider
            theme={{
                cssVar: true,
                hashed: false
            }}
            renderEmpty={() => <div className={'empty-message'}>No data available.</div>}
        >
            <div ref={ref}
                tabIndex={-1}
                style={{ outline: 'none' }}
                onKeyDown={onTableKeyDown}
            >
                <Table<CDTTreeItem<T>>
                    ref={tblRef}
                    columns={columns}
                    dataSource={filteredData}
                    components={{ body: { row: BodyRow, cell: BodyCell } }}
                    virtual
                    scroll={{ x: width, y: height - 2 }}
                    showHeader={false}
                    pagination={false}
                    rowClassName={(record) => classNames({ 'ant-table-row-selected': record.key === selection?.key, 'ant-table-row-matched': record.matching ?? false })}
                    onRow={(record) => ({
                        record,
                        onClick: (event) => onRowClick(event, record)
                    })}
                    expandable={{
                        expandIcon: props => <ExpandIcon {...props} />,
                        showExpandColumn: true,
                        expandedRowKeys: expandedRowKeys,
                        onExpand: handleExpand
                    }}
                />
            </div>
        </ConfigProvider>
    </div>;
};
