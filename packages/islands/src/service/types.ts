/**
 * Service Types
 *
 * Shared type definitions for service module.
 * This file must not import any server-only dependencies.
 */

/**
 * Service descriptor returned by defineService
 *
 * Contains the extend function and provides type inference
 * for downstream helpers like createIsland and createConnect.
 *
 * The extend function accepts `unknown` to allow both server and client
 * base services (which have compatible shapes but different types).
 */
export interface ServiceDescriptor<TService> {
  /**
   * The extend function that transforms base service into user's service
   * Called at instantiation time (per-request on server, once on client)
   *
   * Accepts unknown because server (linkedom) and client (DOM) base services
   * have compatible shapes but TypeScript sees them as different types.
   */
  extend: (base: unknown) => TService;
}
