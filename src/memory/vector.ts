/**
 * Vector Memory — Semantic similarity search for the Mutator.
 *
 * Wraps ChromaDB for embedded vector storage.
 * Stores strategy/outcome pairs so the Mutator can query for
 * recurring failure patterns.
 *
 * @see docs/data_and_memory_schemas.md §2 — Vector Semantic Memory
 */
import { ChromaClient, type Collection } from "chromadb";

/** Metadata schema stored alongside vectors in ChromaDB. */
export interface VectorMetadata {
    episode_id?: string;
    generation_id?: string;
    agent_archetype?: string;
    tactical_classification?: string;
    judge_score?: number;
    termination_reason?: string;
    [key: string]: unknown;
}

export class VectorMemory {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private collectionName: string;

    constructor(collectionName: string = "sisc_semantic_memory", client?: ChromaClient) {
        this.client = client ?? new ChromaClient();
        this.collectionName = collectionName;
    }

    /** Initialize or get the collection. Must be called before other methods. */
    async init(): Promise<void> {
        this.collection = await this.client.getOrCreateCollection({
            name: this.collectionName,
        });
    }

    private ensureCollection(): Collection {
        if (!this.collection) {
            throw new Error("VectorMemory not initialized. Call init() first.");
        }
        return this.collection;
    }

    /**
     * Add a strategy/outcome entry to vector memory.
     * @see docs/data_and_memory_schemas.md §2 — The Embedded Strategy Object
     */
    async add(params: {
        id: string;
        document: string;
        metadata: VectorMetadata;
    }): Promise<void> {
        const collection = this.ensureCollection();
        await collection.add({
            ids: [params.id],
            documents: [params.document],
            metadatas: [params.metadata as Record<string, string | number | boolean>],
        });
    }

    /**
     * Query for similar strategies/outcomes.
     * @see docs/data_and_memory_schemas.md §2 — The In-Memory Query Loop
     */
    async query(params: {
        queryText: string;
        nResults?: number;
        where?: Record<string, unknown>;
    }): Promise<{
        ids: string[][];
        documents: (string | null)[][];
        metadatas: (Record<string, unknown> | null)[][];
    }> {
        const collection = this.ensureCollection();
        const results = await collection.query({
            queryTexts: [params.queryText],
            nResults: params.nResults ?? 5,
            ...(params.where ? { where: params.where as Record<string, string | number | boolean> } : {}),
        });
        return {
            ids: results.ids,
            documents: results.documents,
            metadatas: results.metadatas,
        };
    }

    /**
     * Get the count of entries in the collection.
     */
    async count(): Promise<number> {
        const collection = this.ensureCollection();
        return await collection.count();
    }

    /**
     * Prune entries over the soft cap.
     * Removes status-quo entries (judge_score == 0) that provide no learning signal.
     * @see docs/data_and_memory_schemas.md §5 — Retention Policy (Vector Memory)
     */
    async prune(softCap: number = 10000): Promise<void> {
        const count = await this.count();
        if (count > softCap) {
            const collection = this.ensureCollection();
            // Delete status-quo outcomes that provide no learning signal
            await collection.delete({
                where: { judge_score: 0 },
            });
        }
    }
}
