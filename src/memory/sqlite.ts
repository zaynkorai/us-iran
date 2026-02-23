/**
 * SQLite Database — Relational logging and lineage tracking.
 *
 * Uses better-sqlite3 for zero-config, embedded, synchronous SQLite.
 * Manages schema migrations, all 5 tables, and retention policies.
 *
 * @see docs/data_and_memory_schemas.md — Full schema definitions
 */
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

/** Schema migration definition. */
export interface Migration {
    version: number;
    description: string;
    up: string;
}

/**
 * Initial schema: all tables + indexes from docs/data_and_memory_schemas.md
 */
const INITIAL_SCHEMA = `
-- Generations table: tracks epochs of self-improvement
CREATE TABLE IF NOT EXISTS Generations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  parent_generation_id TEXT,
  FOREIGN KEY (parent_generation_id) REFERENCES Generations(id)
);

-- AgentProfiles table: definitive configurations deployed to actors
CREATE TABLE IF NOT EXISTS AgentProfiles (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  archetype TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  hyperparameters TEXT NOT NULL DEFAULT '{}',
  expected_performance_baseline REAL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'human',
  FOREIGN KEY (generation_id) REFERENCES Generations(id)
);

-- Episodes table: high-level outcomes for every simulation run
CREATE TABLE IF NOT EXISTS Episodes (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  agent_a_profile_id TEXT NOT NULL,
  agent_b_profile_id TEXT NOT NULL,
  agent_a_score INTEGER NOT NULL,
  agent_b_score INTEGER NOT NULL,
  total_turns INTEGER NOT NULL,
  termination_reason TEXT NOT NULL,
  final_state_snapshot TEXT NOT NULL DEFAULT '{}',
  is_shadow_trial INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (generation_id) REFERENCES Generations(id),
  FOREIGN KEY (agent_a_profile_id) REFERENCES AgentProfiles(id),
  FOREIGN KEY (agent_b_profile_id) REFERENCES AgentProfiles(id)
);

-- ActionLogs table: turn-by-turn details
CREATE TABLE IF NOT EXISTS ActionLogs (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  speaker_id TEXT NOT NULL,
  internal_monologue TEXT,
  public_dialogue TEXT,
  state_mutations TEXT NOT NULL DEFAULT '[]',
  propose_resolution INTEGER NOT NULL DEFAULT 0,
  abort_episode INTEGER NOT NULL DEFAULT 0,
  token_usage INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (episode_id) REFERENCES Episodes(id)
);

-- CreatedAgents table: Provisioner-designed agents
CREATE TABLE IF NOT EXISTS CreatedAgents (
  id TEXT PRIMARY KEY,
  creator_trigger_generation_id TEXT NOT NULL,
  agent_profile_id TEXT NOT NULL,
  archetype_designed TEXT NOT NULL,
  design_rationale TEXT,
  shadow_trial_score_delta REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creator_trigger_generation_id) REFERENCES Generations(id),
  FOREIGN KEY (agent_profile_id) REFERENCES AgentProfiles(id)
);

-- SchemaVersions table: migration tracking
CREATE TABLE IF NOT EXISTS SchemaVersions (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT NOT NULL
);

-- Indexes (docs/data_and_memory_schemas.md §4)
CREATE INDEX IF NOT EXISTS idx_generations_status ON Generations(status);
CREATE INDEX IF NOT EXISTS idx_episodes_generation_score ON Episodes(generation_id, agent_a_score);
CREATE INDEX IF NOT EXISTS idx_episodes_shadow ON Episodes(is_shadow_trial);
CREATE INDEX IF NOT EXISTS idx_actionlogs_episode_turn ON ActionLogs(episode_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_agentprofiles_generation ON AgentProfiles(generation_id);
CREATE INDEX IF NOT EXISTS idx_createdagents_status ON CreatedAgents(status);

-- Archive table for pruning
CREATE TABLE IF NOT EXISTS episodes_archive AS SELECT * FROM Episodes WHERE 0;
`;

/**
 * Forward-only migrations.
 * @see docs/data_and_memory_schemas.md §3 — Schema Versioning and Migration
 */
const MIGRATIONS: Migration[] = [
    { version: 1, description: "Initial schema", up: INITIAL_SCHEMA },
];

export class SqliteDatabase {
    private db: Database.Database;

    constructor(dbPath: string = ":memory:") {
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.runMigrations();
    }

