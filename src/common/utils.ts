/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

/**
 * Finds a nested value from an object using a dot-separated path.
 */
export function findNestedValue<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj: Record<string, any>,
    path: string | string[],
): T | undefined {
    const keys = Array.isArray(path) ? path : path.split('.');
    return keys.reduce((acc, key) => acc?.[key], obj) as T | undefined;
}

/**
 * Check if an object has a property.
 */
export function hasProperty<TKey extends object>(object: object, ...keys: (keyof TKey)[]): object is TKey {
    return keys.every(key => key in object);
}

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
export type MaybePromise<T> = T | Promise<T>
