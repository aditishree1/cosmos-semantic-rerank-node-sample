/**
 * Standalone demo: Cosmos DB FTS query + Semantic Rerank
 *
 * Prerequisites:
 *   - Database "rerank-test" with container "products" (partition key: /category)
 *     already exists on the Cosmos DB account.
 *   - Inference endpoint registered for the account.
 *   - AZURE_COSMOS_SEMANTIC_RERANKER_INFERENCE_ENDPOINT env var set to the inference endpoint.
 *   - AZURE_TENANT_ID set if your Cosmos DB account is in a non-default tenant.
 *
 * Usage:
 *   npm start
 */

import { CosmosClient, type SemanticRerankResult } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const ACCOUNT_ENDPOINT = "https://<your-account>.documents.azure.com:443/";
const DATABASE_NAME = "<your-database>";
const CONTAINER_NAME = "<your-container>";

interface SampleItem {
  id: string;
  category: string;
  name: string;
  description: string;
}

const sampleItems: SampleItem[] = [
  {
    id: "sr-1",
    category: "fitness",
    name: "ProFit Power Tower",
    description:
      "Professional power tower with integrated pull-up bar, dip station, and vertical knee raise. Heavy-duty steel frame supports up to 300 lbs.",
  },
  {
    id: "sr-2",
    category: "fitness",
    name: "FlexForce Cable Machine",
    description:
      "Compact cable crossover machine with multiple pulley adjustments. Features 200 lb weight stack and smooth motion guide rods.",
  },
  {
    id: "sr-3",
    category: "fitness",
    name: "IronGrip Adjustable Dumbbells",
    description:
      "Quick-change adjustable dumbbell set ranging from 5 to 52.5 lbs per hand. Replaces 15 sets of weights. Space-saving design.",
  },
  {
    id: "sr-4",
    category: "fitness",
    name: "EnduraRun Treadmill",
    description:
      "Folding treadmill with cushioned running deck and 12 incline levels. Built-in heart rate monitor. Supports speeds up to 12 mph.",
  },
  {
    id: "sr-5",
    category: "fitness",
    name: "BudgetFlex Home Gym",
    description:
      "Most economical home gym system with integrated pull-up bar and multiple pulley adjustments. Affordable yet sturdy construction ideal for home gyms.",
  },
];

async function main(): Promise<void> {
  console.log("=== Cosmos DB Semantic Rerank Demo ===\n");

  // 1. Create client
  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({
    endpoint: ACCOUNT_ENDPOINT,
    aadCredentials: credential,
  });

  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  try {
    // 2. Upsert sample documents
    console.log("Upserting sample documents...");
    for (const item of sampleItems) {
      await container.items.upsert(item);
    }
    console.log(`  ✓ Upserted ${sampleItems.length} items\n`);

    // 3. Wait for FTS index to catch up
    console.log("Waiting 10s for FTS index propagation...");
    await new Promise<void>((r) => setTimeout(r, 10_000));

    // 4. Run a Full-Text Search query
    console.log("Running FTS query: FullTextContains(c.description, 'gym') OR 'pulley'...");
    const ftsQuery = `
      SELECT c.id, c.name, c.description
      FROM c
      WHERE FullTextContains(c.description, 'gym') OR FullTextContains(c.description, 'pulley')
      ORDER BY RANK RRF(FullTextScore(c.description, 'gym'), FullTextScore(c.description, 'pulley'))
    `;

    const { resources: ftsResults } = await container.items
      .query<Pick<SampleItem, "id" | "name" | "description">>(ftsQuery, {
        allowUnboundedNonStreamingQueries: true,
      })
      .fetchAll();

    console.log(`  ✓ FTS returned ${ftsResults.length} results:`);
    for (const r of ftsResults) {
      console.log(`    - [${r.id}] ${r.name}`);
    }

    // 5. Rerank the FTS results
    const documents: string[] = ftsResults.map((item) => JSON.stringify(item));

    const rerankContext = "most economical with multiple pulley adjustments ideal for home gyms";
    console.log(`\nReranking ${documents.length} documents...`);
    console.log(`  Query: "${rerankContext}"\n`);

    const result: SemanticRerankResult = await container.semanticRerank(
      rerankContext,
      documents,
      {
        returnDocuments: true,
        topK: 10,
        batchSize: 32,
      },
    );

    // 6. Print results
    console.log("=== Rerank Results ===");
    console.log(`  Scores: ${result.rerankScores.length}`);
    console.log(`  Latency: ${JSON.stringify(result.latency)}`);
    console.log(`  Token usage: ${JSON.stringify(result.tokenUsage)}\n`);

    for (const score of result.rerankScores) {
      const doc = score.document ? JSON.parse(score.document) as SampleItem : null;
      console.log(
        `  #${score.index} (score: ${score.score.toFixed(4)}) — ${doc?.name ?? "(no document)"}`,
      );
    }

    console.log("\n✅ Demo complete!");
  } finally {
    // 8. Cleanup inserted documents
    console.log("\nCleaning up...");
    for (const item of sampleItems) {
      try {
        await container.item(item.id, item.category).delete();
      } catch {
        // ignore
      }
    }
    client.dispose();
    console.log("Done.");
  }
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
