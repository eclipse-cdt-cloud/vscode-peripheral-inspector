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

    const ref = React.useRef<HTMLDivElement | null>(null);

    const pinnedRowKeys = useMemo(() => {
        return props.pin?.pinnedRowKeys ?? [];
    }, [props.pin?.pinnedRowKeys]);

    useEffect(() => {
        setDataSource((props.dataSource ?? []).sort(props.dataSourceComparer));
    }, [props.dataSource, props.pin?.pinnedRowKeys]);

    // ==== Expansion ====

    const expandedRowKeys = useMemo(() => {
        return props.expansion?.expandedRowKeys ?? [];
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

    // ==== Selection ====

    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

    const selectRow = useCallback((record: CDTTreeItem) => {
        // Single select only
        if (selectedRowKeys.indexOf(record.key) != 0) {
            setSelectedRowKeys([record.key]);
        }
    }, [selectedRowKeys]);

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

        traverse(dataSource ?? []);
        return {
            rowIndex,
            keyIndex
        };
    }, [dataSource, expandedRowKeys, pinnedRowKeys]);

    useEffect(() => {
        if (!ref.current) {
            return;
        }

        // The selected row may be removed from the DOM
        // We need to focus the table in this case
        const observer = new MutationObserver(() => {
            const selectedRow = document.querySelector<HTMLElement>('.ant-table-row-selected');
            // Focus the table if the selected row is not in the DOM
            if (!selectedRow) {
                ref.current?.focus();
            } else if (selectedRow !== document.activeElement) {
                // Focus the selected row if it is in the DOM and not focused
                selectedRow?.focus();
            }
        });

        observer.observe(ref.current as Node, {
            childList: true,
            subtree: true
        });

        const abortScrollOnLeave = () => {
            const elements = document.getElementsByClassName('ant-table-tbody-virtual-scrollbar-thumb-moving');
            if (elements.length > 0) {
                // simulate mouse up to stop scrolling
                window.dispatchEvent(new MouseEvent('mouseup'));
            }
        };
        document.addEventListener('mouseleave', abortScrollOnLeave);

        return () => {
            document.removeEventListener('mouseleave', abortScrollOnLeave);
            observer.disconnect();
        };
    }, [ref, selectedRowKeys]);

    const navigator = React.useMemo(() => new TreeNavigator({
        ref,
        rowIndex: dataSourceIndex.rowIndex,
        expandedRowKeys,
        selectedRowKeys,
        expand: handleExpand,
        select: selectRow
    }), [ref, dataSourceIndex, expandedRowKeys, selectedRowKeys, handleExpand, selectRow]);

    const handleRowClick = useCallback(
        (record: CDTTreeItem, event: React.MouseEvent<HTMLElement>) => {
            const isExpanded = props.expansion?.expandedRowKeys?.includes(record.id);
            handleExpand(!isExpanded, record);
            selectRow(record);

            event.currentTarget.focus();
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
            <div ref={ref}
                tabIndex={-1}
                style={{ outline: 'none' }}
                onKeyDown={(event) => {
                    const selectedKey = selectedRowKeys[0];
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
                    rowClassName={(record) => classNames({ 'ant-table-row-selected': selectedRowKeys.includes(record.key) })}
                    onRow={(record) => ({
                        onClick: (event) => handleRowClick(record, event),
                    })}
                    expandable={{
                        expandIcon: expandIcon,
                        showExpandColumn: true,
                        expandedRowKeys: expandedRowKeys,
                        onExpand: handleExpand
                    }}
                />
            </div>
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

interface TreeNavigatorProps {
    ref: React.RefObject<HTMLDivElement>;
    rowIndex: Map<string, number>;
    expandedRowKeys: string[];
    selectedRowKeys: string[];
    expand: (expanded: boolean, record: CDTTreeItem) => void;
    select: (record: CDTTreeItem) => void;
}

/**
 * TreeNavigator is a helper class to navigate
 * through a tree table.
 */
class TreeNavigator {
    constructor(
        private readonly props: TreeNavigatorProps
    ) {
    }

    next(node: CDTTreeItem) {
        if (node.children && node.children.length > 0 && this.props.expandedRowKeys.includes(node.id)) {
            // Go deeper
            this.select(node.children[0]);
        } else {
            let nextNode = this.getNext(node);
            if (nextNode) {
                this.select(nextNode);
            } else {
                // Go to parent sibling recursively
                nextNode = this.getParentNext(node.parent);
                if (nextNode) {
                    this.select(nextNode);
                }
            }
        }
    }

    nextPage() {
        this.scrollRelative(this.visibleDomElementCount);
    }

    private getSiblings(node: CDTTreeItem): CDTTreeItem[] {
        return node.parent?.children ?? [];
    }

    private getNext(node: CDTTreeItem): CDTTreeItem | undefined {
        const siblings = this.getSiblings(node);
        const index = siblings.indexOf(node);
        return siblings[index + 1];
    }

    private getParentNext(node: CDTTreeItem | undefined): CDTTreeItem | undefined {
        if (!node) return undefined;
        const nextSibling = this.getNext(node);
        if (nextSibling) {
            return nextSibling;
        } else {
            return this.getParentNext(node.parent);
        }
    }

    previous(node: CDTTreeItem) {
        let prevNode = this.getPrevious(node);
        if (prevNode) {
            // Go deeper to the last child if the previous node has children and is expanded
            while (prevNode.children && prevNode.children.length > 0 && this.props.expandedRowKeys.includes(prevNode.id)) {
                prevNode = prevNode.children[prevNode.children.length - 1];
            }
            this.select(prevNode);
        } else {
            const parent = node.parent;
            // Go to parent if no previous sibling
            if (parent && !CDTTreeItem.isRoot(parent)) {
                this.select(parent);
            }
        }
    }

    previousPage() {
        this.scrollRelative(-(this.visibleDomElementCount - 1));
    }

    private getPrevious(node: CDTTreeItem): CDTTreeItem | undefined {
        const siblings = this.getSiblings(node);
        const index = siblings.indexOf(node);
        return siblings[index - 1];
    }

    toggle(node: CDTTreeItem) {
        if (this.props.expandedRowKeys.includes(node.id)) {
            this.collapse(node);
        } else {
            this.expand(node);
        }
    }

    expand(node: CDTTreeItem) {
        if (node.children && node.children.length > 0) {
            if (this.props.expandedRowKeys.includes(node.id)) {
                this.next(node);
            } else {
                this.props.expand(true, node);
            }
        }
    }

    collapse(node: CDTTreeItem) {
        if (node.children && node.children.length > 0 && this.props.expandedRowKeys.includes(node.id)) {
            this.props.expand(false, node);
        } else if (node.parent && !CDTTreeItem.isRoot(node.parent)) {
            this.select(node.parent, 'absolute');
        }
    }

    private select(node: CDTTreeItem, scrollMode: 'relative' | 'absolute' = 'absolute') {
        // Virtual scrolling may have hidden the node
        if (!this.isDomVisible(node)) {
            if (scrollMode === 'absolute') {
                this.scrollAbsolute(node);
                this.props.select(node);
            } else {
                this.scrollRelative(-(this.visibleDomElementCount / 2));
            }

            this.props.select(node);
            // Allow the DOM to update before focusing
            setTimeout(() => this.getDomElement(node)?.focus(), 100);
        } else {
            this.props.select(node);
            this.getDomElement(node)?.focus();
        }

        this.getDomElement(node)?.addEventListener;
    }

    // ==== DOM ====

    private scrollRelative(count = this.visibleDomElementCount) {
        const rowHeight = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-row')?.clientHeight ?? 22;
        const body = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-tbody-virtual-holder');
        if (body) {
            body.scrollTop = Math.max(body.scrollTop + count * rowHeight, 0);
        }
    }

    private scrollAbsolute(node: CDTTreeItem) {
        const rowHeight = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-row')?.clientHeight ?? 22;
        const body = this.props.ref.current?.querySelector<HTMLDivElement>('.ant-table-tbody-virtual-holder');
        if (body) {
            const index = this.props.rowIndex.get(node.id) ?? 1;
            body.scrollTop = Math.max(index * rowHeight, 0);
        }
    }

    private getDomElement(record: CDTTreeItem) {
        return this.props.ref.current?.querySelector<HTMLDivElement>(`[data-row-key="${record.key}"]`);
    }

    private isDomVisible(record: CDTTreeItem) {
        return !!this.getDomElement(record);
    }

    private get visibleDomElementCount() {
        return this.props.ref.current?.querySelectorAll<HTMLDivElement>('.ant-table-row').length ?? 1;
    }
}
