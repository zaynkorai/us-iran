# Data and Memory Schemas

A framework requires a clean separation between short-term execution state and long-term evolutionary memory. To maintain portability and simplicity, the architecture relies on lightweight, local, embedded databases rather than external, heavy-duty servers.

## 1. Relational Logging (SQLite)

We use **SQLite** (or a simple ORM like SQLAlchemy configured for SQLite) as the definitive system of record. For it's zero configuration database that writes directly to a local file, making the framework trivially easy to deploy and share.

It tracks the lineage of every mutation, the exact configuration of every Actor, and the final scores awarded by the `Judge`.

### `Generations` Table

Tracks epochs of self-improvement.

* `id` (String UUID, Primary Key)
* `created_at` (Datetime)
* `status` (String: "active", "shadow_trial", "archived")
* `parent_generation_id` (String UUID, Foreign Key, Nullable — links to the generation this one evolved from)

### `AgentProfiles` Table

The definitive configurations deployed to an Actor.

* `id` (String UUID, Primary Key)
* `generation_id` (String UUID, Foreign Key → `Generations.id`)
* `archetype` (String: "primary_actor", "disruptor_info", "disruptor_tension", "created_agent")
* `system_prompt` (Text — the full Layer 1 + Layer 2 prompt)
* `hyperparameters` (JSON String — e.g., `{"temperature": 0.7, "frequency_penalty": 0.3}`)
* `expected_performance_baseline` (Float)
* `created_by` (String: "human", "mutator", "creator" — tracks the origin of this profile)

### `Episodes` Table

Records high-level outcomes for every completed simulation run.

* `id` (String UUID, Primary Key)
* `generation_id` (String UUID, Foreign Key → `Generations.id`)
* `agent_a_profile_id` (String UUID, Foreign Key → `AgentProfiles.id`)
* `agent_b_profile_id` (String UUID, Foreign Key → `AgentProfiles.id`)
* `agent_a_score` (Integer, -5 to +5)
* `agent_b_score` (Integer, -5 to +5)
* `total_turns` (Integer)
* `termination_reason` (String: "agreement", "abort_episode", "timeout", "corrupted")
* `final_state_snapshot` (JSON String — the complete `GenericStateObject` at termination)
* `is_shadow_trial` (Boolean)
* `created_at` (Datetime)

### `ActionLogs` Table

Records the turn-by-turn details for the `Mutator` to analyze later.

* `id` (String UUID, Primary Key)
* `episode_id` (String UUID, Foreign Key → `Episodes.id`)
* `turn_number` (Integer)
* `speaker_id` (String — matches `AgentProfiles.id`)
* `internal_monologue` (Text)
* `public_dialogue` (Text)
* `state_mutations` (JSON String — the proposed `StateMutation[]`)
* `propose_resolution` (Boolean)
* `abort_episode` (Boolean)
* `token_usage` (Integer — tokens consumed in this turn)

### `CreatedAgents` Table

Tracks every agent designed by the Provisioner Meta-Agent, including its survival status.

