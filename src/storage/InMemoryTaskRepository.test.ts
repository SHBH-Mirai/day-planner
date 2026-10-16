import { InMemoryTaskRepository } from './InMemoryTaskRepository'
import { runRepositoryContract } from './repositoryContract'

runRepositoryContract('InMemoryTaskRepository', () => new InMemoryTaskRepository())
