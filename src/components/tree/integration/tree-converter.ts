/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CDTTreeItem } from '../types';

/**
 * A TreeConverterContext is used to pass additional information to the TreeResourceConverter.
 * It contains the expanded keys, pinned keys and a resource map.
 * It will be propagated to all TreeResourceConverters.
 */
export interface TreeConverterContext<TResource = unknown> {
    parent?: CDTTreeItem<unknown>,
    /**
     * The expanded keys of the tree. This is used to determine if a node should be expanded or not.
     */
    expandedKeys: string[],
    /**
     * The pinned keys of the tree. This is used to determine if a node should be pinned or not.
     */
    pinnedKeys: string[]
    /**
     * A map of all resources that are currently in the tree.
     * This can be useful to access parent resources.
     * It is filled while converting the tree.
     */
    resourceMap: Map<string, TResource>
}

/**
 * A TreeResourceConverter is responsible for converting a resource into a CDTTreeItem.
 */
export interface TreeResourceConverter<TResource = unknown, TContextResource = TResource> {
    canHandle(resource: TResource): boolean;

    convert(resource: TResource, context: TreeConverterContext<TContextResource>): CDTTreeItem<TResource>;
}
