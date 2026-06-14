import { AnalysisRunRepository } from "@repopulse/database";

export class Heartbeat {
  private timer: NodeJS.Timeout | null = null;
  private readonly runRepository = new AnalysisRunRepository();

  constructor(
    private readonly analysisId: string,
    private readonly intervalMs: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      void this.runRepository.updateHeartbeat(this.analysisId, this.now());
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
