import type {
  AnalysisEventDto,
  AnalysisProgress,
  RepositoryHistoryResponse,
  RepositoryIdentifier
} from "@repopulse/shared";
import {
  AnalysisReportRepository,
  AnalysisRunRepository,
  DatabaseUnavailableError,
  RepositoryRepository
} from "@repopulse/database";

interface PersistentAnalysisRepositories {
  repository: RepositoryRepository;
  run: AnalysisRunRepository;
  report: AnalysisReportRepository;
}

export class PersistentAnalysisService {
  private repositories?: PersistentAnalysisRepositories;

  constructor(repositories?: PersistentAnalysisRepositories) {
    this.repositories = repositories;
  }

  private getRepositories(): PersistentAnalysisRepositories {
    try {
      this.repositories ??= {
        repository: new RepositoryRepository(),
        run: new AnalysisRunRepository(),
        report: new AnalysisReportRepository()
      };
      return this.repositories;
    } catch {
      throw new DatabaseUnavailableError();
    }
  }

  async createAnalysis(
    repository: RepositoryIdentifier,
    forceRefresh = false
  ): Promise<AnalysisProgress> {
    const repositories = this.getRepositories();
    const repositoryRecord = await repositories.repository.upsertRepository(repository);

    if (!forceRefresh) {
      const cachedReport = await repositories.report.findReusableReport(repositoryRecord.id);

      if (cachedReport) {
        const run = await repositories.run.createCompletedFromCache(
          repositoryRecord.id,
          cachedReport.id
        );
        const progress = await repositories.run.toProgress(run.id);

        if (progress) {
          return progress;
        }
      }
    }

    const run = await repositories.run.createPending({
      repositoryId: repositoryRecord.id,
      forceRefresh
    });
    const progress = await repositories.run.toProgress(run.id);

    if (!progress) {
      throw new Error("Analysis task could not be created.");
    }

    return progress;
  }

  async getAnalysis(analysisId: string): Promise<AnalysisProgress | null> {
    return this.getRepositories().run.toProgress(analysisId);
  }

  async getEvents(analysisId: string): Promise<AnalysisEventDto[]> {
    return this.getRepositories().run.getEvents(analysisId);
  }

  async listHistory(
    repository: RepositoryIdentifier,
    limit: number,
    cursor?: string
  ): Promise<RepositoryHistoryResponse | null> {
    const repositories = this.getRepositories();
    const repositoryRecord = await repositories.repository.findByOwnerRepo(
      repository.owner,
      repository.repo
    );

    if (!repositoryRecord) {
      return null;
    }

    const history = await repositories.report.listHistory(repositoryRecord.id, limit, cursor);

    return {
      repository,
      items: history.items,
      nextCursor: history.nextCursor
    };
  }

  async getHistoricalReport(repository: RepositoryIdentifier, analysisId: string) {
    return this.getRepositories().report.getHistoricalReport(repository, analysisId);
  }
}
