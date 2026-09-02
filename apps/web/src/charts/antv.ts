import { Chart } from "@antv/g2";

/**
 * Shared AntV entry point for upcoming reading analytics.
 * Keeping chart creation here gives future features the same theme/container
 * contract without coupling pages to a charting implementation.
 */
export function createBookKinChart(container: HTMLElement, options: Record<string, unknown> = {}) {
  return new Chart({
    container,
    autoFit: true,
    ...options,
  });
}
