/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CDTTreeItem } from '../types';

export interface TreeConverterContext<TResource = unknown> {
    expandedKeys: string[],
    pinnedKeys: string[]
    resourceMap: Map<string, TResource>
}

export interface TreeResourceConverter<TResource = unknown, TContextResource = TResource> {
    canHandle(resource: TResource): boolean;

    convert(resource: TResource, context: TreeConverterContext<TContextResource>): CDTTreeItem<TResource>;
}

export interface TreeResourceListConverter<TResource = unknown, TContextResource = TResource> extends TreeResourceConverter<TResource, TContextResource> {
    convertList(resource: TResource[], context: TreeConverterContext<TContextResource>): CDTTreeItem<TResource>[];
}
