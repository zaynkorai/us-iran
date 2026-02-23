/**
 * SQLite Memory Tests — Validate migration system, insert/query, and pruning.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteDatabase } from "../../memory/sqlite.js";

let db: SqliteDatabase;

beforeEach(() => {
    db = new SqliteDatabase(":memory:");
});

afterEach(() => {
    db.close();
});

describe("Schema Migrations", () => {
    it("creates all tables on init", () => {
        const tables = db.raw
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .all() as { name: string }[];
        const tableNames = tables.map((t) => t.name);

        expect(tableNames).toContain("Generations");
        expect(tableNames).toContain("AgentProfiles");
        expect(tableNames).toContain("Episodes");
        expect(tableNames).toContain("ActionLogs");
        expect(tableNames).toContain("CreatedAgents");
        expect(tableNames).toContain("SchemaVersions");
    });

    it("tracks schema version", () => {
        const version = db.raw
            .prepare("SELECT MAX(version) as v FROM SchemaVersions")
            .get() as { v: number };
        expect(version.v).toBe(1);
    });
});

describe("Insert and Query", () => {
    it("inserts and retrieves a generation", () => {
        const genId = db.insertGeneration();
        expect(genId).toBeTruthy();

        const row = db.raw
            .prepare("SELECT * FROM Generations WHERE id = ?")
            .get(genId) as { id: string; status: string };
        expect(row.status).toBe("active");
    });

    it("inserts and retrieves an agent profile", () => {
        const genId = db.insertGeneration();
        const profileId = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "You are Agent Alpha.",
            hyperparameters: { temperature: 0.7 },
            createdBy: "human",
        });

        const row = db.raw
            .prepare("SELECT * FROM AgentProfiles WHERE id = ?")
            .get(profileId) as { archetype: string; created_by: string };
        expect(row.archetype).toBe("primary_actor");
        expect(row.created_by).toBe("human");
    });

    it("inserts and retrieves an episode", () => {
        const genId = db.insertGeneration();
        const pA = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "Agent A",
        });
        const pB = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "Agent B",
        });

        const epId = db.insertEpisode({
            generationId: genId,
            agentAProfileId: pA,
            agentBProfileId: pB,
            agentAScore: 3,
            agentBScore: -1,
            totalTurns: 12,
            terminationReason: "agreement",
        });

        const row = db.raw
            .prepare("SELECT * FROM Episodes WHERE id = ?")
            .get(epId) as { agent_a_score: number; termination_reason: string };
        expect(row.agent_a_score).toBe(3);
        expect(row.termination_reason).toBe("agreement");
    });

    it("inserts and retrieves action logs", () => {
        const genId = db.insertGeneration();
        const pA = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "A",
        });
        const pB = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "B",
        });
        const epId = db.insertEpisode({
            generationId: genId,
            agentAProfileId: pA,
            agentBProfileId: pB,
            agentAScore: 0,
            agentBScore: 0,
            totalTurns: 1,
            terminationReason: "timeout",
        });

        db.insertActionLog({
            episodeId: epId,
            turnNumber: 0,
            speakerId: "agent_a",
            internalMonologue: "Testing",
            publicDialogue: "Hello",
            stateMutations: [{ action: "modify", path: "x", value: 1 }],
            tokenUsage: 150,
        });

        const log = db.raw
            .prepare("SELECT * FROM ActionLogs WHERE episode_id = ?")
            .get(epId) as { speaker_id: string; token_usage: number };
        expect(log.speaker_id).toBe("agent_a");
        expect(log.token_usage).toBe(150);
    });

    it("queries failing episodes by percentile", () => {
        const genId = db.insertGeneration();
        const pA = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "A",
        });
        const pB = db.insertAgentProfile({
            generationId: genId,
            archetype: "primary_actor",
            systemPrompt: "B",
        });

        // Insert 10 episodes with varying scores
        for (let i = 0; i < 10; i++) {
            db.insertEpisode({
                generationId: genId,
                agentAProfileId: pA,
                agentBProfileId: pB,
                agentAScore: i - 5,
                agentBScore: 0,
                totalTurns: 10,
                terminationReason: "timeout",
            });
        }

        const failing = db.getFailingEpisodes(genId, 0.2);
        expect(failing.length).toBe(2); // worst 20% of 10
    });
});