    /**
     * Run pending migrations.
     * Forward-only, with version tracking.
     * @see docs/data_and_memory_schemas.md §3 — Startup check
     */
    private runMigrations(): void {
        // Ensure SchemaVersions table exists first
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS SchemaVersions (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now')),
        description TEXT NOT NULL
      );
    `);

        const currentVersion = this.db
            .prepare("SELECT MAX(version) as v FROM SchemaVersions")
            .get() as { v: number | null };
        const version = currentVersion?.v ?? 0;

        for (const migration of MIGRATIONS) {
            if (migration.version > version) {
                this.db.exec(migration.up);
                this.db
                    .prepare("INSERT INTO SchemaVersions (version, description) VALUES (?, ?)")
                    .run(migration.version, migration.description);
            }
        }
    }

    // --- Insert methods ---

    insertGeneration(parentId?: string): string {
        const id = uuidv4();
        this.db
            .prepare("INSERT INTO Generations (id, parent_generation_id) VALUES (?, ?)")
            .run(id, parentId ?? null);
        return id;
    }

    insertAgentProfile(params: {
        generationId: string;
        archetype: string;
        systemPrompt: string;
        hyperparameters?: object;
        expectedPerformanceBaseline?: number;
        createdBy?: string;
    }): string {
        const id = uuidv4();
        this.db
            .prepare(
                `INSERT INTO AgentProfiles (id, generation_id, archetype, system_prompt, hyperparameters, expected_performance_baseline, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                id,
                params.generationId,
                params.archetype,
                params.systemPrompt,
                JSON.stringify(params.hyperparameters ?? {}),
                params.expectedPerformanceBaseline ?? 0,
                params.createdBy ?? "human",
            );
        return id;
    }

    insertEpisode(params: {
        generationId: string;
        agentAProfileId: string;
        agentBProfileId: string;
        agentAScore: number;
        agentBScore: number;
        totalTurns: number;
        terminationReason: string;
        finalStateSnapshot?: object;
        isShadowTrial?: boolean;
    }): string {
        const id = uuidv4();
        this.db
            .prepare(
                `INSERT INTO Episodes (id, generation_id, agent_a_profile_id, agent_b_profile_id, agent_a_score, agent_b_score, total_turns, termination_reason, final_state_snapshot, is_shadow_trial)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                id,
                params.generationId,
                params.agentAProfileId,
                params.agentBProfileId,
                params.agentAScore,
                params.agentBScore,
                params.totalTurns,
                params.terminationReason,
                JSON.stringify(params.finalStateSnapshot ?? {}),
                params.isShadowTrial ? 1 : 0,
            );
        return id;
    }

    insertActionLog(params: {
        episodeId: string;
        turnNumber: number;
        speakerId: string;
        internalMonologue?: string;
        publicDialogue?: string;
        stateMutations?: object[];
        proposeResolution?: boolean;
        abortEpisode?: boolean;
        tokenUsage?: number;
    }): string {
        const id = uuidv4();
        this.db
            .prepare(
                `INSERT INTO ActionLogs (id, episode_id, turn_number, speaker_id, internal_monologue, public_dialogue, state_mutations, propose_resolution, abort_episode, token_usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                id,
                params.episodeId,
                params.turnNumber,
                params.speakerId,
                params.internalMonologue ?? null,
                params.publicDialogue ?? null,
                JSON.stringify(params.stateMutations ?? []),
                params.proposeResolution ? 1 : 0,
                params.abortEpisode ? 1 : 0,
                params.tokenUsage ?? 0,
            );
        return id;
    }

    insertCreatedAgent(params: {
        triggerGenerationId: string;
        agentProfileId: string;
        archetypeDesigned: string;
        designRationale?: string;
        shadowTrialScoreDelta?: number;
        status?: string;
    }): string {
        const id = uuidv4();
        this.db
            .prepare(
                `INSERT INTO CreatedAgents (id, creator_trigger_generation_id, agent_profile_id, archetype_designed, design_rationale, shadow_trial_score_delta, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                id,
                params.triggerGenerationId,
                params.agentProfileId,
                params.archetypeDesigned,
                params.designRationale ?? null,
                params.shadowTrialScoreDelta ?? 0,
                params.status ?? "pending_approval",
            );
        return id;
    }

    // --- Query methods ---

    getFailingEpisodes(generationId: string, percentile: number = 0.2): object[] {
        const all = this.db
            .prepare(
                "SELECT * FROM Episodes WHERE generation_id = ? AND is_shadow_trial = 0 ORDER BY agent_a_score ASC",
            )
            .all(generationId) as object[];
        const cutoff = Math.ceil(all.length * percentile);
        return all.slice(0, cutoff);
    }

    getActiveCreatedAgents(): object[] {
        return this.db
            .prepare("SELECT * FROM CreatedAgents WHERE status = 'active'")
            .all() as object[];
    }

    getGenerationEpisodes(generationId: string): object[] {
        return this.db
            .prepare("SELECT * FROM Episodes WHERE generation_id = ?")
            .all(generationId) as object[];
    }

    /**
     * Prune old data per retention policy.
     * @see docs/data_and_memory_schemas.md §5 — Retention and Pruning Policy
     */
    pruneOldData(): void {
        // Archive episodes older than 20 generations
        const cutoffGen = this.db
            .prepare("SELECT id FROM Generations ORDER BY created_at DESC LIMIT 1 OFFSET 20")
            .get() as { id: string } | undefined;

        if (cutoffGen) {
            this.db.exec(
                `INSERT INTO episodes_archive SELECT * FROM Episodes WHERE generation_id < '${cutoffGen.id}'`,
            );
            this.db.exec(
                `DELETE FROM Episodes WHERE generation_id < '${cutoffGen.id}'`,
            );
        }
    }

    /** Close the database connection. */
    close(): void {
        this.db.close();
    }

    /** Expose raw db for advanced queries in tests. */
    get raw(): Database.Database {
        return this.db;
    }
}