* `id` (String UUID, Primary Key)
* `creator_trigger_generation_id` (String UUID, Foreign Key → `Generations.id` — the generation that triggered the Provisioner)
* `agent_profile_id` (String UUID, Foreign Key → `AgentProfiles.id`)
* `archetype_designed` (String — e.g., "intermediary_broker", "validator", "proxy_actor")
* `design_rationale` (Text — the Provisioner's reasoning for this agent type)
* `shadow_trial_score_delta` (Float — improvement over the deadlocked baseline)
* `status` (String: "active", "terminated", "pending_approval")
* `created_at` (Datetime)

## 2. Vector Semantic Memory 

While SQLite tracks *what* happened, the Vector Database is used by the `Mutator` Meta-Agent to figure out why it happened, enabling mathematical similarity searches across datasets of past failures.

To keep the framework and free from API lock-in, we use serverless, embedded vector engines like ChromaDB or FAISS running locally.

### The Embedded Strategy Object

The Mutator embeds the combination of the generic `Configuration` and the `Outcome`. This allows it to search: *"Find me all situations across all past runs where we tried an aggressive opening on Resource X and it resulted in a abort_episode."*

**Embedded Metadata Schema (stored alongside the vector in ChromaDB):**

```json
{
  "episode_id": "ep_11203",
  "generation_id": "gen_42",
  "agent_archetype": "primary_actor",
  "tactical_classification": "aggressive_opening",
  "judge_score": -5,
  "termination_reason": "abort_episode",
  "created_agents_present": ["intermediary_broker_01"]
}
```

### The In-Memory Query Loop

When the Mutator triggers:

1. It queries the local SQLite DB for the failing `Episodes` in the current `Generation`.
2. It uses an embedding model (e.g., explicitly loaded local models via `SentenceTransformers` or a standard API call) to vectorize a summary of the failing tactic.
3. It queries the local ChromaDB collection: `collection.query(query_embeddings=[summary_vec], where={"judge_score": {"$lt": 0}})`
4. If local memory proves this is a recurring failure, the Mutator appends a strict constraint limiting the exploration of that dead evolutionary branch on the next generation.

## 3. Schema Versioning and Migration

The SQLite schema must evolve safely across framework versions. All migrations are managed via a `SchemaVersions` table.

### `SchemaVersions` Table

* `version` (Integer, Primary Key) — monotonically increasing schema version
* `applied_at` (Datetime) — when the migration was executed
* `description` (Text) — human-readable migration description

### Migration Strategy

1. **Forward-only**: Migrations are additive (`ALTER TABLE ADD COLUMN`, new tables). Destructive changes (`DROP COLUMN`) are prohibited in production.
2. **Startup check**: On boot, the `EnvironmentManager` compares the current `SchemaVersions.version` against the expected version. If behind, it runs pending migrations sequentially.
3. **Backup before migrate**: Before any migration, the framework copies the SQLite file to `{db_name}.backup.{timestamp}.sqlite`.

```typescript
const MIGRATIONS: Migration[] = [
  { version: 1, description: "Initial schema", up: CREATE_TABLES_SQL },
  { version: 2, description: "Add token_usage to ActionLogs", up: "ALTER TABLE ActionLogs ADD COLUMN token_usage INTEGER DEFAULT 0;" },
  { version: 3, description: "Add scout_hypotheses to Episodes", up: "ALTER TABLE Episodes ADD COLUMN scout_hypotheses TEXT;" },
];
```

## 4. Index Definitions

The following indexes are required for acceptable query performance as the dataset grows:

```sql
-- Generations: lookup by status for active/archived filtering
CREATE INDEX idx_generations_status ON Generations(status);

-- Episodes: the Mutator queries by generation + score
CREATE INDEX idx_episodes_generation_score ON Episodes(generation_id, agent_a_score);
CREATE INDEX idx_episodes_shadow ON Episodes(is_shadow_trial);

-- ActionLogs: sequential replay per episode
CREATE INDEX idx_actionlogs_episode_turn ON ActionLogs(episode_id, turn_number);

-- AgentProfiles: lookup by generation for lineage tracking
CREATE INDEX idx_agentprofiles_generation ON AgentProfiles(generation_id);

-- CreatedAgents: filter active agents for spawn-cap enforcement
CREATE INDEX idx_createdagents_status ON CreatedAgents(status);
```

## 5. Retention and Pruning Policy

Unbounded storage growth degrades both SQLite and ChromaDB performance. The framework enforces the following retention rules:

| Data Store                 | Retention Rule                                                                                                                                       | Pruning Trigger                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `Episodes` (SQLite)      | Keep all episodes from the last 20 generations. Archive older episodes to a cold `episodes_archive` table.                                         | End of each generation              |
| `ActionLogs` (SQLite)    | Keep full logs for the last 5 generations. For older generations, retain only episodes with `agent_a_score <= -3` (failure cases for the Mutator). | End of each generation              |
| `AgentProfiles` (SQLite) | Never delete — full lineage must be preserved.                                                                                                      | —                                  |
| Vector Memory (ChromaDB)   | Soft cap of 10,000 entries. When exceeded, delete entries with `judge_score == 0` (status quo outcomes that provide no learning signal).           | When `collection.count() > 10000` |

### Pruning Script

```typescript
async function pruneOldData(sqlDb: Database, vectorDb: VectorStore, currentGenId: string) {
  const cutoffGen = await sqlDb.query(
    "SELECT id FROM Generations ORDER BY created_at DESC LIMIT 1 OFFSET 20"
  );
  if (cutoffGen) {
    await sqlDb.execute(
      "INSERT INTO episodes_archive SELECT * FROM Episodes WHERE generation_id < ?", [cutoffGen.id]
    );
    await sqlDb.execute("DELETE FROM Episodes WHERE generation_id < ?", [cutoffGen.id]);
  }

  // Prune vector memory if over soft cap
  const count = await vectorDb.count();
  if (count > 10000) {
    await vectorDb.delete({ where: { judge_score: { $eq: 0 } } });
  }
}
```
