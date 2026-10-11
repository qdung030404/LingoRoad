import { Injectable, Logger } from '@nestjs/common';
import {
  CatCandidate,
  CatHistoryEntry,
  CatSelectResponse,
} from '../interfaces/ml-client.interface';

@Injectable()
export class InProcessCatFallback {
  private readonly logger = new Logger(InProcessCatFallback.name);
  private readonly grid: number[];
  private readonly prior: number[];

  constructor() {
    // 161 quadrature points from -4.0 to +4.0 (step 0.05)
    this.grid = [];
    this.prior = [];
    const steps = 160;
    const min = -4.0;
    const max = 4.0;
    const stepSize = (max - min) / steps;

    for (let i = 0; i <= steps; i++) {
      const point = min + i * stepSize;
      this.grid.push(point);
      // N(0, 1) prior: exp(-0.5 * theta^2)
      this.prior.push(Math.exp(-0.5 * point * point));
    }
  }

  /**
   * 3PL IRT probability: P(theta) = c + (1 - c) / (1 + exp(-a * (theta - b)))
   */
  private prob3pl(theta: number, a: number, b: number, c: number): number {
    return c + (1.0 - c) / (1.0 + Math.exp(-a * (theta - b)));
  }

  /**
   * Fisher Information for 3PL IRT
   */
  private information(
    theta: number,
    a: number,
    b: number,
    c: number,
  ): number {
    const p = this.prob3pl(theta, a, b, c);
    const q = 1.0 - p;
    if (p <= 0 || q <= 0) return 0.0;
    const term = (p - c) / (1.0 - c);
    return a * a * term * term * (q / p);
  }

  /**
   * EAP (Expected A Posteriori) theta and standard error estimation
   */
  public estimateEap(history: CatHistoryEntry[]): { theta: number; se: number } {
    let likelihood = new Array(this.grid.length).fill(1.0);

    for (const h of history) {
      for (let i = 0; i < this.grid.length; i++) {
        const p = this.prob3pl(this.grid[i], h.a, h.b, h.c);
        likelihood[i] *= h.correct ? p : 1.0 - p;
      }
    }

    let posterior = likelihood.map((l, i) => l * this.prior[i]);
    const totalPosterior = posterior.reduce((sum, val) => sum + val, 0);

    if (totalPosterior > 0) {
      posterior = posterior.map((p) => p / totalPosterior);
    } else {
      // Fallback uniform if underflow
      posterior = new Array(this.grid.length).fill(1.0 / this.grid.length);
    }

    const theta = posterior.reduce(
      (sum, p, i) => sum + this.grid[i] * p,
      0,
    );
    const variance = posterior.reduce(
      (sum, p, i) => sum + Math.pow(this.grid[i] - theta, 2) * p,
      0,
    );
    const se = Math.sqrt(Math.max(variance, 0.001));

    return {
      theta: Math.round(theta * 1000) / 1000,
      se: Math.round(se * 1000) / 1000,
    };
  }

  /**
   * Maximum Fisher Information Item Selection
   */
  public selectNext(
    theta: number,
    candidates: CatCandidate[],
  ): string | null {
    if (!candidates || candidates.length === 0) return null;

    let maxInfo = -Infinity;
    let selectedId: string | null = null;

    for (const cand of candidates) {
      const info = this.information(theta, cand.a, cand.b, cand.c);
      if (info > maxInfo) {
        maxInfo = info;
        selectedId = cand.item_id;
      }
    }

    return selectedId;
  }

  /**
   * Complete In-process fallback execution
   */
  public select(
    history: CatHistoryEntry[],
    candidates: CatCandidate[],
  ): CatSelectResponse {
    this.logger.debug(
      `Executing in-process CAT EAP computation for ${history.length} answers and ${candidates.length} candidates`,
    );
    const { theta, se } = this.estimateEap(history);
    const next_item_id = this.selectNext(theta, candidates);
    return { theta, se, next_item_id };
  }
}
