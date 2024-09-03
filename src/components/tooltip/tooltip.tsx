/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import type { Placement } from '@floating-ui/react';
import {
    FloatingPortal,
    autoUpdate,
    offset,
    shift,
    useDismiss,
    useFloating,
    useFocus,
    useHover,
    useInteractions,
    useMergeRefs,
    useRole
} from '@floating-ui/react';
import * as React from 'react';

import './tooltip.css';

// https://floating-ui.com/docs/tooltip

interface TooltipOptions {
    initialOpen?: boolean;
    placement?: Placement;
    onOpenChange?: (open: boolean) => void;
}
type ContextType = ReturnType<typeof useTooltip> | null;
const TooltipContext = React.createContext<ContextType>(null);

function useTooltip({
    initialOpen = false,
    placement = 'bottom',
}: TooltipOptions = {}) {
    const [open, setOpen] = React.useState(initialOpen);

    const floating = useFloating({
        placement,
        open,
        transform: false,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(5),
            shift({ padding: 5 })
        ]
    });
    const context = floating.context;

    const hover = useHover(context, {
        move: false,
        restMs: 600,
        delay: {
            open: 1000
        }
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'tooltip' });

    const interactions = useInteractions([hover, focus, dismiss, role]);

    return React.useMemo(
        () => ({
            open,
            setOpen,
            ...interactions,
            ...floating
        }),
        [open, setOpen, interactions, floating]
    );
}

const useTooltipContext = () => {
    const context = React.useContext(TooltipContext);

    if (context == null) {
        throw new Error('Tooltip components must be wrapped in <Tooltip />');
    }

    return context;
};

export function Tooltip({
    children,
    ...options
}: { children: React.ReactNode } & TooltipOptions) {
    // This can accept any props as options, e.g. `placement`,
    // or other positioning options.
    const tooltip = useTooltip(options);
    return (
        <TooltipContext.Provider value={tooltip}>
            {children}
        </TooltipContext.Provider>
    );
}

export const TooltipTrigger = React.forwardRef<
    HTMLElement,
    React.HTMLProps<HTMLElement> & { asChild?: boolean }
>(function TooltipTrigger({ children, asChild = true, ...props }, propRef) {
    const context = useTooltipContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childrenRef = (children as any).ref;
    const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef]);

    // `asChild` allows the user to pass any element as the anchor
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(
            children,
            context.getReferenceProps({
                ref,
                ...props,
                ...children.props,
                'data-tooltip-state': context.open ? 'open' : 'closed'
            })
        );
    }

    return (
        <div
            ref={ref}
            data-tooltip-state={context.open ? 'open' : 'closed'}
            {...context.getReferenceProps(props)}
        >
            {children}
        </div>
    );
});

export const TooltipContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLProps<HTMLDivElement>
>(function TooltipContent({ style, ...props }, propRef) {
    const context = useTooltipContext();
    const ref = useMergeRefs([context.refs.setFloating, propRef]);

    if (!context.open) return null;

    return (
        <FloatingPortal>
            <div
                ref={ref}
                className='tooltip'
                style={{
                    ...context.floatingStyles,
                    ...style
                }}
            >
                <div className='tooltip-content' {...context.getFloatingProps(props)} />
            </div>
        </FloatingPortal>
    );
});
