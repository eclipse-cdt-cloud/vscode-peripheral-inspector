/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

export interface TreeNotificationContext {
    /**
     * If true or undefined, the tree will be resynced.
     */
    resync?: boolean;
}

export interface TreeNotification<T> {
    context?: TreeNotificationContext;
    data: T;
}

export interface TreeTerminatedEvent<T> {
    /**
     * The number of remaining trees.
     */
    remaining: number;
    data: T;
}
