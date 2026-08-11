import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { DashboardStats, ErrorResponse, GetAnalyticsRangeParams, HealthStatus, ListOrdersParams, Order, OrderInput, OrderStatusInput, OrderUpdate, PaymentInput, RangeAnalytics } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListOrdersUrl: (params?: ListOrdersParams) => string;
/**
 * List orders filtered by status, date range, or search query
 * @summary List orders
 */
export declare const listOrders: (params?: ListOrdersParams, options?: RequestInit) => Promise<Order[]>;
export declare const getListOrdersQueryKey: (params?: ListOrdersParams) => readonly ["/api/orders", ...ListOrdersParams[]];
export declare const getListOrdersQueryOptions: <TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(params?: ListOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListOrdersQueryResult = NonNullable<Awaited<ReturnType<typeof listOrders>>>;
export type ListOrdersQueryError = ErrorType<unknown>;
/**
 * @summary List orders
 */
export declare function useListOrders<TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(params?: ListOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateOrderUrl: () => string;
/**
 * @summary Create a new order
 */
export declare const createOrder: (orderInput: OrderInput, options?: RequestInit) => Promise<Order>;
export declare const getCreateOrderMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<OrderInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<OrderInput>;
}, TContext>;
export type CreateOrderMutationResult = NonNullable<Awaited<ReturnType<typeof createOrder>>>;
export type CreateOrderMutationBody = BodyType<OrderInput>;
export type CreateOrderMutationError = ErrorType<ErrorResponse>;
/**
* @summary Create a new order
*/
export declare const useCreateOrder: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<OrderInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<OrderInput>;
}, TContext>;
export declare const getGetOrderUrl: (id: number) => string;
/**
 * @summary Get order by ID
 */
export declare const getOrder: (id: number, options?: RequestInit) => Promise<Order>;
export declare const getGetOrderQueryKey: (id: number) => readonly [`/api/orders/${number}`];
export declare const getGetOrderQueryOptions: <TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOrderQueryResult = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
export type GetOrderQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get order by ID
 */
export declare function useGetOrder<TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateOrderUrl: (id: number) => string;
/**
 * @summary Update an order
 */
export declare const updateOrder: (id: number, orderUpdate: OrderUpdate, options?: RequestInit) => Promise<Order>;
export declare const getUpdateOrderMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrder>>, TError, {
        id: number;
        data: BodyType<OrderUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOrder>>, TError, {
    id: number;
    data: BodyType<OrderUpdate>;
}, TContext>;
export type UpdateOrderMutationResult = NonNullable<Awaited<ReturnType<typeof updateOrder>>>;
export type UpdateOrderMutationBody = BodyType<OrderUpdate>;
export type UpdateOrderMutationError = ErrorType<ErrorResponse>;
/**
* @summary Update an order
*/
export declare const useUpdateOrder: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrder>>, TError, {
        id: number;
        data: BodyType<OrderUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOrder>>, TError, {
    id: number;
    data: BodyType<OrderUpdate>;
}, TContext>;
export declare const getUpdateOrderStatusUrl: (id: number) => string;
/**
 * @summary Update order status
 */
export declare const updateOrderStatus: (id: number, orderStatusInput: OrderStatusInput, options?: RequestInit) => Promise<Order>;
export declare const getUpdateOrderStatusMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: number;
        data: BodyType<OrderStatusInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: number;
    data: BodyType<OrderStatusInput>;
}, TContext>;
export type UpdateOrderStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateOrderStatus>>>;
export type UpdateOrderStatusMutationBody = BodyType<OrderStatusInput>;
export type UpdateOrderStatusMutationError = ErrorType<ErrorResponse>;
/**
* @summary Update order status
*/
export declare const useUpdateOrderStatus: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: number;
        data: BodyType<OrderStatusInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: number;
    data: BodyType<OrderStatusInput>;
}, TContext>;
export declare const getCollectPaymentUrl: (id: number) => string;
/**
 * @summary Collect additional payment for an order
 */
export declare const collectPayment: (id: number, paymentInput: PaymentInput, options?: RequestInit) => Promise<Order>;
export declare const getCollectPaymentMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof collectPayment>>, TError, {
        id: number;
        data: BodyType<PaymentInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof collectPayment>>, TError, {
    id: number;
    data: BodyType<PaymentInput>;
}, TContext>;
export type CollectPaymentMutationResult = NonNullable<Awaited<ReturnType<typeof collectPayment>>>;
export type CollectPaymentMutationBody = BodyType<PaymentInput>;
export type CollectPaymentMutationError = ErrorType<ErrorResponse>;
/**
* @summary Collect additional payment for an order
*/
export declare const useCollectPayment: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof collectPayment>>, TError, {
        id: number;
        data: BodyType<PaymentInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof collectPayment>>, TError, {
    id: number;
    data: BodyType<PaymentInput>;
}, TContext>;
export declare const getGetTodayAnalyticsUrl: () => string;
/**
 * @summary Get today's analytics dashboard data
 */
export declare const getTodayAnalytics: (options?: RequestInit) => Promise<DashboardStats>;
export declare const getGetTodayAnalyticsQueryKey: () => readonly ["/api/analytics/today"];
export declare const getGetTodayAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getTodayAnalytics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTodayAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTodayAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTodayAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getTodayAnalytics>>>;
export type GetTodayAnalyticsQueryError = ErrorType<unknown>;
/**
 * @summary Get today's analytics dashboard data
 */
export declare function useGetTodayAnalytics<TData = Awaited<ReturnType<typeof getTodayAnalytics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTodayAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAnalyticsRangeUrl: (params?: GetAnalyticsRangeParams) => string;
/**
 * @summary Get analytics for a date range
 */
export declare const getAnalyticsRange: (params?: GetAnalyticsRangeParams, options?: RequestInit) => Promise<RangeAnalytics>;
export declare const getGetAnalyticsRangeQueryKey: (params?: GetAnalyticsRangeParams) => readonly ["/api/analytics/range", ...GetAnalyticsRangeParams[]];
export declare const getGetAnalyticsRangeQueryOptions: <TData = Awaited<ReturnType<typeof getAnalyticsRange>>, TError = ErrorType<unknown>>(params?: GetAnalyticsRangeParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsRange>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsRange>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalyticsRangeQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalyticsRange>>>;
export type GetAnalyticsRangeQueryError = ErrorType<unknown>;
/**
 * @summary Get analytics for a date range
 */
export declare function useGetAnalyticsRange<TData = Awaited<ReturnType<typeof getAnalyticsRange>>, TError = ErrorType<unknown>>(params?: GetAnalyticsRangeParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsRange>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map